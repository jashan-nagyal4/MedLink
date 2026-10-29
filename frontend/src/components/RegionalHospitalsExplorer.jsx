/**
 * Regional Hospitals Explorer & Command Directory
 * 
 * Role-Based Logic:
 * 1. Citizen Role ('patient'):
 *    - Simplified Patient Directory showing ONLY Hospital Name, Verified Address,
 *      Contact Phone, and Corrected Google Maps Location Link.
 *    - NO clinical ICU/bed gauges, blood stocks, or administrative metrics.
 * 
 * 2. Admin Role ('admin'):
 *    - Executive Command Center with KPI summary ribbon, live bed/blood meters,
 *      and Dual Views:
 *        a) Visual Card Grid with live progress meters
 *        b) Tactical Matrix Table with side-by-side facility comparison
 *    - Live Map is completely removed for Admin user as per instructions.
 */

import React, { useState, useMemo } from 'react';

// Helper: categorize hospital for aesthetic badges
function getHospitalCategory(name = '') {
  const n = name.toLowerCase();
  if (n.includes('gmc') || n.includes('government medical college')) {
    return {
      label: '🏛️ Govt Medical College & Apex Center',
      bg: '#E0F2FE',
      color: '#0F4C81',
      border: '#BAE6FD'
    };
  }
  if (n.includes('smgs') || n.includes('gulab singh')) {
    return {
      label: '👶 Pediatric, Neonatal & Maternity Apex',
      bg: '#fdf2f8',
      color: '#be185d',
      border: '#fbcfe8'
    };
  }
  if (n.includes('super speciality')) {
    return {
      label: '⚡ Tertiary Super-Speciality Hospital',
      bg: '#faf5ff',
      color: '#7e22ce',
      border: '#e9d5ff'
    };
  }
  if (n.includes('ascoms') || n.includes('batra')) {
    return {
      label: '🏥 Medical College & Trauma Research Center',
      bg: '#f0fdf4',
      color: '#15803d',
      border: '#bbf7d0'
    };
  }
  if (n.includes('ankur')) {
    return {
      label: '⭐ Multi-Speciality Emergency Trauma Center',
      bg: '#ecfeff',
      color: '#0e7490',
      border: '#a5f3fc'
    };
  }
  return {
    label: '🏥 Regional Healthcare Facility',
    bg: '#f8fafc',
    color: '#334155',
    border: '#cbd5e1'
  };
}

const glassCardStyle = {
  background: 'rgba(255, 255, 255, 0.84)',
  backdropFilter: 'blur(16px) saturate(160%)',
  WebkitBackdropFilter: 'blur(16px) saturate(160%)',
  border: '1px solid rgba(255, 255, 255, 0.85)',
  borderRadius: '14px',
  boxShadow: '0 8px 32px rgba(15, 76, 129, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.95)'
};

