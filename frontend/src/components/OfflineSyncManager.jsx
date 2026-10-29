import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getOfflineOutbox,
  removeOfflineOp,
  clearOfflineOutbox,
  getLastSyncTime,
  setLastSyncTime,
  getSyncConflicts,
  recordSyncConflict,
  getOfflineStorageStats,
  getCachedHospitals,
  getCachedIncidents,
  saveHospitalsCache,
  saveIncidentsCache
} from '../utils/offlineStorage';
import { getSyncDelta, pushSyncBatch } from '../api';

export default function OfflineSyncManager({
  onDataRefreshed,
  isOpen,
  onClose
}) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState(() => getOfflineStorageStats());
  const [conflicts, setConflicts] = useState(() => getSyncConflicts());
  const [outbox, setOutbox] = useState(() => getOfflineOutbox());
  const [syncToast, setSyncToast] = useState(null);

  const effectiveOnline = isOnline && !isSimulatedOffline;

  const isSyncingRef = useRef(false);
  const onDataRefreshedRef = useRef(onDataRefreshed);
  const effectiveOnlineRef = useRef(effectiveOnline);

  useEffect(() => {
    onDataRefreshedRef.current = onDataRefreshed;
  }, [onDataRefreshed]);

  useEffect(() => {
    effectiveOnlineRef.current = effectiveOnline;
  }, [effectiveOnline]);

  // Refresh local state stats
  const refreshLocalState = useCallback(() => {
    setStats(getOfflineStorageStats());
    setConflicts(getSyncConflicts());
    setOutbox(getOfflineOutbox());
  }, []);

  // When modal opens, refresh stats to display latest cached numbers
  useEffect(() => {
    if (isOpen) {
      refreshLocalState();
    }
  }, [isOpen, refreshLocalState]);

  // Sync execution engine (Silent in background, toasts only on actual pushes or manual trigger)
  const executeSync = useCallback(async (isManual = false) => {
    if (isSyncingRef.current) {
      console.log('🔄 [SyncEngine] Sync already in flight, skipping redundant execution.');
      return;
    }

    if (!effectiveOnlineRef.current) {
      if (isManual) {
        setSyncToast({ type: 'warning', text: 'Cannot sync: Network connection is offline.' });
        setTimeout(() => setSyncToast(null), 3000);
      }
      return;
    }

    try {
      isSyncingRef.current = true;
      if (isManual) {
        setSyncing(true);
      }

      const currentOutbox = getOfflineOutbox();
      let pushSuccessCount = 0;

      // 1. Flush Outbox to Server (Push)
      if (currentOutbox.length > 0) {
        console.log(`🚀 [SyncEngine] Pushing ${currentOutbox.length} offline operations to server...`);
        const pushRes = await pushSyncBatch(currentOutbox);

        if (pushRes && pushRes.success && Array.isArray(pushRes.results)) {
          for (const resItem of pushRes.results) {
            if (resItem.status === 'applied') {
              removeOfflineOp(resItem.clientOpId);
              pushSuccessCount++;
            } else if (resItem.status === 'conflict_resolved') {
              recordSyncConflict(resItem);
              removeOfflineOp(resItem.clientOpId);
              pushSuccessCount++;
            } else if (resItem.status === 'rejected') {
              recordSyncConflict(resItem);
              removeOfflineOp(resItem.clientOpId);
            }
          }
        }
      }

      // 2. Fetch Delta Updates from Server (Pull)
      const lastSync = getLastSyncTime();
      const deltaRes = await getSyncDelta(lastSync);

      if (deltaRes && deltaRes.success) {
        setLastSyncTime(deltaRes.serverTime);

        // Update local caches with pulled changes
        if (deltaRes.changes?.hospitals?.length > 0) {
          const currentHosp = getCachedHospitals();
          const mergedHosp = [...currentHosp];
          for (const h of deltaRes.changes.hospitals) {
            const idx = mergedHosp.findIndex(x => x.id === h.id);
            if (idx >= 0) mergedHosp[idx] = h;
            else mergedHosp.push(h);
          }
          saveHospitalsCache(mergedHosp);
        }

        if (deltaRes.changes?.incidents?.length > 0) {
          const currentInc = getCachedIncidents();
          const mergedInc = [...currentInc];
          for (const inc of deltaRes.changes.incidents) {
            const idx = mergedInc.findIndex(x => x.id === inc.id);
            if (idx >= 0) mergedInc[idx] = inc;
            else mergedInc.unshift(inc);
          }
          saveIncidentsCache(mergedInc);
        }
      }

      refreshLocalState();
      if (typeof onDataRefreshedRef.current === 'function') {
        onDataRefreshedRef.current();
      }

      // ONLY notify if actual offline operations were pushed, or if the user explicitly clicked "Sync Now"
      if (pushSuccessCount > 0) {
        setSyncToast({
          type: 'success',
          text: `✅ Synced ${pushSuccessCount} offline operation${pushSuccessCount > 1 ? 's' : ''} to central server.`
        });
        setTimeout(() => setSyncToast(null), 3000);
      } else if (isManual) {
        setSyncToast({
          type: 'success',
          text: '✅ All local data is up to date with server.'
        });
        setTimeout(() => setSyncToast(null), 2500);
      }

    } catch (err) {
      console.warn('[SyncEngine] Synchronization error:', err);
      if (isManual) {
        setSyncToast({ type: 'error', text: `Sync error: ${err.message}` });
        setTimeout(() => setSyncToast(null), 4000);
      }
    } finally {
      isSyncingRef.current = false;
      if (isManual) {
        setSyncing(false);
      }
    }
  }, [refreshLocalState]);

  const executeSyncRef = useRef(executeSync);
  useEffect(() => {
    executeSyncRef.current = executeSync;
  }, [executeSync]);

  // Initial silent background sync check once on mount
  useEffect(() => {
    executeSyncRef.current?.(false);
  }, []);

  // Listen to browser network state changes
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 [Network] Connection restored.');
      setIsOnline(true);
      executeSyncRef.current?.(false);
    };

    const handleOffline = () => {
      console.warn('⚡ [Network] Connection lost. Operating in offline mode.');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Periodic background auto-sync when online (runs every 10 seconds)
  useEffect(() => {
    if (!effectiveOnline) return;
    const interval = setInterval(() => {
      executeSyncRef.current?.(false);
    }, 10000); // 10s auto-sync

    return () => clearInterval(interval);
  }, [effectiveOnline]);

  return (
    <>
      {/* 1. Global Offline Alert Banner (Shows when network is interrupted) */}
      {!effectiveOnline && (
        <div style={{
          background: 'linear-gradient(90deg, #b45309, #d97706)',
          color: '#ffffff',
          padding: '0.55rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          fontSize: '0.82rem',
          fontWeight: 600,
          boxShadow: '0 2px 8px rgba(180, 83, 9, 0.3)',
          position: 'sticky',
          top: 0,
          zIndex: 998
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1rem', animation: 'pulse 1.5s infinite' }}>⚡</span>
            <span>
              <strong>OFFLINE-FIRST MODE ACTIVE:</strong> Network disconnected. Local caching preserves full read/write operations.
              {outbox.length > 0 && ` (${outbox.length} change${outbox.length > 1 ? 's' : ''} queued for auto-sync)`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isSimulatedOffline && (
              <span style={{ background: 'rgba(0,0,0,0.25)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem' }}>
                Simulated Disconnection
              </span>
            )}
            <button
              onClick={() => {
                if (isSimulatedOffline) setIsSimulatedOffline(false);
                executeSync(true);
              }}
              style={{
                background: '#ffffff',
                color: '#b45309',
                border: 'none',
                borderRadius: '6px',
                padding: '0.25rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🔄 Reconnect & Sync
            </button>
          </div>
        </div>
      )}

      {/* 2. Floating Sync Notification Toast */}
      {syncToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: syncToast.type === 'error' ? '#fee2e2' : syncToast.type === 'warning' ? '#fef3c7' : '#dcfce7',
          border: `1px solid ${syncToast.type === 'error' ? '#fca5a5' : syncToast.type === 'warning' ? '#fde68a' : '#86efac'}`,
          color: syncToast.type === 'error' ? '#991b1b' : syncToast.type === 'warning' ? '#92400e' : '#166534',
          borderRadius: '10px',
          padding: '0.75rem 1.15rem',
          fontSize: '0.84rem',
          fontWeight: 700,
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.15)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>{syncToast.text}</span>
        </div>
      )}

      {/* 3. Sync Center Diagnostic Modal */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '1.75rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>🔄</span>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>
                    Offline-First Data Sync Center
                  </h3>
                </div>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Local caching continuity, offline outbox reconciliation, and conflict resolution
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Status Banner */}
              <div style={{
                background: effectiveOnline ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${effectiveOnline ? '#bbf7d0' : '#fde68a'}`,
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: effectiveOnline ? '#16a34a' : '#d97706',
                    boxShadow: effectiveOnline ? '0 0 8px #16a34a' : 'none'
                  }} />
                  <div>
                    <strong style={{ fontSize: '0.92rem', color: effectiveOnline ? '#15803d' : '#b45309' }}>
                      {effectiveOnline ? 'Network Online & Synchronized' : 'Offline Mode (Local Storage)'}
                    </strong>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.1rem' }}>
                      {stats.lastSync ? `Last synced: ${new Date(stats.lastSync).toLocaleTimeString()}` : 'Initial synchronization pending'}
                      {effectiveOnline && ' · Auto-sync (10s)'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => executeSync(true)}
                  disabled={syncing || !effectiveOnline}
                  className="btn-primary"
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: syncing || !effectiveOnline ? 'not-allowed' : 'pointer',
                    opacity: syncing || !effectiveOnline ? 0.75 : 1,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ display: 'inline-block', transform: syncing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s ease' }}>
                    {syncing ? '⏳' : '🔄'}
                  </span>
                  <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              </div>

              {/* Network Simulation Toggle (For Viva / Demo Presentation) */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <strong style={{ fontSize: '0.84rem', color: '#0f172a' }}>
                    Simulate Network Disconnection
                  </strong>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Test offline emergency reporting without disconnecting Wi-Fi / cable
                  </div>
                </div>
                <button
                  onClick={() => {
                    const nextVal = !isSimulatedOffline;
                    setIsSimulatedOffline(nextVal);
                    if (!nextVal) executeSync(true);
                  }}
                  style={{
                    background: isSimulatedOffline ? '#fee2e2' : '#f1f5f9',
                    color: isSimulatedOffline ? '#dc2626' : '#475569',
                    border: `1px solid ${isSimulatedOffline ? '#fca5a5' : '#cbd5e1'}`,
                    borderRadius: '8px',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {isSimulatedOffline ? '⚡ Disconnected (Offline)' : '🌐 Normal (Online)'}
                </button>
              </div>

              {/* Local Storage Telemetry */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  📊 Local Cache Telemetry
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Cached Hospitals</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{stats.cachedHospitalsCount}</div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Cached Incidents</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{stats.cachedIncidentsCount}</div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Cache Size</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{stats.storageKb} KB</div>
                  </div>
                </div>
              </div>

              {/* Pending Offline Outbox Queue */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                    📦 Pending Outbox ({outbox.length})
                  </label>
                  {outbox.length > 0 && (
                    <button
                      onClick={() => {
                        clearOfflineOutbox();
                        refreshLocalState();
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Clear Outbox
                    </button>
                  )}
                </div>

                {outbox.length === 0 ? (
                  <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                    No pending offline actions. All writes are fully synchronized with the database.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto' }}>
                    {outbox.map(op => (
                      <div key={op.clientOpId} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.6rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '0.8rem', color: '#92400e' }}>{op.action}</strong>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {new Date(op.clientTimestamp).toLocaleTimeString()} · ID: {op.clientOpId}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#b45309', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
                          PENDING
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Conflict Resolution Audit Log */}
              {conflicts.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    ⚖️ Conflict Resolution Audit Log ({conflicts.length})
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '140px', overflowY: 'auto' }}>
                    {conflicts.map((c, i) => (
                      <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.76rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span style={{ color: '#0f172a' }}>{c.action || 'OPERATION'}</span>
                          <span style={{ color: c.status === 'conflict_resolved' ? '#16a34a' : '#dc2626' }}>
                            {c.resolution || c.status}
                          </span>
                        </div>
                        <div style={{ color: '#64748b', marginTop: '0.15rem' }}>{c.message || c.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
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
                Close Sync Center
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
