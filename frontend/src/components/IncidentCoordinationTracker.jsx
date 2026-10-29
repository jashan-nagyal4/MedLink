/**
 * MedLink Real-Time Incident Coordination & Escalation Tracker
 * 
 * 1. Real-time display of incident status updates.
 * 2. Visual tracking of contacted hospitals and their status (pending, accepted, rejected, timed-out).
 * 3. Interactive ranked hospital list with detailed resource and clinical capability inspection.
 * 4. Real-time countdown timer bar for active dispatch requests.
 * 5. Simulation controls for hospital responses (Accept, Decline, Timeout) and supervisor manual override.
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getCoordinationState,
  startDispatch,
  respondToDispatch,
  cancelDispatch,
  getHospitalDetails,
  deleteIncident
} from '../api';
import {
  onDispatchRequest,
  onHospitalAccepted,
  onHospitalRejected,
  onDispatchTimeout,
  onIncidentEscalated,
  onIncidentExhausted,
  onIncidentStatusChange
} from '../socket';

export default function IncidentCoordinationTracker({ incidentId, onClose, onUpdated }) {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Active countdown timer state (in seconds)
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [timerTotal, setTimerTotal] = useState(45);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Inspected hospital for detail drawer
  const [inspectedHospital, setInspectedHospital] = useState(null);
  const [inspectedDetails, setInspectedDetails] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('Emergency Department and ICU at full capacity');

  const timerIntervalRef = useRef(null);

  // 1. Fetch full coordination state from backend
  const fetchState = async () => {
    try {
      setError('');
      const data = await getCoordinationState(incidentId);
      setState(data);

      if (data.timer && data.timer.isActive) {
        setSecondsRemaining(data.timer.secondsRemaining);
        setTimerTotal(data.timer.timeoutSeconds || 45);
        setIsTimerActive(true);
      } else {
        setIsTimerActive(false);
        setSecondsRemaining(0);
      }
    } catch (err) {
      setError('Failed to fetch coordination state: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, [incidentId]);

  // 2. Local countdown ticker (runs every 1000ms when timer is active)
  useEffect(() => {
    if (isTimerActive && secondsRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            setIsTimerActive(false);
            // Refresh state to catch server-side timeout transition
            setTimeout(fetchState, 600);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }

    return () => clearInterval(timerIntervalRef.current);
  }, [isTimerActive, secondsRemaining]);

  // 3. Real-Time Socket.IO Subscriptions
  useEffect(() => {
    const unsubReq = onDispatchRequest((data) => {
      if (Number(data.incidentId) === Number(incidentId)) {
        console.log('⚡ [Tracker] Caught real-time dispatch_request event:', data);
        fetchState();
      }
    });

    const unsubAcc = onHospitalAccepted((data) => {
      if (Number(data.incidentId) === Number(incidentId)) {
        console.log('⚡ [Tracker] Caught real-time hospital accepted event:', data);
        setIsTimerActive(false);
        setSecondsRemaining(0);
        fetchState();
        if (onUpdated) onUpdated();
      }
    });

    const unsubRej = onHospitalRejected((data) => {
      if (Number(data.incidentId) === Number(incidentId)) {
        console.log('⚡ [Tracker] Caught real-time hospital rejected event:', data);
        fetchState();
      }
    });

    const unsubTime = onDispatchTimeout((data) => {
      if (Number(data.incidentId) === Number(incidentId)) {
        console.log('⚡ [Tracker] Caught real-time timeout event:', data);
        fetchState();
      }
    });

    const unsubEsc = onIncidentEscalated((data) => {
      if (Number(data.incidentId) === Number(incidentId)) {
        console.log('⚡ [Tracker] Caught real-time escalated event:', data);
        fetchState();
      }
    });

    const unsubExh = onIncidentExhausted((data) => {
      if (Number(data.incidentId) === Number(incidentId)) {
        console.log('⚡ [Tracker] Caught real-time exhausted alert:', data);
        setIsTimerActive(false);
        fetchState();
      }
    });

    const unsubStat = onIncidentStatusChange((data) => {
      if (Number(data.incidentId) === Number(incidentId)) {
        fetchState();
      }
    });

    return () => {
      unsubReq();
      unsubAcc();
      unsubRej();
      unsubTime();
      unsubEsc();
      unsubExh();
      unsubStat();
    };
  }, [incidentId]);

  // 4. Action Handlers
  const handleStartDispatch = async (timeoutSec = 45) => {
    setActionLoading(true);
    try {
      await startDispatch(incidentId, { timeoutSeconds: timeoutSec });
      await fetchState();
      if (onUpdated) onUpdated();
    } catch (err) {
      alert('Failed to start dispatch: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulateAccept = async (hospitalId) => {
    setActionLoading(true);
    try {
      await respondToDispatch(incidentId, {
        hospitalId,
        action: 'accept',
        reason: 'Confirmed: Emergency team deployed, resuscitation bay ready'
      });
      await fetchState();
      if (onUpdated) onUpdated();
    } catch (err) {
      alert('Accept error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulateReject = async (hospitalId) => {
    setActionLoading(true);
    try {
      await respondToDispatch(incidentId, {
        hospitalId,
        action: 'reject',
        reason: rejectReason
      });
      setShowRejectModal(false);
      await fetchState();
      if (onUpdated) onUpdated();
    } catch (err) {
      alert('Reject error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelDispatch = async () => {
    if (!window.confirm('Are you sure you want to cancel dispatch for this emergency incident?')) return;
    setActionLoading(true);
    try {
      await cancelDispatch(incidentId, 'Cancelled by emergency command supervisor');
      await fetchState();
      if (onUpdated) onUpdated();
    } catch (err) {
      alert('Cancel error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleInspectHospital = async (hosp) => {
    setInspectedHospital(hosp);
    setInspectLoading(true);
    try {
      const details = await getHospitalDetails(hosp.hospitalId || hosp.id);
      setInspectedDetails(details);
    } catch (err) {
      console.warn('Could not load detailed hospital inventory:', err.message);
      setInspectedDetails(null);
    } finally {
      setInspectLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" style={{ maxWidth: '900px', textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: '1.1rem', color: '#64748b' }}>Loading live incident coordination state & audit logs...</p>
        </div>
      </div>
    );
  }

  const incident = state?.incident;
  const logs = state?.logs || [];
  const rankedHospitals = state?.rankedHospitals || [];
  const timer = state?.timer;

  // Active hospital currently receiving the request
  const currentHospital = rankedHospitals.find(
    (h) => (h.hospitalId || h.id) === Number(incident?.current_dispatch_hospital_id)
  ) || (timer ? { name: timer.hospitalName, id: timer.hospitalId } : null);

  // Delete Incident handler (Hospital Manager & Admin)
  const handleDeleteThisIncident = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete emergency incident #${incident?.incident_number}?`)) {
      return;
    }
    setActionLoading(true);
    try {
      await deleteIncident(incidentId);
      alert(`✓ Emergency incident #${incident?.incident_number} deleted.`);
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const timerPercent = timerTotal > 0 ? Math.max(0, Math.min(100, (secondsRemaining / timerTotal) * 100)) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '980px', maxHeight: '92vh', overflowY: 'auto', padding: '1.75rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 800 }}>
                REAL-TIME DISPATCH COORDINATION STATION
              </span>
              <span className={`status-badge status-${incident?.status}`}>
                {incident?.status?.toUpperCase()}
              </span>
              {incident?.escalation_level > 0 && (
                <span className="badge" style={{ background: '#fed7aa', color: '#9a3412', fontWeight: 700 }}>
                  ⚡ Escalation Level #{incident.escalation_level}
                </span>
              )}
            </div>

            <h2 className="modal-title" style={{ fontSize: '1.4rem' }}>
              Incident #{incident?.incident_number} — {incident?.condition_category?.toUpperCase()}
            </h2>

            <p style={{ margin: '0.2rem 0 0', fontSize: '0.88rem', color: '#475569' }}>
              👤 <strong>{incident?.patient_name || 'Unidentified'}</strong> ({incident?.patient_age || '?'} yo, {incident?.patient_gender || 'unknown'})
              {' · '}📍 {incident?.address}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {user?.role !== 'patient' && (
              <button
                className="hosp-btn"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', fontWeight: 700 }}
                onClick={handleDeleteThisIncident}
                title="Permanently delete incident"
              >
                🗑️ Delete Incident
              </button>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '0.85rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* 1. Active Coordination Banner (State-specific) */}
        {incident?.status === 'requested' && currentHospital && (
          <div style={{
            background: '#F0FDFA',
            border: '2px solid #14B8A6',
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 14px rgba(20, 184, 166, 0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: '#CCFBF1',
                  color: '#0F766E',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  marginBottom: '0.4rem'
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#14B8A6', animation: 'pulse 1.5s infinite' }}></span>
                  Contacting Receiving Facility
                </span>
                <h3 style={{ margin: '0.15rem 0', fontSize: '1.25rem', color: '#0f172a' }}>
                  🏥 {currentHospital.name} (Rank #{timer?.rankPosition || currentHospital.rank || 1})
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#475569' }}>
                  Awaiting acknowledgement & emergency bed confirmation from hospital triage desk...
                </p>
              </div>

              {/* Countdown Timer Display */}
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 900,
                  fontVariantNumeric: 'tabular-nums',
                  color: secondsRemaining <= 10 ? '#dc2626' : '#0F4C81'
                }}>
                  {secondsRemaining}s
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Until Auto-Escalation
                </span>
              </div>
            </div>

            {/* Visual Animated Countdown Progress Bar */}
            <div style={{
              width: '100%',
              height: '8px',
              background: '#e2e8f0',
              borderRadius: '999px',
              overflow: 'hidden',
              marginTop: '1rem'
            }}>
              <div style={{
                height: '100%',
                width: `${timerPercent}%`,
                background: secondsRemaining <= 10 ? '#ef4444' : '#14B8A6',
                transition: 'width 1s linear, background-color 0.3s ease'
              }}></div>
            </div>

            {/* Hospital Terminal Simulation Actions (Central Admin Only - Hidden from Citizens & Hospital Managers) */}
            {user?.role === 'admin' ? (
              <div style={{
                marginTop: '1rem',
                paddingTop: '0.85rem',
                borderTop: '1px solid #bfdbfe',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <span style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: 600 }}>
                  💡 <strong>Hospital Terminal Simulator:</strong> Test response flow as {currentHospital.name}:
                </span>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn-primary"
                    style={{ background: '#16a34a', padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
                    disabled={actionLoading}
                    onClick={() => handleSimulateAccept(currentHospital.hospitalId || currentHospital.id)}
                  >
                    ✓ Accept Emergency
                  </button>
                  <button
                    className="hosp-btn"
                    style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
                    disabled={actionLoading}
                    onClick={() => setShowRejectModal(true)}
                  >
                    ✕ Decline (Triggers Escalation)
                  </button>
                  <button
                    className="hosp-btn"
                    style={{ background: '#ffffff', color: '#64748b', border: '1px solid #cbd5e1', padding: '0.4rem 0.65rem', fontSize: '0.82rem' }}
                    disabled={actionLoading}
                    onClick={handleCancelDispatch}
                  >
                    🛑 Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                fontSize: '0.84rem',
                color: '#1e40af'
              }}>
                <span style={{ fontSize: '1.25rem' }}>🚑</span>
                <div>
                  <strong>Ambulance Dispatch Managed by Hospital Network</strong>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#0F4C81' }}>
                    Triage coordinators at candidate hospitals are reviewing requirements and locking admission.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Accepted / Assigned State Banner */}
        {incident?.status === 'assigned' && (
          <div style={{
            background: '#f0fdf4',
            border: '2px solid #22c55e',
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 14px rgba(34, 197, 94, 0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 800, marginBottom: '0.3rem' }}>
                  ✓ DISPATCH CONFIRMED & ALLOCATED
                </span>
                <h3 style={{ margin: '0.2rem 0', fontSize: '1.25rem', color: '#14532d' }}>
                  🚑 Assigned Facility: {incident?.assigned_hospital_name || 'Hospital Confirmed'}
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#166534' }}>
                  Emergency patient en route. Triage bay and required specialists have locked availability.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {user?.role !== 'patient' && (
                  <button
                    className="hosp-btn"
                    style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem', background: '#ffffff', color: '#15803d', border: '1px solid #86efac' }}
                    onClick={() => handleStartDispatch(45)}
                    disabled={actionLoading}
                  >
                    Re-dispatch / Override ↺
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. Exhausted State Banner */}
        {incident?.status === 'exhausted' && (
          <div style={{
            background: '#fef2f2',
            border: '2px solid #ef4444',
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.2)'
          }}>
            <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 800, marginBottom: '0.4rem' }}>
              🚨 CRITICAL SUPERVISOR ALERT: ALL HOSPITALS EXHAUSTED
            </span>
            <h3 style={{ margin: '0.25rem 0', fontSize: '1.2rem', color: '#7f1d1d' }}>
              All {rankedHospitals.length} candidate receiving hospitals in the region have declined or timed out.
            </h3>
            <p style={{ margin: '0.25rem 0 0.85rem', fontSize: '0.85rem', color: '#991b1b' }}>
              Immediate emergency command intervention required: contact regional air ambulance, triage center, or manually override capacity constraints.
            </p>
            <button
              className="btn-primary"
              style={{ background: '#b91c1c', fontSize: '0.85rem', padding: '0.45rem 1rem' }}
              disabled={actionLoading}
              onClick={() => handleStartDispatch(60)}
            >
              🔄 Re-attempt Dispatch to Rank #1 Hospital
            </button>
          </div>
        )}

        {/* 4. Initial Reported / Idle State Banner */}
        {['reported', 'assessing'].includes(incident?.status) && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                Automated Triage Complete · Ready for Allocation
              </h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Launch the Finite State Machine (FSM) engine to dispatch to the highest-scoring hospital with automatic timeout escalation.
              </p>
            </div>
            {user?.role !== 'patient' ? (
              <button
                className="btn-primary"
                style={{ background: '#0F4C81', padding: '0.6rem 1.25rem', fontSize: '0.9rem', fontWeight: 700 }}
                disabled={actionLoading}
                onClick={() => handleStartDispatch(45)}
              >
                ⚡ Start Automated Dispatch (Rank #1)
              </button>
            ) : (
              <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700 }}>
                ⏳ MedLink Dispatch Engine Active
              </span>
            )}
          </div>
        )}

        {/* Main Section: Ranked Hospital Allocation Ladder */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
              🏥 Multi-Criteria Ranked Hospital Queue ({rankedHospitals.length})
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Click any hospital to inspect live bed & specialist inventory
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {rankedHospitals.map((hosp) => {
              const hospId = Number(hosp.hospitalId || hosp.id);
              const isCurrent = hospId === Number(incident?.current_dispatch_hospital_id);
              const isAssigned = hospId === Number(incident?.assigned_hospital_id);

              let statusColor = '#64748b';
              let statusBg = '#f1f5f9';
              let statusLabel = 'QUEUED';

              if (hosp.dispatchStatus === 'accepted' || isAssigned) {
                statusColor = '#15803d';
                statusBg = '#dcfce7';
                statusLabel = '✓ ACCEPTED';
              } else if (hosp.dispatchStatus === 'pending' || isCurrent) {
                statusColor = '#0F766E';
                statusBg = '#CCFBF1';
                statusLabel = '⏳ CONTACTING NOW';
              } else if (hosp.dispatchStatus === 'rejected') {
                statusColor = '#991b1b';
                statusBg = '#fee2e2';
                statusLabel = '✕ REJECTED';
              } else if (hosp.dispatchStatus === 'timed_out') {
                statusColor = '#c2410c';
                statusBg = '#ffedd5';
                statusLabel = '⏰ TIMED OUT';
              }

              return (
                <div
                  key={hospId}
                  style={{
                    border: isAssigned
                      ? '2px solid #22c55e'
                      : isCurrent
                      ? '2px solid #14B8A6'
                      : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1rem',
                    background: isAssigned
                      ? '#f0fdf4'
                      : isCurrent
                      ? '#f8faff'
                      : '#ffffff',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <span style={{
                        background: hosp.rank === 1 ? '#0F4C81' : '#475569',
                        color: '#ffffff',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        flexShrink: 0
                      }}>
                        {hosp.rank}
                      </span>

                      <div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>
                            {hosp.name}
                          </h4>
                          <span style={{
                            background: statusBg,
                            color: statusColor,
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '12px'
                          }}>
                            {statusLabel}
                          </span>
                        </div>

                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                          📍 {hosp.address} · 🚗 {hosp.distanceKm} km (~{hosp.estimatedTravelMinutes} mins)
                        </p>

                        {/* If hospital rejected or timed out, display rationale */}
                        {hosp.responseReason && (
                          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#b91c1c', fontStyle: 'italic' }}>
                            Reason: "{hosp.responseReason}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: hosp.compositeScore >= 80 ? '#16a34a' : '#d97706' }}>
                          {hosp.compositeScore} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>/ 100</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>MATCH SCORE</span>
                      </div>

                      <button
                        className="hosp-btn"
                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                        onClick={() => handleInspectHospital(hosp)}
                      >
                        Inspect Inventory ℹ
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dispatch Audit Trail / Timeline */}
        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ margin: '0 0 0.85rem', fontSize: '0.95rem', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            📜 Event-Driven Coordination Audit Trail ({logs.length} events)
          </h4>

          {logs.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
              No dispatch attempts recorded yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {logs.map((log) => {
                const requestedTime = new Date(log.requested_at).toLocaleTimeString();
                const respondedTime = log.responded_at ? new Date(log.responded_at).toLocaleTimeString() : null;

                return (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#ffffff',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.82rem',
                      flexWrap: 'wrap',
                      gap: '0.4rem'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#0f172a' }}>{log.hospital_name}</strong>
                      <span style={{ color: '#64748b' }}> (Rank #{log.rank_position})</span>
                      <span style={{ margin: '0 0.4rem', color: '#cbd5e1' }}>•</span>
                      <span style={{
                        fontWeight: 700,
                        color: log.status === 'accepted' ? '#15803D' : log.status === 'rejected' ? '#DC2626' : log.status === 'timed_out' ? '#B45309' : '#0F4C81'
                      }}>
                        {log.status.toUpperCase()}
                      </span>
                      {log.response_reason && (
                        <span style={{ color: '#475569', marginLeft: '0.4rem', fontStyle: 'italic' }}>
                          — "{log.response_reason}"
                        </span>
                      )}
                    </div>

                    <div style={{ color: '#64748b', fontSize: '0.78rem' }}>
                      Sent: {requestedTime} {respondedTime ? `· Handled: ${respondedTime}` : `(${log.timeout_seconds}s limit)`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal: Decline / Rejection Reason Simulator */}
        {showRejectModal && (
          <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setShowRejectModal(false)}>
            <div
              className="modal-content"
              style={{ maxWidth: '480px', padding: '1.5rem' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem', color: '#0f172a' }}>
                Simulate Hospital Rejection
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                Provide a clinical or capacity reason for why {currentHospital?.name} cannot accept this incident. Submitting will immediately trigger automatic escalation to Rank #{((timer?.rankPosition || currentHospital?.rank || 1) + 1)}.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {[
                  'Emergency Department and ICU at full capacity',
                  'Trauma OR and On-Call Surgeon occupied with ongoing procedure',
                  'CT Scanner currently offline for emergency maintenance',
                  'No available mechanical ventilators in critical care unit'
                ].map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    style={{
                      textAlign: 'left',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      background: rejectReason === preset ? '#F0FDFA' : '#ffffff',
                      color: rejectReason === preset ? '#0F766E' : '#334155',
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                    onClick={() => setRejectReason(preset)}
                  >
                    • {preset}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  className="hosp-btn"
                  onClick={() => setShowRejectModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  style={{ background: '#dc2626' }}
                  disabled={actionLoading}
                  onClick={() => handleSimulateReject(currentHospital?.hospitalId || currentHospital?.id)}
                >
                  {actionLoading ? 'Escalating…' : 'Confirm Decline & Escalate →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Hospital Resource Inspector */}
        {inspectedHospital && (
          <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setInspectedHospital(null)}>
            <div
              className="modal-content"
              style={{ maxWidth: '620px', padding: '1.5rem' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
                    {inspectedHospital.name}
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                    📍 {inspectedHospital.address} · 📞 {inspectedHospital.phone || 'N/A'}
                  </p>
                </div>
                <button className="modal-close" onClick={() => setInspectedHospital(null)}>✕</button>
              </div>

              {inspectLoading ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading live hospital capacity...</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Equipment & Beds */}
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#334155' }}>
                      🛏️ Hospital Resource & Bed Inventory
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {inspectedDetails?.resources?.map((r) => (
                        <div
                          key={r.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '0.4rem 0.65rem',
                            background: '#f8fafc',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.82rem'
                          }}
                        >
                          <span>{r.resource_type}</span>
                          <strong>
                            <span style={{ color: '#16a34a' }}>{r.available_quantity} available</span> / {r.total_capacity} total
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Specialists */}
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#334155' }}>
                      👨‍⚕️ On-Duty Specialist Roster
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {inspectedDetails?.specialists?.map((s) => (
                        <div
                          key={s.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '0.4rem 0.65rem',
                            background: '#f8fafc',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.82rem'
                          }}
                        >
                          <span>{s.specialty}</span>
                          <strong style={{ color: s.is_on_duty ? '#16a34a' : '#94a3b8' }}>
                            {s.is_on_duty ? `✓ ${s.doctor_count} Doctor(s) On Duty` : 'Off Duty'}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
