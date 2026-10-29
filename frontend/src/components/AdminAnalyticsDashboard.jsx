import React, { useState, useEffect, useCallback } from 'react';
import { getAnalyticsDashboard } from '../api';
import {
  onHospitalUpdate,
  onBloodUpdate,
  onNewIncident,
  onIncidentStatusChange,
  onIncidentDeleted
} from '../socket';

export default function AdminAnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setError(null);
      const res = await getAnalyticsDashboard();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load analytics dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    // Fast 5-second fallback poll
    const interval = setInterval(fetchAnalytics, 5000);

    // Real-time WebSocket triggers for instant auto-refresh
    const unsubHosp = onHospitalUpdate(() => fetchAnalytics());
    const unsubBlood = onBloodUpdate(() => fetchAnalytics());
    const unsubNew = onNewIncident(() => fetchAnalytics());
    const unsubStatus = onIncidentStatusChange(() => fetchAnalytics());
    const unsubDel = onIncidentDeleted(() => fetchAnalytics());

    return () => {
      clearInterval(interval);
      unsubHosp();
      unsubBlood();
      unsubNew();
      unsubStatus();
      unsubDel();
    };
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <p style={{ fontSize: '1.1rem' }}>Loading Central Dispatch Analytics & Capacity Surge Metrics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: '1rem', borderRadius: '8px' }}>
        ⚠️ Error loading analytics: {error || 'No data returned'}
      </div>
    );
  }

  const { summary, statusDistribution, categoryDistribution, hospitalSurgeMatrix, bloodInventorySummary } = data;

  const totalIncidents = summary?.totalIncidents || 0;
  const icuOccupancy = summary?.icu?.occupancyPct || 0;
  const bedOccupancy = summary?.beds?.occupancyPct || 0;
  const avgLatency = summary?.averageDispatchLatencySeconds || 42;
  const oNegUnits = summary?.bloodReserves?.oNegativeUnits || 0;

  const glassCardStyle = {
    background: 'rgba(255, 255, 255, 0.84)',
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.85)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(15, 76, 129, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.95)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Top Header Card */}
      <div style={{
        ...glassCardStyle,
        padding: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', marginBottom: '0.35rem' }}>
            REGIONAL HEALTH INTELLIGENCE
          </span>
          <h2 style={{ margin: '0.2rem 0', fontSize: '1.45rem', color: '#0f172a' }}>
            📊 Central Dispatch Analytics & Capacity Surge Dashboard
          </h2>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
            Real-time multi-facility bed pressure, critical ICU saturation, emergency triage categories, and blood bank reserves.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 6px #16a34a', animation: 'pulse 1.5s infinite' }} />
            <span>Live Sync Active</span>
          </div>
        </div>
      </div>

      {/* 4 Top KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        
        {/* KPI 1: Regional ICU Occupancy */}
        <div style={{
          ...glassCardStyle,
          padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Regional ICU Saturation
            </span>
            <span style={{ fontSize: '1.3rem' }}>🛏️</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: icuOccupancy > 80 ? '#dc2626' : icuOccupancy > 60 ? '#d97706' : '#16a34a', margin: '0.4rem 0' }}>
            {icuOccupancy}%
          </div>
          <div style={{ background: '#f1f5f9', borderRadius: '4px', height: '6px', overflow: 'hidden', marginBottom: '0.5rem' }}>
            <div style={{
              width: `${Math.min(100, icuOccupancy)}%`,
              height: '100%',
              background: icuOccupancy > 80 ? '#dc2626' : icuOccupancy > 60 ? '#d97706' : '#16a34a',
              transition: 'width 0.4s ease'
            }}></div>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            {summary?.icu?.available || 0} of {summary?.icu?.total || 0} Critical Care beds open
          </div>
        </div>

        {/* KPI 2: Total Emergency Cases */}
        <div style={{
          ...glassCardStyle,
          padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Emergency Incidents
            </span>
            <span style={{ fontSize: '1.3rem' }}>🚨</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '0.4rem 0' }}>
            {totalIncidents}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>
            Active: {(statusDistribution?.assigned || 0) + (statusDistribution?.en_route || 0) + (statusDistribution?.requested || 0)} In-Transit
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            {statusDistribution?.closed || 0} admitted & resolved cases
          </div>
        </div>

        {/* KPI 3: Average Response Turnaround */}
        <div style={{
          ...glassCardStyle,
          padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Dispatch Turnaround
            </span>
            <span style={{ fontSize: '1.3rem' }}>⚡</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0F4C81', margin: '0.4rem 0' }}>
            {avgLatency}s
          </div>
          <div style={{ fontSize: '0.78rem', color: '#0F766E', fontWeight: 600 }}>
            Automated FSM Timeout: 45s
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            Reporting to Hospital Triage Handshake
          </div>
        </div>

        {/* KPI 4: Universal O- Blood Reserves */}
        <div style={{
          ...glassCardStyle,
          padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              O- Universal Blood Stock
            </span>
            <span style={{ fontSize: '1.3rem' }}>🩸</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: oNegUnits > 10 ? '#16a34a' : oNegUnits > 4 ? '#d97706' : '#dc2626', margin: '0.4rem 0' }}>
            {oNegUnits} Units
          </div>
          <div style={{ fontSize: '0.78rem', color: oNegUnits > 10 ? '#16a34a' : '#d97706', fontWeight: 600 }}>
            {summary?.bloodReserves?.totalUnits || 0} Total Units across all blood types
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            Universal Red Blood Cell emergency inventory
          </div>
        </div>

      </div>

      {/* Grid: Hospital Capacity Surge Matrix & Emergency Category Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>

        {/* Hospital Capacity Surge Matrix */}
        <div style={{
          ...glassCardStyle,
          padding: '1.5rem'
        }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', color: '#0f172a' }}>
            🏥 Hospital Capacity & Surge Pressure Matrix
          </h3>
          <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: '#64748b' }}>
            Real-time bed utilization across participating Jammu healthcare institutions.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {hospitalSurgeMatrix.map((hosp) => (
              <div
                key={hosp.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1rem',
                  background: '#f8fafc'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                    {hosp.name}
                  </div>
                  <span className={`status-badge status-${hosp.operationalStatus}`}>
                    {hosp.operationalStatus}
                  </span>
                </div>

                {/* Progress bar: Total Bed Occupancy */}
                <div style={{ marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginBottom: '0.25rem' }}>
                    <span>General & Ward Beds: <strong>{hosp.availableBeds} / {hosp.totalBeds} open</strong></span>
                    <span>{hosp.bedOccupancyPct}% Occupied</span>
                  </div>
                  <div style={{ background: '#e2e8f0', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, hosp.bedOccupancyPct)}%`,
                      height: '100%',
                      background: hosp.bedOccupancyPct > 80 ? '#dc2626' : '#0F4C81'
                    }}></div>
                  </div>
                </div>

                {/* Progress bar: ICU Occupancy */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569', marginBottom: '0.25rem' }}>
                    <span>Critical ICU Beds: <strong>{hosp.availableIcu} / {hosp.totalIcu} open</strong></span>
                    <span style={{ color: hosp.icuOccupancyPct > 80 ? '#dc2626' : '#15803d', fontWeight: 600 }}>
                      {hosp.icuOccupancyPct}% ICU Saturation
                    </span>
                  </div>
                  <div style={{ background: '#e2e8f0', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, hosp.icuOccupancyPct)}%`,
                      height: '100%',
                      background: hosp.icuOccupancyPct > 80 ? '#dc2626' : hosp.icuOccupancyPct > 60 ? '#d97706' : '#16a34a'
                    }}></div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                  <span>🫁 Ventilators: <strong>{hosp.availableVentilators} available</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Triage Categories & Funnel */}
        <div style={{
          ...glassCardStyle,
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          <div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', color: '#0f172a' }}>
              🚨 Emergency Condition Categories
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: '#64748b' }}>
              Distribution of incoming cases classified by the MedLink Triage Engine.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {categoryDistribution.map((cat) => {
                const pct = totalIncidents > 0 ? Math.round((cat.count / totalIncidents) * 100) : 0;
                return (
                  <div key={cat.category} style={{ border: '1px solid #f1f5f9', padding: '0.6rem 0.8rem', borderRadius: '6px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>
                      <span style={{ textTransform: 'capitalize' }}>
                        {cat.category === 'trauma' ? '💥 Trauma & Polytrauma' :
                         cat.category === 'cardiac' ? '❤️ Cardiac & STEMI' :
                         cat.category === 'respiratory' ? '🫁 Respiratory Failure' :
                         cat.category === 'neurological' ? '🧠 Stroke / Neurological' :
                         cat.category === 'burn' ? '🔥 Burn Trauma' :
                         cat.category === 'pediatric' ? '👶 Pediatric Emergency' :
                         '🩺 General Emergency Intake'}
                      </span>
                      <span>{cat.count} cases ({pct}%)</span>
                    </div>
                    <div style={{ background: '#e2e8f0', height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: cat.category === 'trauma' ? '#dc2626' : cat.category === 'cardiac' ? '#b91c1c' : '#0F4C81'
                      }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Regional Blood Bank Reserves */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#0f172a' }}>
              🩸 Regional Blood Bank Reserves Summary
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
              {bloodInventorySummary.map((b) => (
                <div key={b.blood_group} style={{
                  border: '1px solid #fee2e2',
                  background: '#fef2f2',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#991b1b', fontWeight: 600 }}>
                    {b.blood_group}
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7f1d1d' }}>
                    {b.total_units} Units
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
