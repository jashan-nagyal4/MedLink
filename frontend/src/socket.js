/**
 * MedLink Frontend Socket.IO Client
 * 
 * Establishes a persistent bi-directional WebSocket connection to the backend.
 */

import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000
});

export function onNewIncident(callback) {
  socket.on('incident:new', callback);
  return () => socket.off('incident:new', callback);
}

export function onIncidentStatusChange(callback) {
  socket.on('incident:status_change', callback);
  return () => socket.off('incident:status_change', callback);
}

export function onIncidentDeleted(callback) {
  socket.on('incident:deleted', callback);
  return () => socket.off('incident:deleted', callback);
}

export function onHospitalUpdate(callback) {
  socket.on('hospital:updated', callback);
  return () => socket.off('hospital:updated', callback);
}

export function onHospitalCreated(callback) {
  socket.on('hospital:created', callback);
  return () => socket.off('hospital:created', callback);
}

export function onHospitalDeleted(callback) {
  socket.on('hospital:deleted', callback);
  return () => socket.off('hospital:deleted', callback);
}

export function onBloodUpdate(callback) {
  socket.on('hospital:blood_updated', callback);
  return () => socket.off('hospital:blood_updated', callback);
}

export function acknowledgeIncident(incidentId, hospitalId, hospitalName) {
  socket.emit('incident:acknowledge', {
    incidentId,
    hospitalId,
    hospitalName,
    timestamp: new Date().toISOString()
  });
}

// ==========================================
// Coordination & Escalation Events
// ==========================================

export function joinHospitalRoom(hospitalId) {
  socket.emit('hospital:join', hospitalId);
}

export function leaveHospitalRoom(hospitalId) {
  socket.emit('hospital:leave', hospitalId);
}

export function onDispatchRequest(callback) {
  socket.on('incident:dispatch_request', callback);
  return () => socket.off('incident:dispatch_request', callback);
}

export function onHospitalAccepted(callback) {
  socket.on('incident:accepted', callback);
  return () => socket.off('incident:accepted', callback);
}

export function onHospitalRejected(callback) {
  socket.on('incident:rejected', callback);
  return () => socket.off('incident:rejected', callback);
}

export function onDispatchTimeout(callback) {
  socket.on('incident:timed_out', callback);
  return () => socket.off('incident:timed_out', callback);
}

export function onIncidentEscalated(callback) {
  socket.on('incident:escalated', callback);
  return () => socket.off('incident:escalated', callback);
}

export function onIncidentExhausted(callback) {
  socket.on('incident:exhausted', callback);
  return () => socket.off('incident:exhausted', callback);
}

export function sendHospitalResponse(incidentId, hospitalId, action, reason) {
  return new Promise((resolve, reject) => {
    socket.emit('incident:respond', { incidentId, hospitalId, action, reason }, (response) => {
      if (response && response.success) {
        resolve(response.result);
      } else {
        reject(new Error(response?.error || 'Failed to submit response via WebSocket'));
      }
    });
  });
}