export default function RegionalHospitalsExplorer({
  hospitals = [],
  role = 'patient',
  onOpenDetails,
  onAddHospital,
  onDeleteHospital
}) {
  const [searchTerm, setSearchTerm] = useState('');
  // View mode for Admin (Grid or Table only - Live Map removed for Admin)
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'operational' | 'limited' | 'diverting'
  const [sortBy, setSortBy] = useState('name');
  
  // Capability toggles for Admin
  const [filterOnlyIcu, setFilterOnlyIcu] = useState(false);
  const [filterOnlyBlood, setFilterOnlyBlood] = useState(false);

  // Compute aggregate network telemetry for the Top KPI Ribbon (Hook called unconditionally)
  const networkMetrics = useMemo(() => {
    let totalFacilities = hospitals.length;
    let operationalCount = 0;
    let totalIcuAvail = 0;
    let totalIcuCap = 0;
    let totalGenAvail = 0;
    let totalGenCap = 0;
    let totalVentAvail = 0;
    let totalBloodUnits = 0;
    let totalSpecialists = 0;

    for (const h of hospitals) {
      if ((h.operational_status || '').toLowerCase() === 'operational') {
        operationalCount++;
      }
      totalIcuAvail += Number(h.icu_available || 0);
      totalIcuCap += Number(h.icu_total || 0);
      totalGenAvail += Number(h.general_available || 0);
      totalGenCap += Number(h.general_total || 0);
      totalVentAvail += Number(h.ventilators_available || 0);
      totalBloodUnits += Number(h.blood_units_total || 0);
      totalSpecialists += Number(h.specialists_on_duty || 0);
    }

    const icuPercent = totalIcuCap > 0 ? Math.round((totalIcuAvail / totalIcuCap) * 100) : 0;
    const genPercent = totalGenCap > 0 ? Math.round((totalGenAvail / totalGenCap) * 100) : 0;

    return {
      totalFacilities,
      operationalCount,
      totalIcuAvail,
      totalIcuCap,
      icuPercent,
      totalGenAvail,
      totalGenCap,
      genPercent,
      totalVentAvail,
      totalBloodUnits,
      totalSpecialists
    };
  }, [hospitals]);

  // Filter & Sort Hospitals for Admin (Hook called unconditionally)
  const filteredHospitals = useMemo(() => {
    return hospitals.filter((h) => {
      const term = searchTerm.trim().toLowerCase();
      if (term) {
        const matchesName = (h.name || '').toLowerCase().includes(term);
        const matchesAddr = (h.address || '').toLowerCase().includes(term);
        const matchesPhone = (h.phone || '').toLowerCase().includes(term);
        if (!matchesName && !matchesAddr && !matchesPhone) return false;
      }

      if (statusFilter !== 'all') {
        if ((h.operational_status || '').toLowerCase() !== statusFilter) return false;
      }

      if (filterOnlyIcu && Number(h.icu_available || 0) <= 0) return false;
      if (filterOnlyBlood && Number(h.blood_units_total || 0) < 150) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'icu') return Number(b.icu_available || 0) - Number(a.icu_available || 0);
      if (sortBy === 'general') return Number(b.general_available || 0) - Number(a.general_available || 0);
      if (sortBy === 'blood') return Number(b.blood_units_total || 0) - Number(a.blood_units_total || 0);
      if (sortBy === 'specialists') return Number(b.specialists_on_duty || 0) - Number(a.specialists_on_duty || 0);
      return 0;
    });
  }, [hospitals, searchTerm, statusFilter, filterOnlyIcu, filterOnlyBlood, sortBy]);

  // Filter for Citizen
  const filteredForCitizen = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return hospitals;
    return hospitals.filter((h) =>
      (h.name || '').toLowerCase().includes(term) ||
      (h.address || '').toLowerCase().includes(term)
    );
  }, [hospitals, searchTerm]);

  // =========================================================================
  // 1. CITIZEN / PATIENT VIEW: ONLY Address & Corrected Google Maps Location
  // =========================================================================
  if (role === 'patient') {

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Citizen Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #0B3A63 0%, #0F4C81 100%)',
          borderRadius: '16px',
          padding: '1.5rem 1.75rem',
          color: '#ffffff',
          boxShadow: '0 4px 20px rgba(11, 58, 99, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🏥</span>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Jammu Regional Hospitals Directory
              </h2>
              <span style={{
                background: 'rgba(20, 184, 166, 0.2)',
                color: '#14B8A6',
                border: '1px solid rgba(20, 184, 166, 0.4)',
                padding: '0.2rem 0.65rem',
                borderRadius: '20px',
                fontSize: '0.72rem',
                fontWeight: 700
              }}>
                ● {hospitals.length} VERIFIED HOSPITALS
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#E2E8F0' }}>
              Official street addresses, 24/7 emergency helplines, and direct Google Maps navigation for all major healthcare centers in Jammu.
            </p>
          </div>

          {/* Quick Search */}
          <div style={{ position: 'relative', minWidth: '280px', flex: '0 1 320px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', color: '#94a3b8' }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by hospital name or area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.85rem 0.55rem 2.25rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Citizen Hospital Cards: Only Address and Corrected Google Maps Location */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '1.25rem'
        }}>
          {filteredForCitizen.map((hosp) => {
            const category = getHospitalCategory(hosp.name);
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${hosp.latitude},${hosp.longitude}`;

            return (
              <div
                key={hosp.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)',
                  padding: '1.4rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.1rem',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(15, 23, 42, 0.05)';
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{
                      background: category.bg,
                      color: category.color,
                      border: `1px solid ${category.border}`,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700
                    }}>
                      {category.label}
                    </span>
                    <span style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '20px',
                      fontSize: '0.72rem',
                      fontWeight: 800
                    }}>
                      ● Operational
                    </span>
                  </div>

                  <h3 style={{ margin: '0 0 0.65rem 0', fontSize: '1.18rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>
                    {hosp.name}
                  </h3>

                  {/* Verified Address Block */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '10px',
                    padding: '0.85rem 1rem',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ color: '#334155', lineHeight: 1.45 }}>
                      <strong style={{ color: '#0f172a' }}>📍 Verified Street Address:</strong><br />
                      {hosp.address}
                    </div>

                    {hosp.phone && (
                      <div style={{ color: '#334155', marginTop: '0.2rem' }}>
                        <strong style={{ color: '#0f172a' }}>📞 Emergency Phone:</strong>{' '}
                        <a href={`tel:${hosp.phone}`} style={{ color: '#0F4C81', fontWeight: 700, textDecoration: 'none' }}>
                          {hosp.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Only Address & Corrected Google Maps Location */}
                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      flex: 1,
                      background: '#0F4C81',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.65rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      boxShadow: '0 2px 6px rgba(15, 76, 129, 0.25)',
                      transition: 'background 0.15s ease'
                    }}
                    title="Open exact verified hospital location in Google Maps"
                  >
                    <span>🗺️</span>
                    <span>View on Google Maps</span>
                  </a>

                  {hosp.phone && (
                    <a
                      href={`tel:${hosp.phone}`}
                      style={{
                        background: '#F8FAFC',
                        color: '#0F4C81',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '0.65rem 0.95rem',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                      title="Direct phone call to hospital triage desk"
                    >
                      <span>📞 Call</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. ADMIN VIEW: Executive Command Center (Live Map REMOVED for Admin)
  // =========================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* 1. Header & Live Indicator */}
      <div style={{
        background: 'linear-gradient(135deg, #0B3A63 0%, #0F4C81 100%)',
        borderRadius: '16px',
        padding: '1.35rem 1.75rem',
        color: '#ffffff',
        boxShadow: '0 4px 20px rgba(11, 58, 99, 0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '1.4rem' }}>🏥</span>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Regional Hospital Network & Live Command Directory
            </h2>
            <span style={{
              background: 'rgba(20, 184, 166, 0.2)',
              color: '#14B8A6',
              border: '1px solid rgba(20, 184, 166, 0.4)',
              padding: '0.2rem 0.65rem',
              borderRadius: '20px',
              fontSize: '0.72rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#14B8A6', boxShadow: '0 0 6px #14B8A6' }}></span>
              LIVE CAD TELEMETRY ACTIVE
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#E2E8F0' }}>
            Real-time critical care capacity, dynamic bed availability meters, PostGIS geolocations, and blood reserves across Jammu regional hubs.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={onAddHospital}
            style={{
              background: '#0F766E',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '0.55rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 2px 8px rgba(15, 118, 110, 0.35)',
              transition: 'all 0.15s ease'
            }}
          >
            <span>✚</span>
            <span>Add Facility</span>
          </button>

          {/* View Switcher Controls (Live Map REMOVED for Admin) */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '3px',
            borderRadius: '10px',
            display: 'flex',
            border: '1px solid rgba(255, 255, 255, 0.15)'
          }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? '#0F4C81' : 'transparent',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.4rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
              title="Visual Cards with Live Meters"
            >
              <span>🎴</span>
              <span>Grid View</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                background: viewMode === 'table' ? '#0F4C81' : 'transparent',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.4rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
              title="Tactical Operations Matrix"
            >
              <span>📋</span>
              <span>Matrix View</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Executive Regional Network KPI Summary Ribbon */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '0.85rem'
      }}>
        {/* Card 1: Facilities */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.84)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '14px',
          padding: '1rem 1.15rem',
          border: '1px solid rgba(255, 255, 255, 0.85)',
          boxShadow: '0 8px 32px rgba(15, 76, 129, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.95)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Network Facilities
            </span>
            <span style={{ fontSize: '1.2rem', padding: '0.2rem 0.5rem', background: '#eff6ff', borderRadius: '8px' }}>🏥</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
            {networkMetrics.totalFacilities} <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#16a34a' }}>({networkMetrics.operationalCount} Active)</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
            100% online across Jammu Circle
          </div>
        </div>

        {/* Card 2: ICU Capacity */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.84)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '14px',
          padding: '1rem 1.15rem',
          border: '1px solid rgba(255, 255, 255, 0.85)',
          boxShadow: '0 8px 32px rgba(15, 76, 129, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.95)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Network ICU Beds
            </span>
            <span style={{ fontSize: '1.2rem', padding: '0.2rem 0.5rem', background: '#fffbeb', borderRadius: '8px' }}>🛏️</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
            {networkMetrics.totalIcuAvail} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>/ {networkMetrics.totalIcuCap}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '4px' }}>
            <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                width: `${networkMetrics.icuPercent}%`,
                height: '100%',
                background: networkMetrics.icuPercent < 20 ? '#ef4444' : networkMetrics.icuPercent < 45 ? '#f59e0b' : '#10b981',
                borderRadius: '3px'
              }} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>{networkMetrics.icuPercent}% Free</span>
          </div>
        </div>

        {/* Card 3: General & Oxygen Beds */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.84)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '14px',
          padding: '1rem 1.15rem',
          border: '1px solid rgba(255, 255, 255, 0.85)',
          boxShadow: '0 8px 32px rgba(15, 76, 129, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.95)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Ward & Emergency Beds
            </span>
            <span style={{ fontSize: '1.2rem', padding: '0.2rem 0.5rem', background: '#ecfdf5', borderRadius: '8px' }}>🫁</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
            {networkMetrics.totalGenAvail} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>/ {networkMetrics.totalGenCap}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '4px' }}>
            <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                width: `${networkMetrics.genPercent}%`,
                height: '100%',
                background: '#10b981',
                borderRadius: '3px'
              }} />
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a' }}>{networkMetrics.genPercent}% Ready</span>
          </div>
        </div>

        {/* Card 4: Blood Reserves */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.84)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '14px',
          padding: '1rem 1.15rem',
          border: '1px solid rgba(255, 255, 255, 0.85)',
          boxShadow: '0 8px 32px rgba(15, 76, 129, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.95)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Total Blood Stocked
            </span>
            <span style={{ fontSize: '1.2rem', padding: '0.2rem 0.5rem', background: '#fef2f2', borderRadius: '8px' }}>🩸</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#dc2626' }}>
            {networkMetrics.totalBloodUnits} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Units</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
            All 8 regional blood groups active
          </div>
        </div>

        {/* Card 5: Specialists On Duty */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.84)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '14px',
          padding: '1rem 1.15rem',
          border: '1px solid rgba(255, 255, 255, 0.85)',
          boxShadow: '0 8px 32px rgba(15, 76, 129, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.95)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Specialists On-Duty
            </span>
            <span style={{ fontSize: '1.2rem', padding: '0.2rem 0.5rem', background: '#f5f3ff', borderRadius: '8px' }}>👨‍⚕️</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#7c3aed' }}>
            {networkMetrics.totalSpecialists} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Doctors</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
            Emergency triage & surgery ready
          </div>
        </div>
      </div>

      {/* 3. Filter, Search & Capability Control Toolbar */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '16px',
        padding: '0.9rem 1.25rem',
        border: '1px solid rgba(255, 255, 255, 0.9)',
        boxShadow: '0 8px 32px rgba(15, 76, 129, 0.05), inset 0 1px 1px rgba(255, 255, 255, 0.95)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.85rem',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Left: Search input */}
        <div style={{ position: 'relative', minWidth: '260px', flex: '1 1 280px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', color: '#94a3b8' }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Search by hospital name, address, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.85rem 0.5rem 2.25rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Middle: Status Filter Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginRight: '2px' }}>Status:</span>
          {[
            { id: 'all', label: `All (${hospitals.length})` },
            { id: 'operational', label: '🟢 Operational' },
            { id: 'limited', label: '🟡 Busy' },
            { id: 'diverting', label: '🔴 Diverting' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              style={{
                background: statusFilter === item.id ? '#1e293b' : '#f1f5f9',
                color: statusFilter === item.id ? '#ffffff' : '#475569',
                border: 'none',
                borderRadius: '20px',
                padding: '0.3rem 0.7rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right: Capability Filters & Sort */}
        <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setFilterOnlyIcu(!filterOnlyIcu)}
            style={{
              background: filterOnlyIcu ? '#CCFBF1' : '#F8FAFC',
              color: filterOnlyIcu ? '#0F766E' : '#475569',
              border: filterOnlyIcu ? '1px solid #14B8A6' : '1px solid #E2E8F0',
              borderRadius: '20px',
              padding: '0.3rem 0.65rem',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
          >
            <span>🛏️</span>
            <span>ICU Available</span>
          </button>

          <button
            onClick={() => setFilterOnlyBlood(!filterOnlyBlood)}
            style={{
              background: filterOnlyBlood ? '#fee2e2' : '#f8fafc',
              color: filterOnlyBlood ? '#dc2626' : '#475569',
              border: filterOnlyBlood ? '1px solid #fca5a5' : '1px solid #cbd5e1',
              borderRadius: '20px',
              padding: '0.3rem 0.65rem',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
          >
            <span>🩸</span>
            <span>Blood Stocked</span>
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.35rem 0.65rem',
              fontSize: '0.76rem',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="name">Sort: Name (A-Z)</option>
            <option value="icu">Sort: Highest Available ICU</option>
            <option value="general">Sort: Highest Available General Beds</option>
            <option value="blood">Sort: Highest Blood Stock</option>
            <option value="specialists">Sort: Most Specialists On-Duty</option>
          </select>
        </div>
      </div>

      {/* 4. Admin Main Body: Mode-Dependent Views (Grid or Table only) */}

      {/* MODE 1: VISUAL CARD GRID VIEW */}
      {viewMode === 'grid' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '1.25rem'
        }}>
          {filteredHospitals.map((hosp) => {
            const category = getHospitalCategory(hosp.name);
            const icuAvail = Number(hosp.icu_available || 0);
            const icuTot = Number(hosp.icu_total || 0);
            const icuPct = icuTot > 0 ? Math.round((icuAvail / icuTot) * 100) : 0;

            const genAvail = Number(hosp.general_available || 0);
            const genTot = Number(hosp.general_total || 0);
            const genPct = genTot > 0 ? Math.round((genAvail / genTot) * 100) : 0;

            const isOperational = (hosp.operational_status || '').toLowerCase() === 'operational';
            const isLimited = (hosp.operational_status || '').toLowerCase() === 'limited';

            // Corrected Google Maps Location Pin Link
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${hosp.latitude},${hosp.longitude}`;

            return (
              <div
                key={hosp.id}
                style={{
                  ...glassCardStyle,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                {/* Top strip with category and status */}
                <div style={{ padding: '1.15rem 1.25rem 0.75rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.45rem' }}>
                    <span style={{
                      background: category.bg,
                      color: category.color,
                      border: `1px solid ${category.border}`,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      fontWeight: 700
                    }}>
                      {category.label}
                    </span>

                    <span style={{
                      background: isOperational ? '#dcfce7' : isLimited ? '#fef3c7' : '#fee2e2',
                      color: isOperational ? '#15803d' : isLimited ? '#b45309' : '#b91c1c',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '20px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: isOperational ? '#16a34a' : isLimited ? '#d97706' : '#dc2626'
                      }} />
                      {hosp.operational_status || 'operational'}
                    </span>
                  </div>

                  {/* Hospital Name & Verified Address */}
                  <h3 style={{
                    margin: '0.2rem 0 0.35rem 0',
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    lineHeight: 1.3
                  }}>
                    {hosp.name}
                  </h3>

                  <p style={{
                    margin: '0 0 0.75rem 0',
                    fontSize: '0.8rem',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.35rem',
                    lineHeight: 1.35
                  }}>
                    <span style={{ fontSize: '0.85rem' }}>📍</span>
                    <span>{hosp.address}</span>
                  </p>

                  {/* Contact & Corrected GPS Pills */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                    {hosp.phone && (
                      <a
                        href={`tel:${hosp.phone}`}
                        style={{
                          background: '#f8fafc',
                          color: '#334155',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <span>📞</span>
                        <span>{hosp.phone}</span>
                      </a>
                    )}
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: '#F0FDFA',
                        color: '#0F766E',
                        border: '1px solid #99F6E4',
                        borderRadius: '6px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                      title="Open verified location in Google Maps"
                    >
                      <span>🌐</span>
                      <span>{Number(hosp.latitude).toFixed(4)}, {Number(hosp.longitude).toFixed(4)} (Maps)</span>
                    </a>
                  </div>

                  {/* LIVE CAPACITY GAUGES */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '10px',
                    padding: '0.75rem 0.85rem',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem'
                  }}>
                    {/* ICU Bed Gauge */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span>🛏️</span>
                          <span>ICU Critical Care Beds</span>
                        </span>
                        <span style={{ fontWeight: 800, color: icuAvail === 0 ? '#dc2626' : '#0f172a' }}>
                          {icuAvail} / {icuTot} <span style={{ fontWeight: 500, color: '#64748b' }}>({icuPct}%)</span>
                        </span>
                      </div>
                      <div style={{ height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, Math.max(0, icuPct))}%`,
                          height: '100%',
                          background: icuPct < 15 ? '#ef4444' : icuPct < 35 ? '#f59e0b' : '#10b981',
                          borderRadius: '4px'
                        }} />
                      </div>
                    </div>

                    {/* General Ward Beds Gauge */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span>🫁</span>
                          <span>General & Ward Beds</span>
                        </span>
                        <span style={{ fontWeight: 800, color: '#0f172a' }}>
                          {genAvail} / {genTot} <span style={{ fontWeight: 500, color: '#64748b' }}>({genPct}%)</span>
                        </span>
                      </div>
                      <div style={{ height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, Math.max(0, genPct))}%`,
                          height: '100%',
                          background: '#0F4C81',
                          borderRadius: '4px'
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* MICRO TELEMETRY BADGES ROW */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.5rem',
                    marginTop: '0.75rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ background: '#fdf2f2', padding: '0.45rem', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                      <span style={{ fontSize: '0.68rem', color: '#991b1b', display: 'block', fontWeight: 600 }}>Blood Units</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#dc2626' }}>{hosp.blood_units_total || 0}</span>
                    </div>
                    <div style={{ background: '#f0fdf4', padding: '0.45rem', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                      <span style={{ fontSize: '0.68rem', color: '#166534', display: 'block', fontWeight: 600 }}>Ventilators</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#15803d' }}>{hosp.ventilators_available || 0}</span>
                    </div>
                    <div style={{ background: '#f5f3ff', padding: '0.45rem', borderRadius: '8px', border: '1px solid #ede9fe' }}>
                      <span style={{ fontSize: '0.68rem', color: '#6b21a8', display: 'block', fontWeight: 600 }}>Specialists</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#7c3aed' }}>{hosp.specialists_on_duty || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div style={{
                  padding: '0.75rem 1.25rem',
                  background: '#f8fafc',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  gap: '0.45rem',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', gap: '0.4rem', flex: 1 }}>
                    <button
                      onClick={() => onOpenDetails && onOpenDetails(hosp.id)}
                      style={{
                        flex: 1,
                        background: '#0F4C81',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <span>🩺</span>
                      <span>Beds, Doctors & Blood →</span>
                    </button>

                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: '#ffffff',
                        color: '#1e293b',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '0.45rem 0.65rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                      title="Open verified location in Google Maps"
                    >
                      <span>🗺️</span>
                    </a>
                  </div>

                  <button
                    onClick={() => onDeleteHospital && onDeleteHospital(hosp)}
                    style={{
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: '1px solid #fca5a5',
                      borderRadius: '8px',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    title="Admin: Remove hospital from regional network"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODE 2: TACTICAL MATRIX TABLE VIEW */}
      {viewMode === 'table' && (
        <div style={{
          ...glassCardStyle,
          overflowX: 'auto'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Facility & Category</th>
                <th style={{ padding: '0.85rem 0.75rem' }}>Status</th>
                <th style={{ padding: '0.85rem 0.75rem' }}>ICU Beds</th>
                <th style={{ padding: '0.85rem 0.75rem' }}>General Ward</th>
                <th style={{ padding: '0.85rem 0.75rem' }}>Ventilators</th>
                <th style={{ padding: '0.85rem 0.75rem' }}>Blood Stock</th>
                <th style={{ padding: '0.85rem 0.75rem' }}>Specialists</th>
                <th style={{ padding: '0.85rem 0.75rem' }}>Phone & GPS</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHospitals.map((hosp, idx) => {
                const category = getHospitalCategory(hosp.name);
                const icuAvail = Number(hosp.icu_available || 0);
                const icuTot = Number(hosp.icu_total || 0);
                const icuPct = icuTot > 0 ? Math.round((icuAvail / icuTot) * 100) : 0;
                const isOperational = (hosp.operational_status || '').toLowerCase() === 'operational';
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${hosp.latitude},${hosp.longitude}`;

                return (
                  <tr
                    key={hosp.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: idx % 2 === 0 ? '#ffffff' : '#fbfcfd'
                    }}
                  >
                    {/* Name & Category */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>{hosp.name}</div>
                      <span style={{
                        display: 'inline-block',
                        background: category.bg,
                        color: category.color,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        marginTop: '3px'
                      }}>
                        {category.label}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '0.85rem 0.75rem' }}>
                      <span style={{
                        background: isOperational ? '#dcfce7' : '#fee2e2',
                        color: isOperational ? '#15803d' : '#dc2626',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '20px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        textTransform: 'uppercase'
                      }}>
                        {hosp.operational_status || 'operational'}
                      </span>
                    </td>

                    {/* ICU Beds */}
                    <td style={{ padding: '0.85rem 0.75rem' }}>
                      <strong style={{ color: icuAvail === 0 ? '#dc2626' : '#0f172a' }}>{icuAvail}</strong> / {icuTot}
                      <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '4px' }}>({icuPct}%)</span>
                    </td>

                    {/* General Ward */}
                    <td style={{ padding: '0.85rem 0.75rem' }}>
                      <strong>{hosp.general_available || 0}</strong> / {hosp.general_total || 0}
                    </td>

                    {/* Ventilators */}
                    <td style={{ padding: '0.85rem 0.75rem' }}>
                      <span style={{ color: '#059669', fontWeight: 700 }}>{hosp.ventilators_available || 0}</span> / {hosp.ventilators_total || 0}
                    </td>

                    {/* Blood Units */}
                    <td style={{ padding: '0.85rem 0.75rem' }}>
                      <span style={{ color: '#dc2626', fontWeight: 800 }}>{hosp.blood_units_total || 0}</span> Units
                    </td>

                    {/* Specialists */}
                    <td style={{ padding: '0.85rem 0.75rem' }}>
                      <span style={{ color: '#7c3aed', fontWeight: 800 }}>{hosp.specialists_on_duty || 0}</span> on duty
                    </td>

                    {/* Phone & GPS */}
                    <td style={{ padding: '0.85rem 0.75rem' }}>
                      <div style={{ fontSize: '0.76rem', color: '#334155', fontWeight: 600 }}>{hosp.phone || 'N/A'}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{Number(hosp.latitude).toFixed(4)}, {Number(hosp.longitude).toFixed(4)}</div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => onOpenDetails && onOpenDetails(hosp.id)}
                          style={{
                            background: '#0F4C81',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Inspect →
                        </button>
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            background: '#f1f5f9',
                            color: '#1e293b',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '0.35rem 0.55rem',
                            fontSize: '0.75rem',
                            textDecoration: 'none'
                          }}
                          title="Open verified location in Google Maps"
                        >
                          🗺️
                        </a>
                        <button
                          onClick={() => onDeleteHospital && onDeleteHospital(hosp)}
                          style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            borderRadius: '6px',
                            padding: '0.35rem 0.55rem',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                          title="Delete Hospital"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
