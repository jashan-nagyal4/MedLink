import React, { useState, useEffect, useCallback } from 'react';
import { getAnalyticsDashboard } from '../api';
import {
  onHospitalUpdate,
  onBloodUpdate,
  onNewIncident,
  onIncidentStatusChange,
  onIncidentDeleted
} from '../socket';

/**
 * Clean & Minimal SVG Donut / Pie Chart Component
 */
function MinimalDonutChart({ data = [], size = 200, strokeWidth = 26, centerValue, centerLabel }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedAngle = 0;
  const slices = data.map((item, index) => {
    const val = Number(item.value) || 0;
    const ratio = total > 0 ? val / total : 0;
    const strokeDasharray = `${ratio * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedAngle * circumference;
    accumulatedAngle += ratio;
    return {
      ...item,
      val,
      ratio,
      strokeDasharray,
      strokeDashoffset,
      pct: Math.round(ratio * 100),
      isHovered: hoveredIdx === index
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* SVG Canvas */}
      <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
          {/* Subtle background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {total > 0 ? (
            slices.map((slice, idx) => (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={slice.isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="butt"
                style={{
                  transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                  cursor: 'pointer',
                  opacity: hoveredIdx !== null && hoveredIdx !== idx ? 0.45 : 1
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            ))
          ) : (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={strokeWidth}
            />
          )}
        </svg>

        {/* Center Minimal Metric */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          <span style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
            {hoveredIdx !== null ? slices[hoveredIdx].val : (centerValue !== undefined ? centerValue : total)}
          </span>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '4px' }}>
            {hoveredIdx !== null ? slices[hoveredIdx].label : (centerLabel || 'Total Units')}
          </span>
          {hoveredIdx !== null && total > 0 && (
            <span style={{ fontSize: '0.7rem', color: slices[hoveredIdx].color, fontWeight: 700, marginTop: '2px' }}>
              {slices[hoveredIdx].pct}% of total
            </span>
          )}
        </div>
      </div>

      {/* Clean Minimal Legend - 2 per line for optimal readability */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '0.6rem 0.85rem',
        marginTop: '1.25rem',
        width: '100%'
      }}>
        {data.map((item, idx) => (
          <div
            key={idx}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            title={`${item.label}: ${item.value}${total > 0 ? ` (${Math.round(((Number(item.value) || 0) / total) * 100)}%)` : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.45rem 0.65rem',
              borderRadius: '8px',
              background: hoveredIdx === idx ? '#f1f5f9' : '#f8fafc',
              border: `1px solid ${hoveredIdx === idx ? '#cbd5e1' : '#e2e8f0'}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, marginRight: '0.5rem' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#334155',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {item.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
              <strong style={{ fontSize: '0.84rem', color: '#0f172a' }}>{item.value}</strong>
              {total > 0 && (
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                  ({Math.round(((Number(item.value) || 0) / total) * 100)}%)
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Minimalist Horizontal Bar Graph Component
 */
function MinimalBarGraph({ data = [], maxVal, unit = 'units', showPercentage = false }) {
  const calculatedMax = maxVal || Math.max(...data.map(d => Number(d.value) || 0), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%' }}>
      {data.map((item, idx) => {
        const val = Number(item.value) || 0;
        const pct = Math.min(100, Math.round((val / calculatedMax) * 100));

        return (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                {item.icon && <span>{item.icon}</span>}
                <span style={{ fontWeight: item.highlight ? 700 : 600, color: item.highlight ? '#0f172a' : '#334155' }}>
                  {item.label}
                </span>
                {item.badge && (
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    background: item.badgeColor || '#f1f5f9',
                    color: item.badgeTextColor || '#475569'
                  }}>
                    {item.badge}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <strong style={{ color: item.color || '#0f172a', fontSize: '0.82rem' }}>
                  {val} {unit}
                </strong>
                {showPercentage && (
                  <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                    ({pct}%)
                  </span>
                )}
              </div>
            </div>

            {/* Sleek Progress Track */}
            <div style={{ width: '100%', height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: item.color || '#0F4C81',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Minimalist Radial KPI Progress Gauge
 */
function RadialKpiGauge({ value = 0, max = 100, label, sublabel, color = '#0F4C81', size = 68, strokeWidth = 7 }) {
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  const offset = circ - (pct / 100) * circ;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.85rem',
          fontWeight: 800,
          color: '#0f172a'
        }}>
          {pct}%
        </div>
      </div>
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </div>
        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0.1rem 0' }}>
          {value} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>/ {max}</span>
        </div>
        {sublabel && (
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main Clean Dashboard Component
 */
export default function CleanDashboard({
  hospitalData,
  bloodInventory = [],
  incidents = [],
  isAdmin = false,
  onNavigate
}) {
  const [regionalData, setRegionalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewScope, setViewScope] = useState(isAdmin ? 'regional' : 'facility'); // 'facility' | 'regional'

  const fetchAnalytics = useCallback(async () => {
    try {
      setError(null);
      const res = await getAnalyticsDashboard();
      setRegionalData(res);
    } catch (err) {
      setError(err.message || 'Failed to load analytics dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();

    // 1. Fast heartbeat poll (every 5 seconds)
    const interval = setInterval(fetchAnalytics, 5000);

    // 2. Real-time WebSocket triggers: immediately auto-refresh when any bed, blood bank, or incident changes!
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

  // Facility Data Extraction
  const hospital = hospitalData?.hospital;
  const resources = hospitalData?.resources || [];
  const specialists = hospitalData?.specialists || [];

  // Facility Bed Calculations
  let facTotalBeds = 0;
  let facAvailBeds = 0;
  let facTotalIcu = 0;
  let facAvailIcu = 0;

  resources.forEach(r => {
    const name = (r.resource_type || '').toLowerCase();
    const total = Number(r.total_quantity) || 0;
    const avail = Number(r.available_quantity) || 0;
    if (name.includes('icu')) {
      facTotalIcu += total;
      facAvailIcu += avail;
    } else if (name.includes('bed') || name.includes('bay')) {
      facTotalBeds += total;
      facAvailBeds += avail;
    }
  });

  // Fallback to hospital model attributes if resources list has not populated
  if (facTotalBeds === 0 && Number(hospital?.total_beds)) {
    facTotalBeds = Number(hospital.total_beds) || 0;
    facAvailBeds = Number(hospital.available_beds) || 0;
  }
  if (facTotalIcu === 0 && Number(hospital?.total_icu)) {
    facTotalIcu = Number(hospital.total_icu) || 0;
    facAvailIcu = Number(hospital.available_icu) || 0;
  }

  const facOccupiedBeds = Math.max(0, facTotalBeds - facAvailBeds);
  const facOccupiedIcu = Math.max(0, facTotalIcu - facAvailIcu);
  const facIcuOccupancyPct = facTotalIcu > 0 ? Math.round((facOccupiedIcu / facTotalIcu) * 100) : 0;
  const facBedOccupancyPct = facTotalBeds > 0 ? Math.round((facOccupiedBeds / facTotalBeds) * 100) : 0;

  // Universal Donor (O-) and Universal Plasma (AB+) Detection Helpers
  const isONegative = (bg) => {
    if (!bg) return false;
    const s = String(bg).toLowerCase();
    return s.includes('o-') || s.includes('o negative') || s.startsWith('o-');
  };

  const isUniversalPlasma = (bg) => {
    if (!bg) return false;
    const s = String(bg).toLowerCase();
    return s.includes('ab+') || s.includes('universal plasma');
  };

  // Facility Blood Calculations
  const facONegItem = bloodInventory.find(b => isONegative(b.blood_group));
  const facONegUnits = Number(facONegItem?.units_available) || 0;
  const facTotalBloodUnits = bloodInventory.reduce((s, b) => s + (Number(b.units_available) || 0), 0);

  // Regional Calculations
  const regSummary = regionalData?.summary;
  const regIcuOccupancy = regSummary?.icu?.occupancyPct || 0;
  const regBedOccupancy = regSummary?.beds?.occupancyPct || 0;
  const regTotalIncidents = regSummary?.totalIncidents || 0;
  const regONegUnits = regSummary?.bloodReserves?.oNegativeUnits || 0;
  const regTotalBloodUnits = regSummary?.bloodReserves?.totalUnits || 0;

  // Active view metrics based on selected viewScope
  const isFacilityView = !isAdmin && viewScope === 'facility' && hospital;
  const activeONegUnits = isFacilityView ? facONegUnits : regONegUnits;
  const activeTotalBloodUnits = isFacilityView ? facTotalBloodUnits : regTotalBloodUnits;

  // Bed Distribution Donut Data
  const bedChartData = isFacilityView ? [
    { label: 'Available General Beds', value: facAvailBeds, color: '#15803D' },
    { label: 'Occupied General Beds', value: facOccupiedBeds, color: '#0F4C81' },
    { label: 'Available ICU Beds', value: facAvailIcu, color: '#14B8A6' },
    { label: 'Occupied Critical ICU', value: facOccupiedIcu, color: '#DC2626' }
  ] : [
    { label: 'Available General Beds', value: regSummary?.beds?.available || 0, color: '#15803D' },
    { label: 'Occupied General Beds', value: Math.max(0, (regSummary?.beds?.total || 0) - (regSummary?.beds?.available || 0)), color: '#0F4C81' },
    { label: 'Available ICU Beds', value: regSummary?.icu?.available || 0, color: '#14B8A6' },
    { label: 'Occupied Critical ICU', value: Math.max(0, (regSummary?.icu?.total || 0) - (regSummary?.icu?.available || 0)), color: '#DC2626' }
  ];

  // Triage Priority Donut Data
  const incidentSourceList = isFacilityView ? incidents : (regionalData?.categoryDistribution || []);
  let immediateCount = 0;
  let urgentCount = 0;
  let delayedCount = 0;
  let resolvedCount = 0;

  if (isFacilityView) {
    incidents.forEach(inc => {
      const sev = (inc.severity || '').toLowerCase();
      const st = (inc.status || '').toLowerCase();
      if (st === 'closed' || st === 'admitted') resolvedCount++;
      else if (sev === 'critical') immediateCount++;
      else if (sev === 'urgent') urgentCount++;
      else delayedCount++;
    });
  } else {
    // Map status from regionalData
    const statusMap = regionalData?.statusDistribution || {};
    immediateCount = statusMap.en_route || 0;
    urgentCount = (statusMap.requested || 0) + (statusMap.assigned || 0);
    delayedCount = statusMap.arrived || 0;
    resolvedCount = statusMap.closed || 0;
  }

  const triageChartData = [
    { label: 'Immediate / Critical (Red)', value: immediateCount, color: '#DC2626' },
    { label: 'Urgent Dispatch (Amber)', value: urgentCount, color: '#B45309' },
    { label: 'Delayed / Stable (Green)', value: delayedCount, color: '#15803D' },
    { label: 'Admitted / Resolved', value: resolvedCount, color: '#64748B' }
  ];

  // Blood Inventory Bar Data
  const bloodDataList = isFacilityView && bloodInventory.length > 0
    ? bloodInventory.map(b => {
        const isOneg = isONegative(b.blood_group);
        const isAbPlus = isUniversalPlasma(b.blood_group);
        const val = Number(b.units_available) || 0;
        return {
          label: b.blood_group,
          value: val,
          highlight: isOneg,
          badge: isOneg ? 'Universal Red Cell' : isAbPlus ? 'Universal Plasma' : undefined,
          badgeColor: isOneg ? '#FEE2E2' : isAbPlus ? '#E0F2FE' : undefined,
          badgeTextColor: isOneg ? '#DC2626' : isAbPlus ? '#0F4C81' : undefined,
          color: val < 5 ? '#DC2626' : val < 10 ? '#B45309' : '#15803D'
        };
      })
    : (regionalData?.bloodInventorySummary || []).map(b => {
        const isOneg = isONegative(b.blood_group);
        const isAbPlus = isUniversalPlasma(b.blood_group);
        const val = Number(b.total_units) || 0;
        return {
          label: b.blood_group,
          value: val,
          highlight: isOneg,
          badge: isOneg ? 'Universal Red Cell' : isAbPlus ? 'Universal Plasma' : undefined,
          badgeColor: isOneg ? '#FEE2E2' : isAbPlus ? '#E0F2FE' : undefined,
          badgeTextColor: isOneg ? '#DC2626' : isAbPlus ? '#0F4C81' : undefined,
          color: val < 10 ? '#DC2626' : val < 25 ? '#B45309' : '#15803D'
        };
      });

  // Specialist Shift Breakdown (Supports both single facility and regional network aggregate)
  const regSpec = regionalData?.specialistsSummary || {};
  const onDutyCount = isFacilityView
    ? specialists.filter(s => (s.on_duty !== undefined ? s.on_duty : s.available)).length
    : (regSpec.onDuty || 0);

  const offDutyCount = isFacilityView
    ? specialists.length - onDutyCount
    : (regSpec.offDuty || 0);

  const morningShifts = isFacilityView
    ? specialists.filter(s => (s.shift || '').toLowerCase().includes('morning')).length
    : (regSpec.morningShifts || 0);

  const eveningShifts = isFacilityView
    ? specialists.filter(s => (s.shift || '').toLowerCase().includes('evening')).length
    : (regSpec.eveningShifts || 0);

  const nightShifts = isFacilityView
    ? specialists.filter(s => (s.shift || '').toLowerCase().includes('night')).length
    : (regSpec.nightShifts || 0);

  const specialistShiftData = [
    { label: 'Morning Rotation (08:00 - 16:00)', value: morningShifts, color: '#0284c7', icon: '🌅' },
    { label: 'Evening Rotation (16:00 - 00:00)', value: eveningShifts, color: '#f59e0b', icon: '🌇' },
    { label: 'Night Trauma Coverage (00:00 - 08:00)', value: nightShifts, color: '#6366f1', icon: '🌙' }
  ];

  const glassCardStyle = {
    background: 'rgba(255, 255, 255, 0.84)',
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.85)',
    borderRadius: '14px',
    boxShadow: '0 8px 32px rgba(15, 76, 129, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.95)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>

      {/* 1. Header Card with Scope Toggle & Clean Minimal Controls */}
      <div style={{
        ...glassCardStyle,
        padding: '1.25rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <span style={{
              background: '#e0f2fe',
              color: '#0369a1',
              padding: '0.2rem 0.6rem',
              borderRadius: '20px',
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              {isFacilityView ? '🏥 FACILITY COMMAND DASHBOARD' : '🌐 REGIONAL HEALTH INTELLIGENCE'}
            </span>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              {isFacilityView ? (hospital?.name || 'Local Facility') : 'Jammu Healthcare Network'}
            </span>
          </div>

          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a', fontWeight: 800 }}>
            Operational Capacity & Surge Analytics
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: '#64748b' }}>
            Real-time visual monitoring of bed capacity, triage case priority, specialist coverage, and blood reserves.
          </p>
        </div>

        {/* Action Controls & Scope Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {!isAdmin && hospital && (
            <div style={{
              display: 'flex',
              background: '#f1f5f9',
              padding: '0.25rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <button
                onClick={() => setViewScope('facility')}
                style={{
                  border: 'none',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: viewScope === 'facility' ? '#ffffff' : 'transparent',
                  color: viewScope === 'facility' ? '#0f172a' : '#64748b',
                  boxShadow: viewScope === 'facility' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                🏥 Facility View
              </button>
              <button
                onClick={() => setViewScope('regional')}
                style={{
                  border: 'none',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: viewScope === 'regional' ? '#ffffff' : 'transparent',
                  color: viewScope === 'regional' ? '#0f172a' : '#64748b',
                  boxShadow: viewScope === 'regional' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                🌐 Regional Network
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 6px #16a34a', animation: 'pulse 1.5s infinite' }} />
            <span>Live Sync Active</span>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.85rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '0.85rem' }}>
          ⚠️ Notice: {error}
        </div>
      )}

      {/* 2. Top Sleek KPI Gauges (4 Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1.25rem' }}>
        
        {/* KPI 1: ICU Bed Saturation */}
        <div style={{
          ...glassCardStyle,
          padding: '1.2rem'
        }}>
          <RadialKpiGauge
            value={isFacilityView ? facOccupiedIcu : Math.max(0, (regSummary?.icu?.total || 0) - (regSummary?.icu?.available || 0))}
            max={isFacilityView ? (facTotalIcu || 1) : (regSummary?.icu?.total || 1)}
            label="ICU Saturation"
            sublabel={isFacilityView ? `${facAvailIcu} critical beds open` : `${regSummary?.icu?.available || 0} open across region`}
            color={(isFacilityView ? facIcuOccupancyPct : regIcuOccupancy) > 80 ? '#DC2626' : '#15803D'}
          />
        </div>

        {/* KPI 2: General Ward Bed Occupancy */}
        <div style={{
          ...glassCardStyle,
          padding: '1.2rem'
        }}>
          <RadialKpiGauge
            value={isFacilityView ? facOccupiedBeds : Math.max(0, (regSummary?.beds?.total || 0) - (regSummary?.beds?.available || 0))}
            max={isFacilityView ? (facTotalBeds || 1) : (regSummary?.beds?.total || 1)}
            label="Ward Bed Utilization"
            sublabel={isFacilityView ? `${facAvailBeds} beds available` : `${regSummary?.beds?.available || 0} open in regional pool`}
            color={(isFacilityView ? facBedOccupancyPct : regBedOccupancy) > 80 ? '#B45309' : '#0F4C81'}
          />
        </div>

        {/* KPI 3: Active Cases / Emergency Incidents */}
        <div style={{
          ...glassCardStyle,
          padding: '1.2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {isFacilityView ? 'Facility Emergency Cases' : 'Regional Active Dispatches'}
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
              {isFacilityView ? incidents.length : regTotalIncidents}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
              {isFacilityView ? `${incidents.filter(i => i.status !== 'closed').length} active in-triage` : `${immediateCount + urgentCount} in-transit ambulances`}
            </div>
          </div>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '10px',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}>
            🚨
          </div>
        </div>

        {/* KPI 4: Universal O- Blood & Plasma Reserves */}
        <div style={{
          ...glassCardStyle,
          padding: '1.2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Universal Donor (O-) Stock
            </div>
            <div style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              color: activeONegUnits < 5 ? '#DC2626' : activeONegUnits < 10 ? '#B45309' : '#0F4C81',
              margin: '0.2rem 0'
            }}>
              {activeONegUnits} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B' }}>units</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
              {isFacilityView
                ? `${activeTotalBloodUnits} total units on site`
                : `${activeTotalBloodUnits} total units in regional reserve`}
            </div>
          </div>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '10px',
            background: activeONegUnits < 5 ? '#FEE2E2' : '#DCFCE7',
            color: activeONegUnits < 5 ? '#DC2626' : '#15803D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem'
          }}>
            🩸
          </div>
        </div>

      </div>

      {/* 3. Primary Visual Analytics: 2 Donut / Pie Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>

        {/* Chart 1: Bed & Critical Equipment Distribution */}
        <div style={{
          ...glassCardStyle,
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 700 }}>
                🛏️ Bed Capacity & Resource Allocation
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                {isFacilityView ? `${hospital?.name} active bed capacity breakdown` : 'Consolidated regional bed availability across Jammu'}
              </p>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('beds')}
                style={{ background: 'transparent', border: 'none', color: '#0F4C81', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Manage Beds →
              </button>
            )}
          </div>

          <MinimalDonutChart
            data={bedChartData}
            size={190}
            strokeWidth={24}
            centerValue={isFacilityView ? `${facBedOccupancyPct}%` : `${regBedOccupancy}%`}
            centerLabel="Occupied"
          />
        </div>

        {/* Chart 2: Emergency Triage Priority Breakdown */}
        <div style={{
          ...glassCardStyle,
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 700 }}>
                🚨 Emergency Triage Priority Distribution
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Case triage categories sorted by clinical acuity and escalation urgency
              </p>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('incidents')}
                style={{ background: 'transparent', border: 'none', color: '#0F4C81', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                View Incidents →
              </button>
            )}
          </div>

          <MinimalDonutChart
            data={triageChartData}
            size={190}
            strokeWidth={24}
            centerValue={triageChartData.reduce((s, d) => s + d.value, 0)}
            centerLabel="Total Cases"
          />
        </div>

      </div>

      {/* 4. Secondary Visual Analytics: Blood Reserves Bar Graph & Specialist Rosters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>

        {/* Minimal Bar Graph: Emergency Blood Bank Inventory */}
        <div style={{
          ...glassCardStyle,
          padding: '1.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 700 }}>
                🩸 Emergency Blood & Plasma Reserves
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Stock units by blood group with critical depletion thresholds
              </p>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('blood')}
                style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Stock Registry →
              </button>
            )}
          </div>

          {bloodDataList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              No blood inventory logged yet.
            </div>
          ) : (
            <MinimalBarGraph
              data={bloodDataList}
              unit="units"
            />
          )}
        </div>

        {/* Specialist Doctor On-Duty Roster & Shift Breakdown */}
        <div style={{
          ...glassCardStyle,
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 700 }}>
                👨‍⚕️ Specialist Roster & Shift Coverage
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Active emergency duty status across 24-hour rotational shifts
              </p>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate(isAdmin ? 'hospitals' : 'doctors')}
                style={{ background: 'transparent', border: 'none', color: '#0F4C81', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                {isAdmin ? 'View Hospitals Roster →' : 'Roster Schedule →'}
              </button>
            )}
          </div>

          {/* Quick On-Duty Status Pill Row */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            padding: '0.75rem 1rem',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '1.25rem'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Active On-Duty</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#16a34a' }}>
                {onDutyCount} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Doctors</span>
              </div>
            </div>
            <div style={{ width: '1px', background: '#cbd5e1' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Off-Duty / Standby</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#64748b' }}>
                {offDutyCount} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Specialists</span>
              </div>
            </div>
          </div>

          {/* Shift Distribution Bars */}
          <MinimalBarGraph
            data={specialistShiftData}
            unit="on-call"
          />

          {/* On-Duty Doctor Mini Badges */}
          {specialists.length > 0 && (() => {
            const onDutyList = specialists.filter(s => (s.on_duty !== undefined ? s.on_duty : s.available));
            const displayList = onDutyList.length > 0 ? onDutyList.slice(0, 8) : specialists.slice(0, 8);
            return (
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  {onDutyList.length > 0 ? `Active On-Duty Emergency Faculty (${onDutyList.length} total)` : 'Key Specialists on Current Rotation'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {displayList.map(spec => {
                    const isSpecOnDuty = spec.on_duty !== undefined ? spec.on_duty : spec.available;
                    return (
                      <span
                        key={spec.id}
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: isSpecOnDuty ? '#dcfce7' : '#f1f5f9',
                          color: isSpecOnDuty ? '#15803d' : '#64748b',
                          fontWeight: 600,
                          border: `1px solid ${isSpecOnDuty ? '#bbf7d0' : '#e2e8f0'}`
                        }}
                      >
                        {isSpecOnDuty ? '🟢' : '⚪'} {spec.doctor_name || spec.specialty}
                        {spec.department && <span style={{ opacity: 0.75, marginLeft: '0.25rem' }}>({spec.department})</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

      </div>

      {/* 5. Regional Hospital Bed Saturation Matrix (Clean Bar Comparison) */}
      {regionalData?.hospitalSurgeMatrix && regionalData.hospitalSurgeMatrix.length > 0 && (
        <div style={{
          ...glassCardStyle,
          padding: '1.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 700 }}>
                🏥 Regional Facilities Capacity Comparison
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Benchmarked bed saturation and critical ICU strain across Jammu healthcare providers
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {regionalData.hospitalSurgeMatrix.map(hosp => (
              <div
                key={hosp.id}
                style={{
                  border: '1px solid #f1f5f9',
                  borderRadius: '8px',
                  padding: '1rem',
                  background: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                    {hosp.name}
                  </span>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    background: hosp.operationalStatus === 'busy' ? '#fef3c7' : '#dcfce7',
                    color: hosp.operationalStatus === 'busy' ? '#92400e' : '#15803d'
                  }}>
                    {hosp.operationalStatus || 'Online'}
                  </span>
                </div>

                {/* Ward Beds Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#475569', marginBottom: '0.2rem' }}>
                    <span>Ward Beds ({hosp.availableBeds}/{hosp.totalBeds} open)</span>
                    <strong style={{ color: hosp.bedOccupancyPct > 80 ? '#dc2626' : '#0F4C81' }}>{hosp.bedOccupancyPct}%</strong>
                  </div>
                  <div style={{ height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, hosp.bedOccupancyPct)}%`,
                      height: '100%',
                      background: hosp.bedOccupancyPct > 80 ? '#dc2626' : '#0F4C81'
                    }} />
                  </div>
                </div>

                {/* ICU Beds Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#475569', marginBottom: '0.2rem' }}>
                    <span>ICU Beds ({hosp.availableIcu}/{hosp.totalIcu} open)</span>
                    <strong style={{ color: hosp.icuOccupancyPct > 80 ? '#dc2626' : '#15803d' }}>{hosp.icuOccupancyPct}%</strong>
                  </div>
                  <div style={{ height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, hosp.icuOccupancyPct)}%`,
                      height: '100%',
                      background: hosp.icuOccupancyPct > 80 ? '#dc2626' : hosp.icuOccupancyPct > 60 ? '#f59e0b' : '#10b981'
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
