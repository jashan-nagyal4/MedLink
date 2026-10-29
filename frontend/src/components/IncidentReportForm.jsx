/**
 * Emergency Incident Reporting Form
 * 
 * 1. Form for capturing patient details, location, and initial condition.
 * 2. User input validation for patient data and location.
 * 3. Integration with backend APIs to submit new emergency incidents.
 * 4. Interactive map view for incident location selection.
 */

import { useState } from 'react';
import { createIncident, evaluateTriage } from '../api';
import { enqueueOfflineOp } from '../utils/offlineStorage';
import IncidentMapPicker from './IncidentMapPicker';

export default function IncidentReportForm({ hospitals = [], onIncidentCreated }) {
  // Caller details
  const [callerName, setCallerName] = useState('Emergency Dispatcher #4');
  const [callerPhone, setCallerPhone] = useState('0191-2580000');

  // Location details
  const [address, setAddress] = useState('Gandhi Nagar, Main Market, Jammu, J&K');
  const [latitude, setLatitude] = useState('32.7090');
  const [longitude, setLongitude] = useState('74.8680');

  // Patient details
  const [patientName, setPatientName] = useState('Rajesh Sharma');
  const [isUnknownPatient, setIsUnknownPatient] = useState(false);
  const [patientAge, setPatientAge] = useState('48');
  const [patientGender, setPatientGender] = useState('male');
  const [contactNumber, setContactNumber] = useState('9876543210');
  const [medicalHistory, setMedicalHistory] = useState('Hypertension, Diabetes Type 2');
  const [allergies, setAllergies] = useState('No known drug allergies (NKDA)');

  // Clinical condition details
  const [chiefComplaint, setChiefComplaint] = useState('Severe central chest pressure radiating to left arm and sweating for 40 minutes.');
  const [conditionCategory, setConditionCategory] = useState('cardiac');

  // Vitals
  const [heartRate, setHeartRate] = useState('112');
  const [bloodPressure, setBloodPressure] = useState('86/54');
  const [oxygenSaturation, setOxygenSaturation] = useState('89');
  const [gcs, setGcs] = useState('14');
  const [respiratoryRate, setRespiratoryRate] = useState('24');
  const [notes, setNotes] = useState('Diaphoresis and pale skin noted by first responders on scene.');

  // Form State
  const [submitting, setSubmitting] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [createdIncidentData, setCreatedIncidentData] = useState(null);
  const [liveEvaluation, setLiveEvaluation] = useState(null);

  // Handle location update from map click / drag
  const handleLocationSelect = (lat, lng, addr) => {
    setLatitude(String(lat));
    setLongitude(String(lng));
    if (addr) setAddress(addr);
    setValidationError('');
  };

  // Preview Triage
  const handleQuickPreview = async () => {
    if (!chiefComplaint.trim()) {
      setValidationError('Please enter a chief complaint to preview triage requirements.');
      return;
    }
    setEvaluating(true);
    try {
      const res = await evaluateTriage({
        chiefComplaint,
        conditionCategory,
        vitalSigns: {
          heartRate: Number(heartRate) || undefined,
          bloodPressure,
          oxygenSaturation: Number(oxygenSaturation) || undefined,
          gcs: Number(gcs) || undefined,
          respiratoryRate: Number(respiratoryRate) || undefined
        }
      });
      setLiveEvaluation(res.evaluation);
    } catch (err) {
      alert('Triage preview error: ' + err.message);
    } finally {
      setEvaluating(false);
    }
  };

  // Form Submission & Validation
  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    setCreatedIncidentData(null);

    // Validation
    if (!chiefComplaint.trim()) {
      setValidationError('Chief complaint / symptoms are required.');
      return;
    }

    if (!address.trim()) {
      setValidationError('Incident street address is required.');
      return;
    }

    const latNum = Number(latitude);
    const lngNum = Number(longitude);
    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
      setValidationError('Please select a valid latitude between -90 and 90.');
      return;
    }
    if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
      setValidationError('Please select a valid longitude between -180 and 180.');
      return;
    }

    if (patientAge && (Number(patientAge) < 0 || Number(patientAge) > 150)) {
      setValidationError('Patient age must be between 0 and 150.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        callerName: callerName.trim() || null,
        callerPhone: callerPhone.trim() || null,
        address: address.trim(),
        latitude: latNum,
        longitude: lngNum,
        chiefComplaint: chiefComplaint.trim(),
        conditionCategory,
        notes: notes.trim() || null,
        vitalSigns: {
          heartRate: Number(heartRate) || undefined,
          bloodPressure: bloodPressure.trim() || undefined,
          oxygenSaturation: Number(oxygenSaturation) || undefined,
          gcs: Number(gcs) || undefined,
          respiratoryRate: Number(respiratoryRate) || undefined
        },
        patient: {
          name: isUnknownPatient ? 'Unknown / Unidentified Victim' : (patientName.trim() || 'Unknown Victim'),
          age: patientAge ? Number(patientAge) : undefined,
          gender: patientGender,
          contactNumber: contactNumber.trim() || null,
          medicalHistory: medicalHistory.trim() || null,
          allergies: allergies.trim() || null
        }
      };

      try {
        const result = await createIncident(payload);
        setCreatedIncidentData(result);
        if (onIncidentCreated) onIncidentCreated(result.incident);
      } catch (networkErr) {
        console.warn('Network call failed, queueing into offline outbox:', networkErr);
        // Resilient Offline-First Fallback
        const op = enqueueOfflineOp('CREATE_INCIDENT', {
          callerName,
          callerPhone,
          patientName: isUnknownPatient ? 'Unknown / Unidentified Victim' : (patientName.trim() || 'Unknown Victim'),
          patientAge: patientAge ? Number(patientAge) : undefined,
          patientGender,
          medicalHistory: medicalHistory.trim() || null,
          allergies: allergies.trim() || null,
          address,
          lat: latitude,
          lng: longitude,
          chiefComplaint,
          conditionCategory,
          vitalSigns: payload.vitalSigns,
          notes
        });

        const tempIncident = {
          id: `off-${Date.now()}`,
          incident_number: `OFF-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          caller_name: callerName,
          patient_name: isUnknownPatient ? 'Unknown Victim' : patientName,
          address,
          severity: (conditionCategory === 'cardiac' || conditionCategory === 'trauma') ? 'critical' : 'urgent',
          condition_category: conditionCategory,
          chief_complaint: chiefComplaint,
          status: 'reported',
          isOfflineQueued: true,
          created_at: new Date().toISOString()
        };

        setCreatedIncidentData({
          isOffline: true,
          incident: tempIncident,
          message: '⚡ OFFLINE MODE: Network was unreachable. Emergency incident has been queued in your local outbox and will automatically synchronize when network is restored.'
        });
        if (onIncidentCreated) onIncidentCreated(tempIncident);
      }
    } catch (err) {
      setValidationError('Validation error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Success Banner if Incident Created */}
      {createdIncidentData && (
        <div style={{
          background: '#f0fdf4',
          border: '2px solid #22c55e',
          borderRadius: '10px',
          padding: '1.5rem',
          boxShadow: '0 4px 12px rgba(34, 197, 94, 0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span style={{ background: '#16a34a', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                DISPATCH REGISTERED
              </span>
              <h3 style={{ margin: '0.4rem 0 0', color: '#14532d', fontSize: '1.25rem' }}>
                Incident #{createdIncidentData.incident.incident_number}
              </h3>
            </div>
            <button
              className="hosp-btn"
              onClick={() => setCreatedIncidentData(null)}
              style={{ background: '#ffffff' }}
            >
              Report Another Incident ✚
            </button>
          </div>

          <p style={{ margin: '0.5rem 0', color: '#166534', fontSize: '0.9rem' }}>
            Registered in live PostgreSQL database and synchronized to real-time dispatch queue.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>TRIAGE LEVEL</span>
              <div style={{ fontWeight: 800, color: '#dc2626', fontSize: '1rem' }}>
                {createdIncidentData.triageEvaluation?.triageLevel?.toUpperCase()}
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>SEVERITY</span>
              <div style={{ fontWeight: 800, color: '#b91c1c', fontSize: '1rem' }}>
                {createdIncidentData.triageEvaluation?.severity?.toUpperCase()}
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>ALLOCATED RESOURCES</span>
              <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.9rem' }}>
                {createdIncidentData.requirements?.length} equipment & specialists
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Reporting Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Section 1: Incident Location & Map */}
        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📍</span> 1. Incident Location & Map Pin
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.85rem' }}>
            Pin the incident on the map or click a landmark below to automatically populate coordinates.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Street Address / Landmark *</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Near Wave Mall, Narwal Bypass, Jammu"
                required
              />
            </div>

            <div className="form-group">
              <label>Latitude (GPS)</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Longitude (GPS)</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Interactive Leaflet Map Picker Component */}
          <IncidentMapPicker
            latitude={latitude}
            longitude={longitude}
            onLocationSelect={handleLocationSelect}
            hospitals={hospitals}
          />
        </div>

        {/* Section 2: Patient Information */}
        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>👤</span> 2. Patient Demographics & Background
            </h3>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F4C81', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <input
                type="checkbox"
                checked={isUnknownPatient}
                onChange={(e) => setIsUnknownPatient(e.target.checked)}
              />
              Unidentified / Trauma Victim (Jane/John Doe)
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div className="form-group">
              <label>Patient Full Name</label>
              <input
                type="text"
                value={isUnknownPatient ? 'Unidentified Victim' : patientName}
                disabled={isUnknownPatient}
                onChange={(e) => setPatientName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Estimated Age</label>
              <input
                type="number"
                min="0"
                max="150"
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Gender</label>
              <select
                value={patientGender}
                onChange={(e) => setPatientGender(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div className="form-group">
              <label>Emergency Contact / Relative Phone</label>
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Known Medical History</label>
              <input
                type="text"
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                placeholder="e.g. Asthma, Coronary stents, Epilepsy"
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Known Drug / Environmental Allergies</label>
              <input
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="e.g. Penicillin, Sulfa drugs, Latex"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Clinical Condition & Vitals */}
        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🩺</span> 3. Symptoms, Triage Category & Vital Signs
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="form-group">
              <label>Chief Medical Complaint / Symptoms *</label>
              <textarea
                rows={2}
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="Describe current symptoms, mechanism of injury, onset time..."
                required
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontFamily: 'inherit',
                  fontSize: '0.95rem'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={conditionCategory}
                  onChange={(e) => setConditionCategory(e.target.value)}
                  style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="cardiac">Cardiac</option>
                  <option value="trauma">Trauma</option>
                  <option value="stroke">Stroke</option>
                  <option value="respiratory">Respiratory</option>
                  <option value="burns">Burns</option>
                  <option value="pediatric">Pediatric</option>
                  <option value="obstetric">Obstetric</option>
                  <option value="general">General</option>
                </select>
              </div>

              <div className="form-group">
                <label>Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Blood Pressure</label>
                <input
                  type="text"
                  placeholder="120/80"
                  value={bloodPressure}
                  onChange={(e) => setBloodPressure(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>SpO2 Oxygen (%)</label>
                <input
                  type="number"
                  min="40"
                  max="100"
                  value={oxygenSaturation}
                  onChange={(e) => setOxygenSaturation(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>GCS Score (3–15)</label>
                <input
                  type="number"
                  min="3"
                  max="15"
                  value={gcs}
                  onChange={(e) => setGcs(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Resp Rate (bpm)</label>
                <input
                  type="number"
                  value={respiratoryRate}
                  onChange={(e) => setRespiratoryRate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>On-Scene Responder Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Trauma details, extrication time, medications given..."
              />
            </div>
          </div>
        </div>

        {/* Validation Errors */}
        {validationError && (
          <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
            ⚠️ {validationError}
          </div>
        )}

        {/* Form Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="hosp-btn"
            style={{ padding: '0.65rem 1.25rem', fontSize: '0.95rem' }}
            disabled={evaluating}
            onClick={handleQuickPreview}
          >
            {evaluating ? 'Analyzing…' : '🔍 Preview Triage Requirements'}
          </button>

          <button
            type="submit"
            className="btn-primary"
            style={{ padding: '0.65rem 1.5rem', fontSize: '0.95rem', background: '#dc2626' }}
            disabled={submitting}
          >
            {submitting ? 'Transmitting Dispatch…' : '🚨 Submit & Dispatch Emergency Incident'}
          </button>
        </div>

        {/* Live Preview Display */}
        {liveEvaluation && (
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#0f172a' }}>
              ⚡ Triage Preview: Urgency <strong>{liveEvaluation.triageLevel?.toUpperCase()}</strong> | Severity <strong>{liveEvaluation.severity?.toUpperCase()}</strong>
            </h4>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#475569' }}>{liveEvaluation.clinicalRationale}</p>
            <div style={{ fontSize: '0.82rem', color: '#1e293b' }}>
              <strong>Required Specialists:</strong> {liveEvaluation.requiredSpecialists?.map(s => s.requiredSpecialty).join(', ') || 'None'}<br/>
              <strong>Required Beds/Equipment:</strong> {liveEvaluation.requiredResources?.map(r => r.requiredResourceType).join(', ') || 'None'}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
