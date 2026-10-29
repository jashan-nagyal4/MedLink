/**
 * MedLink Offline-First Local Storage Engine
 * 
 * Provides local caching, resilient offline outbox queuing,
 * conflict logging, and storage telemetry for disconnected operations.
 */

const KEYS = {
  HOSPITALS: 'medlink_offline_hospitals',
  INCIDENTS: 'medlink_offline_incidents',
  OUTBOX: 'medlink_offline_outbox',
  LAST_SYNC: 'medlink_last_sync_time',
  CONFLICTS: 'medlink_sync_conflicts'
};

function safeGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn(`[OfflineStorage] Failed to read ${key}:`, err);
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[OfflineStorage] Failed to write ${key}:`, err);
  }
}

// ==========================================
// 1. Hospital Directory Cache
// ==========================================

export function saveHospitalsCache(hospitals) {
  if (Array.isArray(hospitals)) {
    safeSet(KEYS.HOSPITALS, hospitals);
  }
}

export function getCachedHospitals() {
  return safeGet(KEYS.HOSPITALS, []);
}

// ==========================================
// 2. Incident & Patient Queue Cache
// ==========================================

export function saveIncidentsCache(incidents) {
  if (Array.isArray(incidents)) {
    // Free up cache space: only cache active emergency cases (purge arrived/closed/resolved)
    const activeIncidents = incidents.filter((i) => {
      const s = (i.status || '').toLowerCase();
      return s !== 'arrived' && s !== 'closed' && s !== 'resolved' && s !== 'cancelled';
    });
    safeSet(KEYS.INCIDENTS, activeIncidents);
  }
}

export function removeCachedIncident(incidentId) {
  if (!incidentId) return;
  const incidents = safeGet(KEYS.INCIDENTS, []);
  const filtered = incidents.filter((i) => String(i.id) !== String(incidentId));
  safeSet(KEYS.INCIDENTS, filtered);
}

export function getCachedIncidents() {
  const incidents = safeGet(KEYS.INCIDENTS, []);
  // Return only non-completed incidents
  return incidents.filter((i) => {
    const s = (i.status || '').toLowerCase();
    return s !== 'arrived' && s !== 'closed' && s !== 'resolved' && s !== 'cancelled';
  });
}

// ==========================================
// 3. Persistent Offline Outbox Queue
// ==========================================

/**
 * Enqueue an operation to be pushed once network returns
 * @param {string} action - 'CREATE_INCIDENT' | 'UPDATE_STATUS' | 'UPDATE_RESOURCE'
 * @param {object} payload - Operation details
 */
export function enqueueOfflineOp(action, payload) {
  const outbox = safeGet(KEYS.OUTBOX, []);
  const op = {
    clientOpId: `op-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    action,
    payload,
    clientTimestamp: new Date().toISOString()
  };

  outbox.push(op);
  safeSet(KEYS.OUTBOX, outbox);
  console.log(`📦 [OfflineStorage] Enqueued offline operation #${op.clientOpId} (${action})`);
  return op;
}

export function getOfflineOutbox() {
  return safeGet(KEYS.OUTBOX, []);
}

export function removeOfflineOp(clientOpId) {
  const outbox = safeGet(KEYS.OUTBOX, []);
  const filtered = outbox.filter(op => op.clientOpId !== clientOpId);
  safeSet(KEYS.OUTBOX, filtered);
}

export function clearOfflineOutbox() {
  safeSet(KEYS.OUTBOX, []);
}

// ==========================================
// 4. Synchronization Telemetry & Conflicts
// ==========================================

export function getLastSyncTime() {
  return safeGet(KEYS.LAST_SYNC, null);
}

export function setLastSyncTime(isoString) {
  safeSet(KEYS.LAST_SYNC, isoString || new Date().toISOString());
}

export function recordSyncConflict(conflict) {
  const list = safeGet(KEYS.CONFLICTS, []);
  list.unshift({ ...conflict, recordedAt: new Date().toISOString() });
  // Keep last 30 conflicts
  safeSet(KEYS.CONFLICTS, list.slice(0, 30));
}

export function getSyncConflicts() {
  return safeGet(KEYS.CONFLICTS, []);
}

export function clearSyncConflicts() {
  safeSet(KEYS.CONFLICTS, []);
}

/**
 * Calculate total local storage footprint for diagnostic display
 */
export function getOfflineStorageStats() {
  const hospitals = getCachedHospitals();
  const incidents = getCachedIncidents();
  const outbox = getOfflineOutbox();
  const conflicts = getSyncConflicts();
  const lastSync = getLastSyncTime();

  let totalBytes = 0;
  for (const k of Object.values(KEYS)) {
    const raw = localStorage.getItem(k);
    if (raw) totalBytes += raw.length * 2; // rough UTF-16 byte estimate
  }

  return {
    cachedHospitalsCount: hospitals.length,
    cachedIncidentsCount: incidents.length,
    pendingOutboxCount: outbox.length,
    conflictsCount: conflicts.length,
    lastSync,
    storageKb: (totalBytes / 1024).toFixed(1)
  };
}
