import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  checkApiHealth,
  getHospitals,
  getHospitalDetails,
  getIncidents,
  updateIncidentStatus,
  deleteIncident,
  deleteHospital,
  spawnSimulatedIncident
} from './api';
import { useAuth } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import HospitalManagerPortal from './components/HospitalManagerPortal';
import PatientPortal from './components/PatientPortal';
import IncidentReportForm from './components/IncidentReportForm';
import HospitalMatchModal from './components/HospitalMatchModal';
import IncidentCoordinationTracker from './components/IncidentCoordinationTracker';
import UserRoleManagement from './components/UserRoleManagement';
import AddHospitalModal from './components/AddHospitalModal';
import AdminAnalyticsDashboard from './components/AdminAnalyticsDashboard';
import CleanDashboard from './components/CleanDashboard';
import UserProfileSection from './components/UserProfileSection';
import LeftDock from './components/LeftDock';
import SimulatorSettingsModal from './components/SimulatorSettingsModal';
import OfflineSyncManager from './components/OfflineSyncManager';
import RegionalHospitalsExplorer from './components/RegionalHospitalsExplorer';
import SystemIntegrationHub from './components/SystemIntegrationHub';
import PerformanceEvaluationHub from './components/PerformanceEvaluationHub';
import medLinkLogo from './assets/logo.png';
import {
  saveHospitalsCache,
  saveIncidentsCache,
  getCachedHospitals,
  getCachedIncidents,
  removeCachedIncident
} from './utils/offlineStorage';
import {
  socket,
  onNewIncident,
  onIncidentStatusChange,
  onIncidentDeleted,
  onHospitalCreated,
  onHospitalDeleted,
  onDispatchRequest,
  onHospitalAccepted,
  onHospitalRejected,
  onDispatchTimeout,
  onIncidentEscalated,
  onIncidentExhausted
} from './socket';
import './App.css';

