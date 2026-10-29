/**
 * MedLink API Client
 * Centralized fetch functions for communicating with the Node.js backend.
 * Automatically injects JWT Bearer token into Authorization headers.
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

let authToken = localStorage.getItem('medlink_token') || null;

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('medlink_token', token);
  } else {
    localStorage.removeItem('medlink_token');
  }
}

export function getStoredToken() {
  return authToken;
}

async function fetchJson(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch from ${endpoint}`);
  }

  return response.json();
}

/** Check if backend server is online */
export function checkApiHealth() {
  return fetchJson('/health');
}

// ==========================================
// Authentication & User APIs
// ==========================================

export function loginUser(email, password, portal) {
  return fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, portal })
  });
}

export function registerUser(userData) {
  return fetchJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

export function getMe() {
  return fetchJson('/auth/me');
}

export function getDemoUsers() {
  return fetchJson('/auth/demo-users');
}


// ==========================================
// Hospital Management APIs
// ==========================================

/** Fetch all hospitals */
export function getHospitals() {
  return fetchJson('/hospitals');
}

/** Create a new regional hospital (Admin only) */
export function createHospital(hospitalData) {
  return fetchJson('/hospitals', {
    method: 'POST',
    body: JSON.stringify(hospitalData)
  });
}

/** Delete a regional hospital (Admin only) */
export function deleteHospital(hospitalId) {
  return fetchJson(`/hospitals/${hospitalId}`, {
    method: 'DELETE'
  });
}

/** Fetch a single hospital with its beds & specialists */
export function getHospitalDetails(id) {
  return fetchJson(`/hospitals/${id}`);
}

/** Find hospitals near given GPS coordinates using PostGIS */
export function getNearbyHospitals(lat, lng, radiusMeters = 25000) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radiusMeters)
  });
  return fetchJson(`/hospitals/nearby?${params.toString()}`);
}

