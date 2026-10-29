/**
 * Hospital Matching & Multi-Criteria Ranking Modal
 * 
 * Displays ranked candidate hospitals based on PostGIS distance,
 * live resource availability, on-duty specialist verification,
 * and data freshness.
 */

import { useState, useEffect } from 'react';
import { getRankedHospitals, assignHospitalToIncident } from '../api';

export default function HospitalMatchModal({ incidentId, onClose, onAssigned }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadRankings() {
      setLoading(true);
      setError('');
      try {
        const res = await getRankedHospitals(incidentId);
        setData(res);
      } catch (err) {
        setError('Failed to calculate hospital rankings: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadRankings();
  }, [incidentId]);

  const handleAssign = async (hospitalId, hospitalName) => {
    setAssigningId(hospitalId);
    try {
      await assignHospitalToIncident(incidentId, hospitalId);
      alert(`✅ Emergency dispatched to ${hospitalName}! Hospital notified.`);
      if (onAssigned) onAssigned();
      onClose();
    } catch (err) {
      alert('Failed to assign hospital: ' + err.message);
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '850px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', marginBottom: '0.35rem' }}>
              MULTI-CRITERIA PROXIMITY MATCHING ENGINE
            </span>
            <h2 className="modal-title">
              Optimal Hospital Allocation for Incident #{data?.incident?.incident_number || incidentId}
            </h2>
            {data?.incident && (
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                📍 {data.incident.address} · Complaint: <em>"{data.incident.chief_complaint}"</em>
              </p>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
            <p style={{ fontSize: '1.1rem' }}>Calculating PostGIS distances & evaluating live medical resources...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px' }}>
            {error}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Required Resources Banner */}
            <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>Standardized Triage Requirements:</strong>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {data.requiredBedsAndEquipment?.map((r, i) => (
                  <span key={i} className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>
                    🏥 {r.required_resource_type} (Qty: {r.required_quantity})
                  </span>
                ))}
                {data.requiredDoctors?.map((d, i) => (
                  <span key={i} className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>
                    👨‍⚕️ {d.required_specialty} (Count: {d.specialist_count})
                  </span>
                ))}
              </div>
            </div>

            {/* Ranked Hospitals List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {data.rankedHospitals?.map((hosp) => (
                <div
                  key={hosp.hospitalId}
                  style={{
                    border: hosp.rank === 1 ? '2px solid #22c55e' : '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    background: hosp.rank === 1 ? '#f0fdf4' : '#ffffff',
                    boxShadow: hosp.rank === 1 ? '0 4px 12px rgba(34, 197, 94, 0.12)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{
                          background: hosp.rank === 1 ? '#16a34a' : '#64748b',
                          color: '#ffffff',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '20px',
                          fontWeight: 800,
                          fontSize: '0.8rem'
                        }}>
                          {hosp.rank === 1 ? '🏆 TOP MATCH (Rank #1)' : `Rank #${hosp.rank}`}
                        </span>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{hosp.name}</h3>
                      </div>

                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                        📍 {hosp.address} · 📞 {hosp.phone || 'No phone'}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '1.4rem',
                        fontWeight: 800,
                        color: hosp.compositeScore >= 80 ? '#16a34a' : hosp.compositeScore >= 50 ? '#d97706' : '#dc2626'
                      }}>
                        {hosp.compositeScore} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>/ 100</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                        COMPOSITE SCORE
                      </span>
                    </div>
                  </div>

                  {/* Distance & Travel Time Bar */}
                  <div style={{
                    display: 'flex',
                    gap: '1.25rem',
                    background: '#ffffff',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    margin: '0.85rem 0',
                    flexWrap: 'wrap',
                    fontSize: '0.85rem'
                  }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Driving Distance:</span>{' '}
                      <strong style={{ color: '#0f172a' }}>{hosp.distanceKm} km</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Est. Transit Time:</span>{' '}
                      <strong style={{ color: '#0F4C81' }}>~{hosp.estimatedTravelMinutes} mins</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Status:</span>{' '}
                      <strong style={{ color: hosp.isEligible ? '#16a34a' : '#dc2626' }}>
                        {hosp.isEligible ? '✓ Fully Eligible' : '⚠️ Deficit Flagged'}
                      </strong>
                    </div>
                  </div>

                  {/* Matching Breakdown Checklist */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', fontSize: '0.82rem' }}>
                    {/* Beds & Equipment match */}
                    <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                      <strong style={{ display: 'block', marginBottom: '0.3rem', color: '#334155' }}>Equipment & Beds:</strong>
                      {hosp.matchedResources?.map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: r.satisfied ? '#166534' : '#991b1b', marginBottom: '0.25rem' }}>
                          <div>
                            <span style={{ textTransform: 'capitalize' }}>{r.resourceType}</span>
                            {r.matchedFacilityResource && r.matchedFacilityResource !== 'None' && r.matchedFacilityResource.toLowerCase() !== r.resourceType.toLowerCase() && (
                              <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '0.35rem' }}>
                                (via {r.matchedFacilityResource})
                              </span>
                            )}
                          </div>
                          <strong>{r.availableQty} available (Need {r.requiredQty}) {r.satisfied ? '✓' : '✕'}</strong>
                        </div>
                      ))}
                    </div>

                    {/* Specialists match */}
                    <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                      <strong style={{ display: 'block', marginBottom: '0.3rem', color: '#334155' }}>On-Duty Specialists:</strong>
                      {hosp.matchedSpecialists?.map((s, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: s.satisfied ? '#166534' : '#991b1b', marginBottom: '0.25rem' }}>
                          <div>
                            <span>{s.specialty}</span>
                            {s.matchedSpecialty && s.matchedSpecialty !== 'None' && s.matchedSpecialty.toLowerCase() !== s.specialty.toLowerCase() && (
                              <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '0.35rem' }}>
                                (via {s.matchedSpecialty})
                              </span>
                            )}
                          </div>
                          <strong>{s.availableCount} on duty {s.satisfied ? '✓' : '✕'}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendation Rationale & Dispatch Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', fontStyle: 'italic', flex: 1, minWidth: '220px' }}>
                      💡 {hosp.recommendationReason}
                    </p>

                    <button
                      className="btn-primary"
                      style={{
                        background: hosp.rank === 1 ? '#15803D' : '#0F4C81',
                        padding: '0.5rem 1rem',
                        fontSize: '0.85rem'
                      }}
                      disabled={assigningId === hosp.hospitalId}
                      onClick={() => handleAssign(hosp.hospitalId, hosp.name)}
                    >
                      {assigningId === hosp.hospitalId ? 'Assigning…' : `🚑 Dispatch to ${hosp.name}`}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
