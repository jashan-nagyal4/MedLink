/**
 * Patient / Citizen Emergency Portal
 * 
 * Features:
 * 1. 1-Click "🚨 Report Emergency SOS" with automatic GPS and medical triage.
 * 2. Real-time tracking of their filed emergency incidents.
 * 3. Regional emergency directory with 1-click calling for closest hospitals.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyIncidents, getHospitals } from '../api';
import IncidentReportForm from './IncidentReportForm';
import IncidentCoordinationTracker from './IncidentCoordinationTracker';

export default function PatientPortal({ onNavigateTab }) {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [trackingIncidentId, setTrackingIncidentId] = useState(null);

  const loadData = async () => {
    try {
      const [incList, hospList] = await Promise.all([
        getMyIncidents().catch(() => ({ incidents: [] })),
        getHospitals().catch(() => ({ hospitals: [] }))
      ]);
      setIncidents(incList.incidents || []);
      setHospitals(hospList.hospitals || []);
    } catch (err) {
      console.warn('Error loading patient data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Patient Welcome & SOS Emergency Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
        color: '#ffffff',
        borderRadius: '14px',
        padding: '2rem',
        boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.25rem'
      }}>
        <div>
          <span style={{
            background: 'rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            padding: '0.25rem 0.75rem',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            CITIZEN EMERGENCY HELPDESK
          </span>
          <h2 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.75rem', fontWeight: 800 }}>
            Welcome, {user?.name || 'Citizen'}
          </h2>
          <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.95, maxWidth: '520px' }}>
            In an emergency, every second counts. Submit a request to immediately connect to MedLink's automated multi-hospital triage and dispatch network.
          </p>
        </div>

        <button
          onClick={() => setShowReportModal(true)}
          style={{
            background: '#ffffff',
            color: '#b91c1c',
            border: 'none',
            padding: '1rem 1.75rem',
            borderRadius: '10px',
            fontSize: '1.1rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
            transition: 'transform 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          🚨 REQUEST EMERGENCY AMBULANCE
        </button>
      </div>

      {/* Grid: Active Requests Tracking + Nearby Directory */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left Column: My Emergency Incidents */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.84)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.85)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 8px 32px rgba(15, 76, 129, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.95)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
              📋 My Active Emergency Requests ({incidents.length})
            </h3>
            <button className="hosp-btn" style={{ fontSize: '0.78rem' }} onClick={loadData}>
              🔄 Refresh
            </button>
          </div>

          {loading ? (
            <p style={{ color: '#64748b' }}>Checking emergency status...</p>
          ) : incidents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
              <p style={{ fontSize: '1rem', margin: 0 }}>You have no active emergency incidents registered.</p>
              <p style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}>Use the SOS button above if you or someone nearby requires immediate medical assistance.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#dc2626' }}>{inc.incident_number}</strong>
                    <span className="badge" style={{
                      background: inc.status === 'assigned' ? '#dcfce7' : '#CCFBF1',
                      color: inc.status === 'assigned' ? '#15803d' : '#0F766E',
                      fontWeight: 700
                    }}>
                      {inc.status?.toUpperCase()}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155' }}>
                    📍 Location: {inc.address}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                    "{inc.chief_complaint}"
                  </p>

                  {inc.assigned_hospital_name ? (
                    <div style={{ background: '#ecfdf5', padding: '0.4rem 0.65rem', borderRadius: '6px', fontSize: '0.82rem', color: '#065f46', fontWeight: 600 }}>
                      🚑 Dispatched Facility: {inc.assigned_hospital_name}
                    </div>
                  ) : (
                    <div style={{ background: '#F0FDFA', padding: '0.4rem 0.65rem', borderRadius: '6px', fontSize: '0.82rem', color: '#0F766E', fontWeight: 600 }}>
                      ⏳ MedLink Engine is contacting the closest hospital...
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.4rem' }}>
                    <button
                      className="btn-primary"
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', background: '#0F4C81' }}
                      onClick={() => setTrackingIncidentId(inc.id)}
                    >
                      📡 View Incident Details & Tracker →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Emergency Helpline Directory */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.84)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.85)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 8px 32px rgba(15, 76, 129, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.95)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
              📞 Regional Hospital Directory
            </h3>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('hospitals')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0F4C81',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                View Full Directory →
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {hospitals.map((hosp) => (
              <div
                key={hosp.id}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '0.95rem 1.1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div style={{ flex: '1 1 200px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.96rem', color: '#1e293b', fontWeight: 800 }}>
                    {hosp.name}
                  </h4>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.35 }}>
                    📍 {hosp.address}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${hosp.latitude},${hosp.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: '#ffffff',
                      color: '#1e293b',
                      border: '1px solid #cbd5e1',
                      padding: '0.45rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                    title="Open verified location in Google Maps"
                  >
                    <span>🗺️</span>
                    <span>Maps</span>
                  </a>

                  <a
                    href={`tel:${hosp.phone || '108'}`}
                    style={{
                      background: '#0F4C81',
                      color: '#ffffff',
                      padding: '0.45rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <span>📞</span>
                    <span>Call</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Emergency Report Modal */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '850px', maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">🚨 File Emergency SOS Report</h2>
              <button className="modal-close" onClick={() => setShowReportModal(false)}>✕</button>
            </div>
            <IncidentReportForm
              onIncidentCreated={() => {
                setShowReportModal(false);
                loadData();
              }}
            />
          </div>
        </div>
      )}

      {/* Real-time Tracking Modal */}
      {trackingIncidentId && (
        <IncidentCoordinationTracker
          incidentId={trackingIncidentId}
          onClose={() => setTrackingIncidentId(null)}
          onUpdated={loadData}
        />
      )}

    </div>
  );
}
