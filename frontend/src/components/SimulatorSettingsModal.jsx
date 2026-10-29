import React, { useState, useEffect } from 'react';
import {
  getSimulatorStatus,
  toggleSimulator,
  updateSimulatorConfig,
  clearResolvedSimulations,
  spawnSimulatedIncident,
  simulateBedResources,
  simulateBloodResources,
  simulateCrisisScenario
} from '../api';

export default function SimulatorSettingsModal({
  isOpen,
  onClose,
  hospitals = [],
  onIncidentSpawned,
  onResolvedCleared
}) {
  const [activeTab, setActiveTab] = useState('stream'); // 'stream' | 'beds' | 'blood' | 'scenarios'
  const [status, setStatus] = useState({
    isRunning: true,
    intervalSeconds: 45,
    resourceIntervalSeconds: 20,
    bloodIntervalSeconds: 5,
    autoProgress: true,
    autoBeds: true,
    autoBlood: true,
    targetHospitalId: null,
    totalSimulated: 0,
    totalBedFluctuations: 0,
    totalBloodFluctuations: 0,
    recentActivity: [],
    lastSpawnedAt: null,
    lastSpawnedIncident: null
  });
  const [loading, setLoading] = useState(false);
  const [spawning, setSpawning] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [feedback, setFeedback] = useState('');

  // Bed simulation state
  const [bedHospitalId, setBedHospitalId] = useState('all');
  const [selectedBedType, setSelectedBedType] = useState('icu');
  const [bedAmount, setBedAmount] = useState(2);

  // Blood bank simulation state
  const [bloodHospitalId, setBloodHospitalId] = useState('all');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState('all');
  const [bloodAmount, setBloodAmount] = useState(5);

  // Load simulator status when modal opens & poll telemetry every 3s
  useEffect(() => {
    if (!isOpen) return;
    fetchStatus();
    const pollInterval = setInterval(fetchStatus, 3000);
    return () => clearInterval(pollInterval);
  }, [isOpen]);

  const fetchStatus = async () => {
    try {
      const data = await getSimulatorStatus();
      if (data && data.success) {
        setStatus({
          isRunning: data.isRunning,
          intervalSeconds: data.intervalSeconds || 45,
          resourceIntervalSeconds: data.resourceIntervalSeconds || 20,
          bloodIntervalSeconds: data.bloodIntervalSeconds || 5,
          autoProgress: data.autoProgress !== false,
          autoBeds: data.autoBeds !== false,
          autoBlood: data.autoBlood !== false,
          targetHospitalId: data.targetHospitalId || null,
          totalSimulated: data.totalSimulated || 0,
          totalBedFluctuations: data.totalBedFluctuations || 0,
          totalBloodFluctuations: data.totalBloodFluctuations || 0,
          recentActivity: data.recentActivity || [],
          lastSpawnedAt: data.lastSpawnedAt,
          lastSpawnedIncident: data.lastSpawnedIncident
        });
      }
    } catch (err) {
      console.warn('Failed to fetch simulator status:', err);
    }
  };

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 4500);
  };

  const handleToggle = async () => {
    try {
      setLoading(true);
      const res = await toggleSimulator();
      if (res && res.success) {
        setStatus(prev => ({ ...prev, isRunning: res.isRunning }));
        showFeedback(res.isRunning ? '🚀 Autonomous Simulator resumed!' : '⏸️ Autonomous Simulator paused.');
      }
    } catch (err) {
      alert('Error toggling simulator: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyConfig = async (updates) => {
    try {
      setLoading(true);
      const res = await updateSimulatorConfig({
        intervalSeconds: updates.intervalSeconds !== undefined ? updates.intervalSeconds : status.intervalSeconds,
        resourceIntervalSeconds: updates.resourceIntervalSeconds !== undefined ? updates.resourceIntervalSeconds : status.resourceIntervalSeconds,
        bloodIntervalSeconds: updates.bloodIntervalSeconds !== undefined ? updates.bloodIntervalSeconds : status.bloodIntervalSeconds,
        autoProgress: updates.autoProgress !== undefined ? updates.autoProgress : status.autoProgress,
        autoBeds: updates.autoBeds !== undefined ? updates.autoBeds : status.autoBeds,
        autoBlood: updates.autoBlood !== undefined ? updates.autoBlood : status.autoBlood,
        targetHospitalId: updates.targetHospitalId !== undefined ? updates.targetHospitalId : status.targetHospitalId
      });
      if (res && res.success) {
        setStatus(prev => ({
          ...prev,
          ...res
        }));
        showFeedback('✅ Settings applied successfully!');
      }
    } catch (err) {
      alert('Error updating config: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSpawnNow = async () => {
    try {
      setSpawning(true);
      const res = await spawnSimulatedIncident({ targetHospitalId: status.targetHospitalId });
      if (res && res.success) {
        showFeedback(`⚡ Injected #${res.incident?.incident_number || 'new case'} successfully!`);
        await fetchStatus();
        if (typeof onIncidentSpawned === 'function') {
          onIncidentSpawned();
        }
      }
    } catch (err) {
      alert('Error spawning incident: ' + err.message);
    } finally {
      setSpawning(false);
    }
  };

  const handleClearResolved = async () => {
    if (!window.confirm('Delete all resolved / arrived simulated incidents from the database? This keeps only active emergencies.')) return;
    try {
      setClearing(true);
      const res = await clearResolvedSimulations();
      if (res && res.success) {
        showFeedback(`🧹 Cleared ${res.deletedCount || 0} resolved simulated cases!`);
        if (typeof onResolvedCleared === 'function') {
          onResolvedCleared();
        }
      }
    } catch (err) {
      alert('Error clearing resolved cases: ' + err.message);
    } finally {
      setClearing(false);
    }
  };

  // 1. Bed Capacity Simulation Action
  const handleBedSimulation = async (action, overrideBedType, overrideAmount) => {
    try {
      setActionInProgress(`bed_${action}`);
      const res = await simulateBedResources({
        hospitalId: bedHospitalId === 'all' ? null : Number(bedHospitalId),
        bedType: overrideBedType || selectedBedType,
        action,
        amount: overrideAmount || bedAmount
      });
      if (res && res.success) {
        showFeedback(`🛏️ ${res.description}`);
        await fetchStatus();
        if (typeof onIncidentSpawned === 'function') {
          onIncidentSpawned();
        }
      }
    } catch (err) {
      alert('Error in bed simulation: ' + err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  // 2. Blood Bank Simulation Action
  const handleBloodSimulation = async (action, overrideGroup, overrideAmount) => {
    try {
      setActionInProgress(`blood_${action}`);
      const res = await simulateBloodResources({
        hospitalId: bloodHospitalId === 'all' ? null : Number(bloodHospitalId),
        action,
        bloodGroup: overrideGroup || (selectedBloodGroup === 'all' ? null : selectedBloodGroup),
        amount: overrideAmount || bloodAmount
      });
      if (res && res.success) {
        showFeedback(`🩸 ${res.description}`);
        await fetchStatus();
        if (typeof onIncidentSpawned === 'function') {
          onIncidentSpawned();
        }
      }
    } catch (err) {
      alert('Error in blood simulation: ' + err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  // 3. Stress Scenario Simulation Action
  const handleScenarioSimulation = async (scenarioName) => {
    try {
      setActionInProgress(`scenario_${scenarioName}`);
      const res = await simulateCrisisScenario({
        scenario: scenarioName,
        hospitalId: bedHospitalId === 'all' ? null : Number(bedHospitalId)
      });
      if (res && res.success) {
        showFeedback(res.description);
        await fetchStatus();
        if (typeof onIncidentSpawned === 'function') {
          onIncidentSpawned();
        }
      }
    } catch (err) {
      alert('Error running scenario: ' + err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1.25rem'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        maxWidth: '640px',
        width: '100%',
        maxHeight: '92vh',
        overflowY: 'auto',
        padding: '1.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>⚙️</span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>
                Autonomous Healthcare Simulator
              </h3>
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Autonomous living simulation: auto-admit & auto-discharge beds, auto-consume & auto-fill blood stocks, and live CAD stream
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 700,
              color: '#64748b'
            }}
          >
            ✕
          </button>
        </div>

        {/* Dynamic Notification Banner */}
        {feedback && (
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            borderRadius: '8px',
            padding: '0.65rem 0.85rem',
            marginBottom: '1rem',
            fontSize: '0.82rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'fadeIn 0.2s ease'
          }}>
            <span>✨</span> {feedback}
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.35rem',
          background: '#f1f5f9',
          padding: '0.25rem',
          borderRadius: '10px',
          marginBottom: '1.25rem'
        }}>
          {[
            { id: 'stream', label: '🚨 CAD Stream' },
            { id: 'beds', label: '🛏️ Auto Beds' },
            { id: 'blood', label: '🩸 Auto Blood' },
            { id: 'scenarios', label: '⚡ Live Telemetry' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: 'none',
                borderRadius: '8px',
                padding: '0.45rem 0.25rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
                background: activeTab === tab.id ? '#ffffff' : 'transparent',
                color: activeTab === tab.id ? '#1e40af' : '#64748b',
                boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ========================================================= */}
        {/* TAB 1: CAD STREAM & AUTOMATED INCIDENT DISPATCH           */}
        {/* ========================================================= */}
        {activeTab === 'stream' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {/* Status Banner & Pause/Resume */}
            <div style={{
              background: status.isRunning ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${status.isRunning ? '#bbf7d0' : '#fde68a'}`,
              borderRadius: '12px',
              padding: '0.85rem 1.15rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: status.isRunning ? '#16a34a' : '#d97706',
                  boxShadow: status.isRunning ? '0 0 8px #16a34a' : 'none'
                }} />
                <div>
                  <strong style={{ fontSize: '0.92rem', color: status.isRunning ? '#15803d' : '#b45309' }}>
                    {status.isRunning ? 'Autonomous Simulator Active' : 'Simulator Paused'}
                  </strong>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.1rem' }}>
                    {status.isRunning
                      ? `Calls every ${status.intervalSeconds}s · Auto-resources every ${status.resourceIntervalSeconds}s`
                      : 'Background simulation engines currently halted'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleToggle}
                disabled={loading}
                style={{
                  background: status.isRunning ? '#fee2e2' : '#dcfce7',
                  color: status.isRunning ? '#dc2626' : '#15803d',
                  border: `1px solid ${status.isRunning ? '#fecaca' : '#bbf7d0'}`,
                  borderRadius: '8px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {status.isRunning ? '⏸️ Pause All' : '▶️ Resume All'}
              </button>
            </div>

            {/* Interval Speed Presets */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.45rem' }}>
                ⏱️ Emergency Call Inbound Rate
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {[
                  { sec: 20, label: 'Fast (20s)' },
                  { sec: 45, label: 'Standard (45s)' },
                  { sec: 60, label: 'Relaxed (60s)' },
                  { sec: 90, label: 'Slow (90s)' }
                ].map(opt => (
                  <button
                    key={opt.sec}
                    onClick={() => handleApplyConfig({ intervalSeconds: opt.sec })}
                    style={{
                      padding: '0.45rem 0.2rem',
                      borderRadius: '8px',
                      border: status.intervalSeconds === opt.sec ? '2px solid #0F4C81' : '1px solid #cbd5e1',
                      background: status.intervalSeconds === opt.sec ? '#F0FDFA' : '#ffffff',
                      color: status.intervalSeconds === opt.sec ? '#0F766E' : '#475569',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Blood Bank Fluctuation Timing (Jumping Speed) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                  🩸 Blood Bank Fluctuation Timing (Jumping Speed)
                </label>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#dc2626' }}>
                  ⏱️ Every {status.bloodIntervalSeconds || 5}s
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {[
                  { sec: 3, label: '⚡ Hyper (3s)' },
                  { sec: 5, label: '🔥 Rapid (5s)' },
                  { sec: 10, label: '⏱️ Active (10s)' },
                  { sec: 20, label: '🔄 Moderate (20s)' }
                ].map(opt => (
                  <button
                    key={opt.sec}
                    onClick={() => handleApplyConfig({ bloodIntervalSeconds: opt.sec })}
                    style={{
                      padding: '0.45rem 0.2rem',
                      borderRadius: '8px',
                      border: (status.bloodIntervalSeconds || 5) === opt.sec ? '2px solid #dc2626' : '1px solid #cbd5e1',
                      background: (status.bloodIntervalSeconds || 5) === opt.sec ? '#fef2f2' : '#ffffff',
                      color: (status.bloodIntervalSeconds || 5) === opt.sec ? '#b91c1c' : '#475569',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Facility Focus */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.45rem' }}>
                🏥 Primary Dispatch Destination Focus
              </label>
              <select
                value={status.targetHospitalId || 'all'}
                onChange={(e) => handleApplyConfig({ targetHospitalId: e.target.value === 'all' ? null : Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  color: '#0f172a',
                  background: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                <option value="all">🌐 Balanced Round-Robin (All Jammu Hospitals)</option>
                {hospitals.map(h => (
                  <option key={h.id} value={h.id}>
                    🏥 {h.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Auto Progression Toggle */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>
                  Auto-Advance Incident Lifecycle
                </strong>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {status.autoProgress ? 'Requested ➔ Accepted ➔ En Route ➔ Arrived' : 'Holds in Requested state for interactive triage'}
                </div>
              </div>
              <button
                onClick={() => handleApplyConfig({ autoProgress: !status.autoProgress })}
                style={{
                  background: status.autoProgress ? '#CCFBF1' : '#f1f5f9',
                  color: status.autoProgress ? '#0F766E' : '#64748b',
                  border: `1px solid ${status.autoProgress ? '#14B8A6' : '#cbd5e1'}`,
                  borderRadius: '8px',
                  padding: '0.35rem 0.7rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {status.autoProgress ? '⚡ Auto ON' : '✋ Interactive'}
              </button>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <button
                onClick={handleSpawnNow}
                disabled={spawning}
                className="btn-primary"
                style={{
                  padding: '0.55rem 0.85rem',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  borderRadius: '8px'
                }}
              >
                <span>{spawning ? '⏳' : '⚡'}</span>
                <span>{spawning ? 'Spawning...' : 'Spawn Incident Now'}</span>
              </button>

              <button
                onClick={handleClearResolved}
                disabled={clearing}
                style={{
                  background: '#fff1f2',
                  color: '#e11d48',
                  border: '1px solid #fecdd3',
                  borderRadius: '8px',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                <span>{clearing ? '⏳' : '🧹'}</span>
                <span>{clearing ? 'Clearing...' : 'Clear Resolved Cases'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: BED CAPACITY (AUTO USE, AUTO EMPTY, ADMIT, SURGE)  */}
        {/* ========================================================= */}
        {activeTab === 'beds' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            
            {/* AUTONOMOUS BED FLICKER TOGGLE BANNER */}
            <div style={{
              background: status.autoBeds ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${status.autoBeds ? '#bbf7d0' : '#fde68a'}`,
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <strong style={{ fontSize: '0.88rem', color: status.autoBeds ? '#15803d' : '#b45309' }}>
                  🔄 Autonomous Bed Dynamic Lifecycle
                </strong>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>
                  {status.autoBeds
                    ? 'Engine automatically admits patients (uses ICU/ward beds) & discharges patients (empties/frees beds)'
                    : 'Automatic bed fluctuations paused'}
                </div>
              </div>
              <button
                onClick={() => handleApplyConfig({ autoBeds: !status.autoBeds })}
                style={{
                  background: status.autoBeds ? '#16a34a' : '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {status.autoBeds ? '⚡ Auto-Beds ON' : '⏸️ Auto-Beds OFF'}
              </button>
            </div>

            {/* Pulse Frequency Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.45rem' }}>
                ⏱️ Bed Fluctuation Pulse Frequency
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {[
                  { sec: 10, label: 'Fast Pulse (10s)' },
                  { sec: 20, label: 'Standard (20s)' },
                  { sec: 35, label: 'Relaxed (35s)' }
                ].map(opt => (
                  <button
                    key={opt.sec}
                    onClick={() => handleApplyConfig({ resourceIntervalSeconds: opt.sec })}
                    style={{
                      padding: '0.45rem 0.2rem',
                      borderRadius: '8px',
                      border: status.resourceIntervalSeconds === opt.sec ? '2px solid #16a34a' : '1px solid #cbd5e1',
                      background: status.resourceIntervalSeconds === opt.sec ? '#f0fdf4' : '#ffffff',
                      color: status.resourceIntervalSeconds === opt.sec ? '#15803d' : '#475569',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Manual One-Click Bed Overrides */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.45rem' }}>
                ⚡ Manual Extreme State Triggers
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <button
                  onClick={() => handleBedSimulation('empty')}
                  disabled={actionInProgress !== null}
                  style={{
                    background: '#F0FDFA',
                    color: '#0F766E',
                    border: '1px solid #14B8A6',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <span>🔄</span>
                  <span>Auto-Empty / Free All Beds (100%)</span>
                </button>

                <button
                  onClick={() => handleBedSimulation('saturate')}
                  disabled={actionInProgress !== null}
                  style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    border: '1px solid #fca5a5',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <span>🚨</span>
                  <span>Auto-Use All Beds (0 Available)</span>
                </button>
              </div>
            </div>

            {/* Targeted Manual Increments */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>🎯 Targeted Bed Adjustments</span>
                <select
                  value={bedHospitalId}
                  onChange={(e) => setBedHospitalId(e.target.value)}
                  style={{ padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.74rem' }}
                >
                  <option value="all">🌐 All Hospitals</option>
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>🏥 {h.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
                <button
                  onClick={() => handleBedSimulation('consume', 'icu', 2)}
                  disabled={actionInProgress !== null}
                  style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.45rem 0.25rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  🔻 Use -2 ICU Beds
                </button>
                <button
                  onClick={() => handleBedSimulation('consume', 'normal', 5)}
                  disabled={actionInProgress !== null}
                  style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', borderRadius: '6px', padding: '0.45rem 0.25rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  🔻 Use -5 Ward Beds
                </button>
                <button
                  onClick={() => handleBedSimulation('release', 'all', 5)}
                  disabled={actionInProgress !== null}
                  style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.45rem 0.25rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  ➕ Free +5 Beds
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: BLOOD BANK (AUTO USE, AUTO FILL, DONATION PULSE)   */}
        {/* ========================================================= */}
        {activeTab === 'blood' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            
            {/* AUTONOMOUS BLOOD BANK TOGGLE BANNER */}
            <div style={{
              background: status.autoBlood ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${status.autoBlood ? '#bbf7d0' : '#fde68a'}`,
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <strong style={{ fontSize: '0.88rem', color: status.autoBlood ? '#15803d' : '#b45309' }}>
                  🔄 Autonomous Blood Bank Dynamics
                </strong>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>
                  {status.autoBlood
                    ? 'Engine automatically draws units for transfusions (auto-use) & receives restock donations (auto-fill)'
                    : 'Automatic blood bank fluctuations paused'}
                </div>
              </div>
              <button
                onClick={() => handleApplyConfig({ autoBlood: !status.autoBlood })}
                style={{
                  background: status.autoBlood ? '#16a34a' : '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {status.autoBlood ? '⚡ Auto-Blood ON' : '⏸️ Auto-Blood OFF'}
              </button>
            </div>

            {/* BLOOD BANK FLUCTUATION TIMING & REAL-TIME JUMP CADENCE */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1rem',
              boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <div>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>
                    🩸 Live Blood Fluctuation Timing (Jumping Speed)
                  </span>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>
                    Sets how rapidly blood bank units jump across hospitals (transfusions & donations)
                  </div>
                </div>
                <span style={{
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  color: '#dc2626',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '20px'
                }}>
                  ⏱️ Every {status.bloodIntervalSeconds || 5}s
                </span>
              </div>

              {/* Quick Preset Speed Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.85rem' }}>
                {[
                  { sec: 3, label: '⚡ 3s (Hyper Jump)' },
                  { sec: 5, label: '🔥 5s (Rapid Live)' },
                  { sec: 10, label: '⏱️ 10s (Active)' },
                  { sec: 20, label: '🔄 20s (Moderate)' }
                ].map((preset) => {
                  const isCurrent = (status.bloodIntervalSeconds || 5) === preset.sec;
                  return (
                    <button
                      key={preset.sec}
                      onClick={() => handleApplyConfig({ bloodIntervalSeconds: preset.sec })}
                      style={{
                        padding: '0.45rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: isCurrent ? 800 : 600,
                        background: isCurrent ? '#dc2626' : '#f8fafc',
                        color: isCurrent ? '#ffffff' : '#334155',
                        border: isCurrent ? '1px solid #dc2626' : '1px solid #cbd5e1',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Fine-Tuning Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>2s (Fastest)</span>
                <input
                  type="range"
                  min="2"
                  max="30"
                  step="1"
                  value={status.bloodIntervalSeconds || 5}
                  onChange={(e) => handleApplyConfig({ bloodIntervalSeconds: parseInt(e.target.value, 10) })}
                  style={{ flex: 1, cursor: 'pointer', accentColor: '#dc2626' }}
                />
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>30s</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#dc2626', minWidth: '42px', textAlign: 'right' }}>
                  {status.bloodIntervalSeconds || 5}s
                </span>
              </div>
            </div>

            {/* Quick Extreme Triggers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <button
                onClick={() => handleBloodSimulation('fill')}
                disabled={actionInProgress !== null}
                style={{
                  background: '#f0fdf4',
                  color: '#166534',
                  border: '1px solid #86efac',
                  borderRadius: '8px',
                  padding: '0.75rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: '0.95rem', marginBottom: '0.2rem' }}>💉 Auto-Fill Blood Banks</div>
                <div style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 500 }}>
                  Restock all 10 blood groups to optimal surplus (45-55 units)
                </div>
              </button>

              <button
                onClick={() => handleBloodSimulation('deplete_critical')}
                disabled={actionInProgress !== null}
                style={{
                  background: '#fef2f2',
                  color: '#991b1b',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '0.75rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: '0.95rem', marginBottom: '0.2rem' }}>⚠️ Auto-Drain Blood (&lt; 3 Units)</div>
                <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 500 }}>
                  Drain blood to critical low to test shortage warning alarms
                </div>
              </button>
            </div>

            {/* Emergency O- Top Up */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <button
                onClick={() => handleBloodSimulation('topup_o_neg')}
                disabled={actionInProgress !== null}
                style={{
                  background: '#eff6ff',
                  color: '#1e40af',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: '0.85rem' }}>🩸 Top Up Universal O- (+20)</div>
                <div style={{ fontSize: '0.7rem', color: '#0F766E' }}>Emergency trauma red cell top-up</div>
              </button>

              <button
                onClick={() => handleBloodSimulation('consume', null, 5)}
                disabled={actionInProgress !== null}
                style={{
                  background: '#fffbeb',
                  color: '#92400e',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: '0.85rem' }}>🔻 Transfusion Draw (-5 Units)</div>
                <div style={{ fontSize: '0.7rem', color: '#b45309' }}>Simulate active surgical blood draw</div>
              </button>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: LIVE TELEMETRY FEED & STRESS SCENARIOS             */}
        {/* ========================================================= */}
        {activeTab === 'scenarios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            
            {/* Live Telemetry Counter Banner */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.65rem',
              textAlign: 'center'
            }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>CAD Incidents</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{status.totalSimulated}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Bed Admissions/Discharges</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a' }}>{status.totalBedFluctuations}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Blood Transfusions/Fills</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#dc2626' }}>{status.totalBloodFluctuations}</div>
              </div>
            </div>

            {/* Live Activity Feed */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.45rem', textTransform: 'uppercase' }}>
                📡 Live Autonomous Pulse Activity Log
              </label>
              {status.recentActivity && status.recentActivity.length > 0 ? (
                <div style={{
                  background: '#0f172a',
                  color: '#f8fafc',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}>
                  {status.recentActivity.map((act, i) => (
                    <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.25rem' }}>
                      {act}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '1rem', textAlign: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                  Awaiting first autonomous pulse... (Runs every {status.resourceIntervalSeconds}s)
                </div>
              )}
            </div>

            {/* Quick Evaluation Scenarios */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.45rem', textTransform: 'uppercase' }}>
                ⚡ One-Click Scenario Injections
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <button
                  onClick={() => handleScenarioSimulation('mci')}
                  disabled={actionInProgress !== null}
                  style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', borderRadius: '8px', padding: '0.65rem 0.75rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ fontSize: '0.85rem' }}>🚨 Mass Casualty (MCI)</div>
                  <div style={{ fontSize: '0.68rem', color: '#be123c', fontWeight: 500 }}>Uses beds, blood & injects 2 urgent cases</div>
                </button>

                <button
                  onClick={() => handleScenarioSimulation('replenish_all')}
                  disabled={actionInProgress !== null}
                  style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.65rem 0.75rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ fontSize: '0.85rem' }}>✨ Reset & Replenish All</div>
                  <div style={{ fontSize: '0.68rem', color: '#15803d', fontWeight: 500 }}>100% beds, fills blood & clears cases</div>
                </button>
              </div>
            </div>

          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
          <button
            onClick={onClose}
            style={{
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem 1.25rem',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
}