export default function App() {
  const { user, isAuthenticated, role, logout, login } = useAuth();

  const [activeTab, setActiveTab] = useState('incidents');
  const [apiConnected, setApiConnected] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveAlert, setLiveAlert] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [facilityIncidentsCount, setFacilityIncidentsCount] = useState(0);
  const [showSimulatorSettings, setShowSimulatorSettings] = useState(false);
  const [showSyncCenter, setShowSyncCenter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Live vs Resolved Incidents Filtering
  const liveIncidents = useMemo(() => {
    return incidents.filter((i) => !['arrived', 'closed', 'resolved', 'cancelled', 'transferred'].includes(i.status));
  }, [incidents]);

  const resolvedIncidents = useMemo(() => {
    return incidents.filter((i) => ['arrived', 'closed', 'resolved', 'cancelled', 'transferred'].includes(i.status));
  }, [incidents]);
  
  // Hospital search state
  const [searchTerm, setSearchTerm] = useState('');

  // Selected hospital for modal popup
  const [selectedHospital, setSelectedHospital] = useState(null);

  // Admin Add Hospital Modal state
  const [showAddHospitalModal, setShowAddHospitalModal] = useState(false);

  // Proximity & Resource matching modal
  const [matchingIncidentId, setMatchingIncidentId] = useState(null);

  // Real-time dispatch coordination tracking modal
  const [trackingIncidentId, setTrackingIncidentId] = useState(null);

  // Left Dock state & Real-Time Clock
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Initial Load: Check API and fetch hospitals + incidents with Offline Cache Continuity
  const loadInitialData = useCallback(async () => {
    try {
      await checkApiHealth();
      setApiConnected(true);

      const [hospData, incData] = await Promise.all([
        getHospitals(),
        getIncidents().catch(() => ({ incidents: [] }))
      ]);

      const hospList = hospData.hospitals || [];
      const incList = (incData.incidents || []).filter((i) => {
        const s = (i.status || '').toLowerCase();
        return s !== 'arrived' && s !== 'closed' && s !== 'resolved' && s !== 'cancelled';
      });

      setHospitals(hospList);
      setIncidents(incList);

      // Save to local cache for offline-first resilience (completed cases purged)
      saveHospitalsCache(hospList);
      saveIncidentsCache(incList);
      setError('');
    } catch {
      setApiConnected(false);
      // Restore from local cache when offline or disconnected
      const cachedH = getCachedHospitals();
      const cachedI = getCachedIncidents();
      if (cachedH.length > 0) setHospitals(cachedH);
      if (cachedI.length > 0) setIncidents(cachedI);
      setError('Cannot reach MedLink Backend. Operating seamlessly in Offline-First Cache Mode.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setFacilityIncidentsCount(0);
  }, [user?.id, user?.hospital_id]);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const roleRef = useRef(role);
  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const alertTimeoutRef = useRef(null);

  // Helper to trigger timed live alert
  const triggerLiveAlert = useCallback((message, durationMs = 7000) => {
    setLiveAlert(message);
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    alertTimeoutRef.current = setTimeout(() => {
      setLiveAlert(null);
    }, durationMs);
  }, []);

  // Filter alerts:
  // - NEVER show dispatch notification banners to Admin users
  // - ONLY show to hospital manager if their associated hospital is part of the event
  const shouldShowHospitalAlert = useCallback((eventHospitalIds = []) => {
    const currentUser = userRef.current;
    const currentRole = roleRef.current || currentUser?.role;

    if (currentRole === 'admin') {
      return false;
    }

    if (currentRole !== 'hospital_manager') {
      return false;
    }

    const userHospId = Number(currentUser?.hospital_id);
    if (!userHospId) return false;

    return eventHospitalIds.some((id) => Number(id) === userHospId);
  }, []);

  // 2. Real-Time Socket.IO Listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    function handleConnect() {
      setWsConnected(true);
    }
    function handleDisconnect() {
      setWsConnected(false);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) setWsConnected(true);

    const unsubscribeNew = onNewIncident((data) => {
      console.log('⚡ [WebSocket] Real-time incident event received:', data);
      if (data && data.incident) {
        setIncidents((prev) => {
          if (prev.some((i) => i.id === data.incident.id)) return prev;
          return [data.incident, ...prev];
        });
        if (data.incident.assigned_hospital_id && shouldShowHospitalAlert([data.incident.assigned_hospital_id])) {
          triggerLiveAlert(`🚨 NEW EMERGENCY DISPATCH: ${data.incident.incident_number} (${data.incident.condition_category?.toUpperCase() || 'CRITICAL'}) in ${data.incident.address}`);
        }
      }
    });

    const unsubscribeStatus = onIncidentStatusChange((data) => {
      console.log('⚡ [WebSocket] Real-time status update received:', data);
      const isDone = data.status === 'arrived' || data.status === 'closed' || data.status === 'resolved';
      if (isDone) {
        // Free up cache and local state immediately when case is done
        removeCachedIncident(data.incidentId);
        setIncidents((prev) => prev.filter((i) => Number(i.id) !== Number(data.incidentId)));
      } else {
        setIncidents((prev) =>
          prev.map((i) => (i.id === Number(data.incidentId) ? { ...i, status: data.status, assigned_hospital_id: data.assignedHospitalId } : i))
        );
      }
      loadInitialData();
    });

    const unsubDispatchRequest = onDispatchRequest((data) => {
      if (shouldShowHospitalAlert([data.targetHospitalId])) {
        triggerLiveAlert(`🚨 DISPATCH REQUEST: #${data.incidentNumber} -> Contacting ${data.targetHospitalName} (Rank #${data.rankPosition})`);
      }
      loadInitialData();
    });

    const unsubHospitalAccepted = onHospitalAccepted((data) => {
      if (shouldShowHospitalAlert([data.hospitalId])) {
        triggerLiveAlert(`🎉 DISPATCH ACCEPTED: Incident #${data.incidentId} allocated to ${data.hospitalName}!`);
      }
      loadInitialData();
    });

    const unsubHospitalRejected = onHospitalRejected((data) => {
      if (shouldShowHospitalAlert([data.hospitalId])) {
        triggerLiveAlert(`⚠️ HOSPITAL DECLINED: Incident #${data.incidentId} declined by ${data.hospitalName || 'hospital'} (Auto-Escalating...)`);
      }
      loadInitialData();
    });

    const unsubTimeout = onDispatchTimeout((data) => {
      if (shouldShowHospitalAlert([data.hospitalId])) {
        triggerLiveAlert(`⏰ DISPATCH TIMEOUT: No response from ${data.hospitalName || 'hospital'} on Incident #${data.incidentId} (Auto-Escalating...)`);
      }
      loadInitialData();
    });

    const unsubEscalated = onIncidentEscalated((data) => {
      if (shouldShowHospitalAlert([data.previousHospitalId, data.newHospitalId])) {
        triggerLiveAlert(`⚡ AUTO-ESCALATED: Incident #${data.incidentId} escalated to Rank #${data.newRank} (${data.newHospitalName})`);
      }
      loadInitialData();
    });

    const unsubExhausted = onIncidentExhausted((data) => {
      if (shouldShowHospitalAlert(data.hospitalIds || [])) {
        triggerLiveAlert(`🚨 CRITICAL SUPERVISOR ALERT: Incident #${data.incidentId} exhausted all regional hospitals!`);
      }
      loadInitialData();
    });

    const unsubDeleted = onIncidentDeleted((payload) => {
      const id = typeof payload === 'object' ? payload?.incidentId || payload?.id : payload;
      removeCachedIncident(id);
      setIncidents((prev) => prev.filter((i) => Number(i.id) !== Number(id)));
    });

    const unsubHospCreated = onHospitalCreated(({ hospital }) => {
      setHospitals((prev) => {
        if (prev.some((h) => Number(h.id) === Number(hospital.id))) return prev;
        return [...prev, hospital].sort((a, b) => a.name.localeCompare(b.name));
      });
    });

    const unsubHospDeleted = onHospitalDeleted(({ hospitalId }) => {
      setHospitals((prev) => prev.filter((h) => Number(h.id) !== Number(hospitalId)));
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
      unsubscribeNew();
      unsubscribeStatus();
      unsubDeleted();
      unsubHospCreated();
      unsubHospDeleted();
      unsubDispatchRequest();
      unsubHospitalAccepted();
      unsubHospitalRejected();
      unsubTimeout();
      unsubEscalated();
      unsubExhausted();
    };
  }, [isAuthenticated, loadInitialData, shouldShowHospitalAlert, triggerLiveAlert]);

  // If user is not authenticated, render Login Page
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Open Hospital Details Modal
  const handleOpenDetails = async (id) => {
    try {
      const data = await getHospitalDetails(id);
      setSelectedHospital(data);
    } catch (err) {
      alert('Failed to load hospital details: ' + err.message);
    }
  };

  const filteredHospitals = hospitals.filter(
    (h) =>
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="app-shell">
      {/* Sleek Left Dock (Command Center Sidebar) */}
      <LeftDock
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role={role}
        user={user}
        hospitalsCount={hospitals.length}
        incidentsCount={role === 'hospital_manager' ? facilityIncidentsCount : liveIncidents.length}
        apiConnected={apiConnected}
        wsConnected={wsConnected}
        onQuickIntake={() => {
          if (role === 'admin') setActiveTab('report');
          else if (role === 'patient') window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        collapsed={dockCollapsed}
        setCollapsed={setDockCollapsed}
        onLogout={logout}
      />

      {/* Main Viewport Canvas */}
      <main className="main-canvas">
        {/* Offline-First Banner & Background Sync Manager */}
        <OfflineSyncManager
          isOpen={showSyncCenter}
          onClose={() => setShowSyncCenter(false)}
          onDataRefreshed={loadInitialData}
        />

        {/* Contextual Topbar with Breadcrumb & Real-Time Clock */}
        <header className="canvas-topbar">
          <div className="canvas-breadcrumb">
            <span className="canvas-breadcrumb-root" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
              <img src={medLinkLogo} alt="" style={{ width: '18px', height: '18px', objectFit: 'contain', background: '#FFFFFF', borderRadius: '4px', padding: '1px', verticalAlign: 'middle' }} />
              MedLink CAD
            </span>
            <span className="canvas-breadcrumb-divider">/</span>
            <span className="canvas-breadcrumb-active">
              {activeTab === 'profile'
                ? 'My Profile & Account Security'
                : role === 'admin'
                ? (activeTab === 'dashboard' || activeTab === 'analytics')
                  ? 'Central Analytics & Capacity Dashboard'
                  : activeTab === 'incidents'
                  ? 'Live Dispatch Queue'
                  : activeTab === 'hospitals'
                  ? 'Regional Hospitals Directory'
                  : activeTab === 'report'
                  ? 'Emergency Incident Intake'
                  : activeTab === 'integration'
                  ? 'System Integration & Diagnostics Hub'
                  : 'User & Role Access Management'
                : role === 'hospital_manager'
                ? activeTab === 'dashboard'
                  ? `${user?.hospital_name || 'Hospital'}: Analytics & Capacity Dashboard`
                  : activeTab === 'incidents'
                  ? `${user?.hospital_name || 'Hospital'}: Emergency Incidents`
                  : activeTab === 'beds'
                  ? `${user?.hospital_name || 'Hospital'}: Beds & Equipments`
                  : activeTab === 'doctors'
                  ? `${user?.hospital_name || 'Hospital'}: Duty Doctors & Rosters`
                  : activeTab === 'blood'
                  ? `${user?.hospital_name || 'Hospital'}: Blood Bank & Plasma`
                  : `${user?.hospital_name || 'Hospital'}: Operational Portal`
                : 'Citizen Emergency Intake'}
            </span>
          </div>

          <div className="canvas-topbar-right">
            {/* Live CAD Simulation Stream Indicator & Quick Settings Trigger (Admin Only) */}
            {role === 'admin' && (
              <div
                onClick={() => setShowSimulatorSettings(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '20px',
                  padding: '0.25rem 0.65rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title="Click to open Incident Simulator Settings (Speed, Facility Target, Lifecycle, Spawn)"
              >
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#14B8A6',
                  boxShadow: '0 0 6px #14B8A6'
                }} />
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0F172A' }}>
                  Live CAD Stream
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>⚙️</span>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await spawnSimulatedIncident();
                      loadInitialData();
                    } catch (err) {
                      console.warn('Spawn incident error:', err);
                    }
                  }}
                  style={{
                    background: '#0F4C81',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0.15rem 0.5rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                  title="Immediately inject a realistic emergency incident into the CAD queue"
                >
                  ⚡ Spawn
                </button>
              </div>
            )}

            {/* Offline-First Data Sync Center Trigger (Staff & Admin Only) */}
            {role !== 'patient' && (
              <button
                onClick={() => setShowSyncCenter(true)}
                style={{
                  background: '#F8FAFC',
                  color: '#0F172A',
                  border: '1px solid #E2E8F0',
                  borderRadius: '20px',
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease'
                }}
                title="Open Offline-First Sync Center (Local Cache Telemetry, Outbox & Disconnection Simulator)"
              >
                <span style={{ fontSize: '0.85rem' }}>🔄</span>
                <span>Sync Center</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('profile')}
              style={{
                background: activeTab === 'profile' ? 'rgba(15, 76, 129, 0.08)' : '#FFFFFF',
                color: activeTab === 'profile' ? '#0F4C81' : '#0F172A',
                border: activeTab === 'profile' ? '2px solid #0F4C81' : '1px solid #E2E8F0',
                borderRadius: '20px',
                padding: '0.35rem 0.85rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: activeTab === 'profile' ? '0 2px 8px rgba(15, 76, 129, 0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease'
              }}
              title="My Profile & Account Settings"
            >
              <span style={{ fontSize: '0.95rem' }}>{role === 'admin' ? '🛡️' : role === 'hospital_manager' ? '🏥' : '👤'}</span>
              <span>{user?.name || 'My Profile'}</span>
              <span style={{
                fontSize: '0.68rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                background: activeTab === 'profile' ? 'rgba(15, 76, 129, 0.15)' : '#F1F5F9',
                color: activeTab === 'profile' ? '#0F4C81' : '#64748B',
                fontWeight: 800
              }}>
                {role === 'admin' ? 'Admin' : role === 'hospital_manager' ? 'Manager' : 'Citizen'}
              </span>
            </button>

            <div className="canvas-clock">
              🕒 {currentTime} IST
            </div>
          </div>
        </header>

        {/* Viewport Canvas Body */}
        <div className="canvas-body">
          {/* Live Emergency Push Alert Banner (Only for associated hospital managers, never admin) */}
          {liveAlert && role !== 'admin' && (
            <div style={{
              background: '#fee2e2',
              border: '2px solid #ef4444',
              color: '#991b1b',
              padding: '0.85rem 1.25rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              fontWeight: 700,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
              animation: 'pulse 2s infinite'
            }}>
              <span>{liveAlert}</span>
              <button
                className="hosp-btn"
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', background: '#ffffff', color: '#991b1b' }}
                onClick={() => setLiveAlert(null)}
              >
                ✕ Dismiss
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* USER PROFILE SECTION (AVAILABLE ACROSS ALL USER TIERS)   */}
          {/* ======================================================== */}
          {activeTab === 'profile' ? (
            <UserProfileSection
              onBackToDashboard={() => {
                if (role === 'admin') setActiveTab('dashboard');
                else if (role === 'hospital_manager') setActiveTab('dashboard');
                else setActiveTab('sos');
              }}
            />
          ) : (
            <>
              {/* 1. HOSPITAL MANAGER PORTAL */}
              {role === 'hospital_manager' && (
                <HospitalManagerPortal
                  activeSection={activeTab}
                  onSectionChange={setActiveTab}
                  onIncidentsCountChange={setFacilityIncidentsCount}
                />
              )}

              {/* 2. CITIZEN / PATIENT PORTAL */}
              {role === 'patient' && (
                <>
                  {activeTab === 'hospitals' ? (
                    <RegionalHospitalsExplorer
                      hospitals={hospitals}
                      role={role}
                      onOpenDetails={handleOpenDetails}
                    />
                  ) : (
                    <PatientPortal onNavigateTab={(tab) => setActiveTab(tab)} />
                  )}
                </>
              )}

              {/* 3. CENTRAL DISPATCH ADMIN PORTAL */}
              {role === 'admin' && (
                <>
                  {/* Tab: Central Dispatch Analytics & Capacity Surge */}
                  {(activeTab === 'analytics' || activeTab === 'dashboard') && (
                    <CleanDashboard isAdmin={true} onNavigate={(tab) => setActiveTab(tab)} />
                  )}

          {/* Tab 1: Live Dispatch Queue with Real-Time Tracking */}
          {activeTab === 'incidents' && (
            <section className="section-panel">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Emergency Incident Dispatch & Escalation Queue</h2>
                  <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    Central Command view of active emergency incidents, FSM allocation states, and hospital assignments.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn-primary"
                    style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                    onClick={() => setActiveTab('report')}
                  >
                    ✚ Report New Incident
                  </button>
                </div>
              </div>

              {liveIncidents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#64748b', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🟢</span>
                  <p style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                    Live Dispatch Queue is Clear
                  </p>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '440px', margin: '0 auto 1.25rem' }}>
                    All emergency calls have reached arrival or resolution. Completed cases are purged automatically to free up cache space.
                  </p>
                  <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'center' }}>
                    <button className="btn-primary" onClick={() => setActiveTab('report')} style={{ padding: '0.5rem 1.15rem' }}>
                      ✚ File Incident Report
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {liveIncidents.map((inc) => (
                    <div
                      key={inc.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '1rem',
                        background: '#ffffff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                          <strong style={{ color: '#dc2626', fontSize: '1rem' }}>
                            {inc.incident_number}
                          </strong>
                          <span className="badge" style={{
                            background: inc.severity === 'critical' ? '#fee2e2' : '#fef3c7',
                            color: inc.severity === 'critical' ? '#991b1b' : '#92400e'
                          }}>
                            {inc.severity?.toUpperCase()} · {inc.triage_level?.toUpperCase()}
                          </span>
                          <span className={`status-badge status-${inc.status}`}>
                            {inc.status?.toUpperCase()}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>
                          👤 Patient: {inc.patient_name || 'Unidentified Victim'}
                        </div>

                        <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.2rem' }}>
                          📍 {inc.address} (GPS: {inc.latitude?.toFixed(4)}, {inc.longitude?.toFixed(4)})
                        </div>

                        <div style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic', marginTop: '0.25rem' }}>
                          "{inc.chief_complaint}"
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Reported: {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>

                        {inc.status === 'assigned' && inc.assigned_hospital_name && (
                          <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 700 }}>
                            🚑 Dispatched: {inc.assigned_hospital_name}
                          </span>
                        )}

                        {inc.status === 'requested' && (
                          <span style={{ fontSize: '0.82rem', color: '#0F4C81', fontWeight: 700, animation: 'pulse 1.5s infinite' }}>
                            ⏳ Contacting Hospital (FSM Active)...
                          </span>
                        )}

                        {inc.status === 'escalated' && (
                          <span style={{ fontSize: '0.82rem', color: '#ea580c', fontWeight: 700 }}>
                            ⚡ Auto-Escalating to Next Rank...
                          </span>
                        )}

                        {inc.status === 'exhausted' && (
                          <span style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 800 }}>
                            🚨 All Regional Hospitals Exhausted!
                          </span>
                        )}

                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          <button
                            className="btn-primary"
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', background: '#0f766e' }}
                            onClick={() => setTrackingIncidentId(inc.id)}
                          >
                            📡 Live Coordination Station
                          </button>

                          <button
                            className="hosp-btn"
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                            onClick={() => setMatchingIncidentId(inc.id)}
                          >
                            🎯 MCDM Proximity Ranking
                          </button>

                          <button
                            className="hosp-btn"
                            style={{
                              fontSize: '0.78rem',
                              padding: '0.35rem 0.65rem',
                              background: '#dcfce7',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                              fontWeight: 700
                            }}
                            onClick={async () => {
                              try {
                                await updateIncidentStatus(inc.id, 'resolved', { notes: 'Manually marked as resolved / treatment complete.' });
                                removeCachedIncident(inc.id);
                                setIncidents((prev) => prev.filter((i) => i.id !== inc.id));
                              } catch (err) {
                                alert('Failed to resolve case: ' + err.message);
                              }
                            }}
                            title="Mark this emergency case as resolved and automatically delete from cache"
                          >
                            ✅ Mark Resolved
                          </button>

                          <button
                            className="hosp-btn"
                            style={{
                              fontSize: '0.78rem',
                              padding: '0.35rem 0.65rem',
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fca5a5',
                              fontWeight: 700
                            }}
                            onClick={async () => {
                              if (!window.confirm(`Are you sure you want to permanently delete Incident #${inc.incident_number}? This cannot be undone.`)) return;
                              try {
                                await deleteIncident(inc.id);
                                setIncidents((prev) => prev.filter((i) => i.id !== inc.id));
                              } catch (err) {
                                alert('Failed to delete incident case: ' + err.message);
                              }
                            }}
                            title="Admin: Permanently delete incident case"
                          >
                            🗑️ Delete Case
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Tab 2: Regional Hospitals Explorer & Live Command Directory (Redesigned) */}
          {activeTab === 'hospitals' && (
            <RegionalHospitalsExplorer
              hospitals={hospitals}
              role={role}
              onOpenDetails={handleOpenDetails}
              onAddHospital={() => setShowAddHospitalModal(true)}
              onDeleteHospital={async (hosp) => {
                if (!window.confirm(`Are you sure you want to permanently delete '${hosp.name}' from the regional network? This will remove all capacity records and unassign linked staff.`)) return;
                try {
                  await deleteHospital(hosp.id);
                  setHospitals((prev) => prev.filter((item) => Number(item.id) !== Number(hosp.id)));
                } catch (err) {
                  alert('Failed to delete hospital: ' + err.message);
                }
              }}
            />
          )}

          {/* Tab 3: Report Incident Intake Form (Leaflet Map) */}
          {activeTab === 'report' && (
            <section className="section-panel">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Emergency Incident Reporting & Automated Triage Intake</h2>
                  <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    Interactive Leaflet map pin, clinical triage rules, and vital sign thresholds.
                  </p>
                </div>
              </div>
              <IncidentReportForm
                onIncidentCreated={() => {
                  loadInitialData();
                  setActiveTab('incidents');
                }}
              />
            </section>
          )}

          {/* Tab 4: User & Role Access Management */}
          {activeTab === 'users' && (
            <UserRoleManagement hospitals={hospitals} />
          )}

          {/* Tab 6: System Integration & Diagnostics Hub */}
          {activeTab === 'integration' && (
            <SystemIntegrationHub />
          )}

          {/* Tab 7: System Performance Evaluation & Verification Hub */}
          {activeTab === 'evaluation' && (
            <PerformanceEvaluationHub />
          )}
              </>
            )}
          </>
        )}
        </div>
      </main>

      {/* Hospital Details Modal */}
      {selectedHospital && (
        <div className="modal-overlay" onClick={() => setSelectedHospital(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="badge" style={{ background: '#dcfce7', color: '#166534', marginBottom: '0.35rem' }}>
                  {(selectedHospital.hospital?.operational_status || 'operational').toUpperCase()}
                </span>
                <h2 className="modal-title">{selectedHospital.hospital?.name}</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>📍 {selectedHospital.hospital?.address}</p>
              </div>
              <button className="modal-close" onClick={() => setSelectedHospital(null)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                  🏥 Equipment & Beds
                </h3>
                {selectedHospital.resources.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No resource counts registered.</p>
                ) : (
                  <div className="resource-list">
                    {selectedHospital.resources.map((res) => (
                      <div key={res.id} className="resource-item">
                        <span className="resource-name">{res.resource_type}</span>
                        <span className="resource-qty">{res.available_quantity} / {res.total_quantity} open</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                  👨‍⚕️ Specialists on Duty
                </h3>
                {selectedHospital.specialists.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No specialists registered.</p>
                ) : (
                  <div className="resource-list">
                    {selectedHospital.specialists.map((spec) => (
                      <div key={spec.id} className="resource-item">
                        <div>
                          <span className="resource-name">{spec.specialty}</span>
                          {spec.doctor_name && (
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
                              👨‍⚕️ {spec.doctor_name} · {spec.shift || 'General'}
                            </span>
                          )}
                        </div>
                        <span style={{ fontWeight: 600, color: spec.available ? '#16a34a' : '#94a3b8' }}>
                          {spec.available ? `✓ Available (${spec.count_available})` : '✕ None on duty'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Blood Bank & Plasma Inventory in Details Modal */}
            {selectedHospital.bloodInventory && selectedHospital.bloodInventory.length > 0 && (
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                  🩸 Emergency Blood Bank Reserves
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.5rem' }}>
                  {selectedHospital.bloodInventory.map((b) => (
                    <div
                      key={b.id || b.blood_group}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '0.4rem 0.6rem',
                        textAlign: 'center',
                        background: b.units_available === 0 ? '#fef2f2' : b.units_available < 5 ? '#fffbeb' : '#f0fdf4'
                      }}
                    >
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#991b1b' }}>{b.blood_group}</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{b.units_available} units</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button className="btn-primary" onClick={() => setSelectedHospital(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hospital Match & Allocation Modal */}
      {matchingIncidentId && (
        <HospitalMatchModal
          incidentId={matchingIncidentId}
          onClose={() => setMatchingIncidentId(null)}
          onAssigned={loadInitialData}
        />
      )}

      {/* Real-Time Incident Coordination & Escalation Tracker */}
      {trackingIncidentId && (
        <IncidentCoordinationTracker
          incidentId={trackingIncidentId}
          onClose={() => setTrackingIncidentId(null)}
          onUpdated={loadInitialData}
        />
      )}

      {/* Admin: Add Regional Hospital Modal */}
      {showAddHospitalModal && (
        <AddHospitalModal
          onClose={() => setShowAddHospitalModal(false)}
          onCreated={(newHosp) => {
            setHospitals((prev) => [...prev, newHosp].sort((a, b) => a.name.localeCompare(b.name)));
          }}
        />
      )}

      {/* Incident Simulator Settings Modal (Admin Only) */}
      {role === 'admin' && (
        <SimulatorSettingsModal
          isOpen={showSimulatorSettings}
          onClose={() => setShowSimulatorSettings(false)}
          hospitals={hospitals}
          onIncidentSpawned={loadInitialData}
          onResolvedCleared={loadInitialData}
        />
      )}
    </div>
  );
}