/** Update hospital bed/equipment capacity (Hospital Manager / Admin) */
export function updateHospitalResource(hospitalId, resourceId, data) {
  return fetchJson(`/hospitals/${hospitalId}/resources/${resourceId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

/** Update hospital specialist on-duty status (Hospital Manager / Admin) */
export function updateHospitalSpecialist(hospitalId, specialistId, data) {
  return fetchJson(`/hospitals/${hospitalId}/specialists/${specialistId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

/** 1-Click toggle specialist on-duty shift status */
export function toggleSpecialistDuty(hospitalId, specialistId) {
  return fetchJson(`/hospitals/${hospitalId}/specialists/${specialistId}/toggle-duty`, {
    method: 'PATCH'
  });
}

/** Fetch blood bank inventory for a hospital */
export function getHospitalBloodInventory(hospitalId) {
  return fetchJson(`/hospitals/${hospitalId}/blood-inventory`);
}

/** Update blood bank stock units (Hospital Manager / Admin) */
export function updateHospitalBloodInventory(hospitalId, data) {
  return fetchJson(`/hospitals/${hospitalId}/blood-inventory`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

/** Add or upsert a new hospital resource/bed category */
export function addHospitalResource(hospitalId, resourceData) {
  return fetchJson(`/hospitals/${hospitalId}/resources`, {
    method: 'POST',
    body: JSON.stringify(resourceData)
  });
}

/** Delete a hospital resource category */
export function deleteHospitalResource(hospitalId, resourceId) {
  return fetchJson(`/hospitals/${hospitalId}/resources/${resourceId}`, {
    method: 'DELETE'
  });
}

/** Add or upsert a doctor specialist */
export function addHospitalSpecialist(hospitalId, specialistData) {
  return fetchJson(`/hospitals/${hospitalId}/specialists`, {
    method: 'POST',
    body: JSON.stringify(specialistData)
  });
}

/** Delete a doctor specialist from hospital roster */
export function deleteHospitalSpecialist(hospitalId, specialistId) {
  return fetchJson(`/hospitals/${hospitalId}/specialists/${specialistId}`, {
    method: 'DELETE'
  });
}


// ==========================================
// Emergency Incident & Triage APIs
// ==========================================

/** Evaluate triage requirements without saving to DB */
export function evaluateTriage(triageData) {
  return fetchJson('/incidents/evaluate-triage', {
    method: 'POST',
    body: JSON.stringify(triageData)
  });
}

/** Create and register a new emergency incident in DB */
export function createIncident(incidentData) {
  return fetchJson('/incidents', {
    method: 'POST',
    body: JSON.stringify(incidentData)
  });
}

/** Get list of all registered incidents */
export function getIncidents() {
  return fetchJson('/incidents');
}

/** Get single incident details */
export function getIncidentDetails(id) {
  return fetchJson(`/incidents/${id}`);
}

/** Get incidents filed by current patient */
export function getMyIncidents() {
  return fetchJson('/incidents/user/my-incidents');
}

/** Get incidents allocated to or contacting a specific hospital */
export function getHospitalIncidents(hospitalId) {
  return fetchJson(`/incidents/facility/${hospitalId}`);
}


// ==========================================
// Geo-spatial Matching & Ranking APIs
// ==========================================

/** Get multi-criteria ranked hospitals for an emergency incident */
export function getRankedHospitals(incidentId, radiusMeters = 35000) {
  return fetchJson(`/incidents/${incidentId}/ranked-hospitals?radius=${radiusMeters}`);
}

/** Assign a hospital to an incident */
export function assignHospitalToIncident(incidentId, hospitalId) {
  return fetchJson(`/incidents/${incidentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'assigned',
      assignedHospitalId: hospitalId,
      notes: `Matched and dispatched via Multi-Criteria Engine`
    })
  });
}


// ==========================================
// Coordination & Escalation APIs
// ==========================================

/** Start automated dispatch to Rank #1 hospital with countdown timer */
export function startDispatch(incidentId, options = {}) {
  return fetchJson(`/incidents/${incidentId}/start-dispatch`, {
    method: 'POST',
    body: JSON.stringify(options)
  });
}

/** Submit hospital response (accept or reject with reason) */
export function respondToDispatch(incidentId, { hospitalId, action, reason }) {
  return fetchJson(`/incidents/${incidentId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ hospitalId, action, reason })
  });
}

/** Get full real-time coordination state, timer, audit logs, and ranked queue */
export function getCoordinationState(incidentId) {
  return fetchJson(`/incidents/${incidentId}/coordination`);
}

/** Cancel active dispatch */
export function cancelDispatch(incidentId, reason) {
  return fetchJson(`/incidents/${incidentId}/cancel-dispatch`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

/** Update incident status & notes (Hospital Manager / Admin only) */
export function updateIncidentStatus(incidentId, status, extra = {}) {
  return fetchJson(`/incidents/${incidentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...extra })
  });
}

/** Delete an emergency incident (Hospital Manager / Admin only) */
export function deleteIncident(incidentId) {
  return fetchJson(`/incidents/${incidentId}`, {
    method: 'DELETE'
  });
}

// ==========================================
// User & Role Access Management APIs (Admin)
// ==========================================

/** Fetch all registered users and pending preassigned email roles */
export function getUsersAndRoles() {
  return fetchJson('/auth/users');
}

/** Assign or pre-assign a role to an email */
export function assignUserRole({ email, role, hospitalId, notes }) {
  return fetchJson('/auth/assign-role', {
    method: 'POST',
    body: JSON.stringify({ email, role, hospitalId, notes })
  });
}

/** Revoke a preassigned email role */
export function deletePreassignedRole(id) {
  return fetchJson(`/auth/preassigned/${id}`, {
    method: 'DELETE'
  });
}

/** Delete a registered user account */
export function deleteUserAccount(id) {
  return fetchJson(`/auth/users/${id}`, {
    method: 'DELETE'
  });
}

/** Update personal profile (Self - Any Role) */
export function updateUserProfile(profileData) {
  return fetchJson('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(profileData)
  });
}

/** Admin update user/hospital manager details (name, phone, email, facility, role, notes) */
export function adminUpdateUser(id, userData) {
  return fetchJson(`/auth/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(userData)
  });
}

// ==========================================
// Central Dispatch Analytics & Surge APIs
// ==========================================

/** Fetch regional surge and capacity metrics */
export function getAnalyticsDashboard() {
  return fetchJson('/analytics/dashboard');
}

// ==========================================
// Autonomous Incident Simulation APIs
// ==========================================

export function getSimulatorStatus() {
  return fetchJson('/incidents/simulator/status');
}

export function toggleSimulator() {
  return fetchJson('/incidents/simulator/toggle', { method: 'POST' });
}

export function updateSimulatorConfig(config) {
  return fetchJson('/incidents/simulator/config', {
    method: 'POST',
    body: JSON.stringify(config)
  });
}

export function clearResolvedSimulations() {
  return fetchJson('/incidents/simulator/clear-resolved', { method: 'POST' });
}

export function spawnSimulatedIncident(payload = {}) {
  return fetchJson('/incidents/simulator/spawn', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function simulateBedResources(payload = {}) {
  return fetchJson('/incidents/simulator/beds', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function simulateBloodResources(payload = {}) {
  return fetchJson('/incidents/simulator/blood', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function simulateCrisisScenario(payload = {}) {
  return fetchJson('/incidents/simulator/scenario', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// ==========================================
// Data Synchronization APIs
// ==========================================

export function getSyncStatus() {
  return fetchJson('/sync/status');
}

export function getSyncDelta(since) {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  return fetchJson(`/sync/delta${query}`);
}

export function pushSyncBatch(operations = []) {
  return fetchJson('/sync/batch', {
    method: 'POST',
    body: JSON.stringify({
      clientId: 'web-client-' + (typeof window !== 'undefined' ? window.location.hostname : 'cad'),
      operations
    })
  });
}

// ==========================================
// System Integration & Testing APIs
// ==========================================

export function getIntegrationDiagnostics() {
  return fetchJson('/integration/diagnostics');
}

export function runE2EIntegrationTest() {
  return fetchJson('/integration/e2e-run', {
    method: 'POST'
  });
}

export function getIntegrationBenchmark() {
  return fetchJson('/integration/benchmark');
}

// ==========================================
// Performance Evaluation & Telemetry APIs
// ==========================================

export function getEvaluationMetrics() {
  return fetchJson('/evaluation/metrics');
}

export function runSyntheticEvaluation(count = 50) {
  return fetchJson('/evaluation/run-synthetic', {
    method: 'POST',
    body: JSON.stringify({ count })
  });
}

export function getEvaluationSummary() {
  return fetchJson('/evaluation/summary');
}

export function getEvaluationDocs() {
  return fetchJson('/evaluation/docs');
}

