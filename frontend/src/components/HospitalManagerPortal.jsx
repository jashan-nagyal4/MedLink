/**
 * Hospital Manager Portal
 * 
 * Tailored command center for hospital triage staff & administrators:
 * 1. Targeted Incoming Emergency Dispatch Alert (listens to hospital room via WebSocket).
 * 2. Full Equipment / Bed Management (Add new categories, edit capacities, adjust availability, remove).
 * 3. Complete Doctor Specialist Roster Management (Add doctors, edit headcounts, toggle duty, remove).
 * 4. Active patients & treated incident log for this facility.
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import CleanDashboard from './CleanDashboard';
import {
  getHospitalDetails,
  updateHospitalResource,
  addHospitalResource,
  deleteHospitalResource,
  updateHospitalSpecialist,
  addHospitalSpecialist,
  deleteHospitalSpecialist,
  toggleSpecialistDuty,
  getHospitalBloodInventory,
  updateHospitalBloodInventory,
  getHospitalIncidents,
  respondToDispatch,
  updateIncidentStatus,
  deleteIncident
} from '../api';
import {
  joinHospitalRoom,
  leaveHospitalRoom,
  onDispatchRequest,
  onHospitalAccepted,
  onIncidentDeleted,
  onBloodUpdate
} from '../socket';
import { playEmergencySiren, stopEmergencySiren, playSuccessChime } from '../utils/audioAlert';

const PRESET_RESOURCES = [
  'Defibrillator Unit',
  'Mechanical Ventilator',
  'Defibrillator',
  'Ventilator',
  'ICU Bed',
  'General Ward Bed',
  'Pediatric ICU Bed',
  'Emergency Resuscitation Bay',
  'CT Scanner (64-Slice)',
  'MRI Scanner (1.5T)',
  'Operating Room (Trauma)',
  'Cardiac Telemetry Monitor',
  'Dialysis Machine',
  'Burn Unit Bed',
  'Negative Pressure Isolation Room'
];

const PRESET_SPECIALTIES = [
  'Internal Medicine',
  'Cardiology',
  'Ear, Nose and Throat',
  'Obstetrics and Gynaecology',
  'Paediatrics',
  'Ophthalmology',
  'Pathology',
  'Microbiology',
  'Pharmacology',
  'Psychiatry',
  'Radiodiagnosis',
  'Radiation Oncology',
  'Dermatology',
  'Neurology',
  'Urology',
  'Biochemistry',
  'Transfusion Medicine',
  'Physiology',
  'Emergency Medicine Physician',
  'Trauma Surgeon',
  'Pulmonologist',
  'Orthopedic Surgeon',
  'Critical Care Intensivist',
  'Anesthesiologist',
  'Pediatric Surgeon',
  'Neurosurgeon',
  'Vascular Surgeon',
  'General Surgeon'
];

const PRESET_DEPARTMENTS = [
  'Anaesthesiology',
  'Anatomy',
  'Biochemistry',
  'Blood Bank',
  'Blood Transfusion Medicine',
  'Cardiology',
  'Cardiothoracic & Vascular Surgery (CTVS)',
  'Community Medicine',
  'Critical Care',
  'CTVS',
  'Dental Surgery',
  'Dentistry',
  'Dermatology',
  'Dialysis',
  'Emergency',
  'Emergency Medicine',
  'ENT',
  'Forensic Medicine & Toxicology',
  'Gastroenterology',
  'General / Medical Services',
  'General Medicine',
  'General Surgery',
  'Internal Medicine',
  'Microbiology',
  'Neonatology',
  'Nephrology',
  'Neurology',
  'Neurosurgery',
  'Obstetrics & Gynaecology',
  'Ophthalmology',
  'Oral & Maxillofacial Surgery',
  'Orthopaedics',
  'Orthopaedics & Spine Surgery',
  'Paediatrics',
  'Paediatrics and Neonatology',
  'Pathology',
  'Pharmacology',
  'Physiology',
  'Physiotherapy and Dietetics',
  'Plastic Surgery',
  'Psychiatry',
  'Pulmonology',
  'Radiodiagnosis',
  'Radiology',
  'Radiotherapy',
  'Surgical Oncology',
  'Trauma Surgery',
  'Urology',
  'Vascular Surgery'
];

export default function HospitalManagerPortal({ activeSection = 'incidents', onSectionChange, onIncidentsCountChange }) {
  const currentSection = activeSection || 'incidents';
  const { user } = useAuth();
  const hospitalId = user?.hospital_id;

  const [hospitalData, setHospitalData] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter live vs resolved cases
  const liveIncidents = useMemo(() => {
    return incidents.filter(i => !['arrived', 'closed', 'resolved', 'cancelled', 'transferred'].includes(i.status));
  }, [incidents]);

  const resolvedIncidents = useMemo(() => {
    return incidents.filter(i => ['arrived', 'closed', 'resolved', 'cancelled', 'transferred'].includes(i.status));
  }, [incidents]);

  // Sync active live incidents count with LeftDock badge
  useEffect(() => {
    if (typeof onIncidentsCountChange === 'function') {
      onIncidentsCountChange(liveIncidents.length);
    }
  }, [liveIncidents.length, onIncidentsCountChange]);

  // Active incoming dispatch request targeting this hospital
  const [activeRequest, setActiveRequest] = useState(null);
  const [requestSecondsLeft, setRequestSecondsLeft] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  // Audio Siren & Pre-Arrival Preparation Checklist (Feature 3)
  const [sirenMuted, setSirenMuted] = useState(false);
  const [preArrivalChecklist, setPreArrivalChecklist] = useState({
    bayCleared: false,
    crashCartReady: false,
    ventilatorChecked: false,
    bloodBankStandby: false,
    surgeonPaged: false
  });

  // Resource Modal state (Add / Edit)
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [resTypeSelect, setResTypeSelect] = useState(PRESET_RESOURCES[0]);
  const [resCustomType, setResCustomType] = useState('');
  const [resTotalQty, setResTotalQty] = useState(10);
  const [resAvailQty, setResAvailQty] = useState(5);
  const [resStatus, setResStatus] = useState('available');
  const [resNotes, setResNotes] = useState('');
  const [resourceFilter, setResourceFilter] = useState('all');

  // Specialist Modal state (Add / Edit) & Shift Scheduling (Feature 5)
  const [showSpecialistModal, setShowSpecialistModal] = useState(false);
  const [editingSpecialist, setEditingSpecialist] = useState(null);
  const [specSelect, setSpecSelect] = useState(PRESET_SPECIALTIES[0]);
  const [specCustom, setSpecCustom] = useState('');
  const [specDepartment, setSpecDepartment] = useState('General Medicine');
  const [specCount, setSpecCount] = useState(1);
  const [specAvailable, setSpecAvailable] = useState(true);
  const [specDutyNotes, setSpecDutyNotes] = useState('');
  const [specDoctorName, setSpecDoctorName] = useState('');
  const [specShift, setSpecShift] = useState('Morning (08:00 - 16:00)');
  const [specPhone, setSpecPhone] = useState('');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
  const [doctorDeptFilter, setDoctorDeptFilter] = useState('all');
  const [doctorDutyFilter, setDoctorDutyFilter] = useState('all');

  // Emergency Blood Bank & Plasma Inventory State (Feature 1)
  const [bloodInventory, setBloodInventory] = useState([]);

  // Load hospital inventory and incidents
  const loadData = async () => {
    if (!hospitalId) return;
    try {
      setError('');
      const [details, incList] = await Promise.all([
        getHospitalDetails(hospitalId),
        getHospitalIncidents(hospitalId).catch(() => ({ incidents: [] }))
      ]);
      setHospitalData(details);
      setBloodInventory(details.bloodInventory || []);
      setIncidents(incList.incidents || []);
    } catch (err) {
      setError('Failed to load hospital data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [hospitalId]);

  // Join targeted hospital room on mount
  useEffect(() => {
    if (!hospitalId) return;

    joinHospitalRoom(hospitalId);
    console.log(`🏥 [HospitalPortal] Joined targeted room: hospital_${hospitalId}`);

    // Listen for incoming dispatch request targeting THIS hospital
    const unsubReq = onDispatchRequest((data) => {
      if (Number(data.targetHospitalId) === Number(hospitalId)) {
        console.log('🚨 [HospitalPortal] Incoming dispatch request targeting this facility!', data);
        setActiveRequest(data);
        setRequestSecondsLeft(data.timeoutSeconds || 45);
        // Reset checklist for new inbound patient
        setPreArrivalChecklist({
          bayCleared: false,
          crashCartReady: false,
          ventilatorChecked: false,
          bloodBankStandby: false,
          surgeonPaged: false
        });
      }
    });

    const unsubAcc = onHospitalAccepted((data) => {
      if (activeRequest && Number(data.incidentId) === Number(activeRequest.incidentId)) {
        stopEmergencySiren();
        setActiveRequest(null);
        loadData();
      }
    });

    const unsubDel = onIncidentDeleted((payload) => {
      const id = typeof payload === 'object' ? payload?.incidentId || payload?.id : payload;
      setIncidents((prev) => prev.filter((i) => Number(i.id) !== Number(id)));
      if (activeRequest && Number(activeRequest.incidentId) === Number(id)) {
        stopEmergencySiren();
        setActiveRequest(null);
      }
    });

    const unsubBlood = onBloodUpdate((data) => {
      if (Number(data.hospitalId) === Number(hospitalId)) {
        setBloodInventory((prev) =>
          prev.map((b) =>
            b.blood_group === data.bloodGroup
              ? { ...b, units_available: data.unitsAvailable, status: data.status }
              : b
          )
        );
      }
    });

    return () => {
      leaveHospitalRoom(hospitalId);
      unsubReq();
      unsubAcc();
      unsubDel();
      unsubBlood();
    };
  }, [hospitalId, activeRequest]);

  // Audio Siren controller for active request
  useEffect(() => {
    if (activeRequest) {
      if (!sirenMuted) {
        playEmergencySiren({ volume: 0.22 });
      } else {
        stopEmergencySiren();
      }
    } else {
      stopEmergencySiren();
    }
    return () => stopEmergencySiren();
  }, [activeRequest, sirenMuted]);

  // Request countdown timer
  useEffect(() => {
    if (activeRequest && requestSecondsLeft > 0) {
      const timer = setInterval(() => {
        setRequestSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            stopEmergencySiren();
            setActiveRequest(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [activeRequest, requestSecondsLeft]);

  // Handle Accept incoming dispatch
  const handleAcceptRequest = async () => {
    if (!activeRequest) return;
    setActionLoading(true);
    stopEmergencySiren();
    try {
      await respondToDispatch(activeRequest.incidentId, {
        hospitalId,
        action: 'accept',
        reason: 'Confirmed by hospital triage coordinator: pre-arrival bay prepped'
      });
      playSuccessChime();
      alert(`✅ Emergency incident #${activeRequest.incidentNumber} ACCEPTED! Triage team alerted.`);
      setActiveRequest(null);
      loadData();
    } catch (err) {
      alert('Accept failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Decline incoming dispatch
  const handleDeclineRequest = async () => {
    if (!activeRequest) return;
    stopEmergencySiren();
    const reason = window.prompt(
      'Enter clinical reason for declining this request (will trigger automatic escalation):',
      'ICU and Emergency Bays currently at capacity'
    );
    if (!reason) return;

    setActionLoading(true);
    try {
      await respondToDispatch(activeRequest.incidentId, {
        hospitalId,
        action: 'reject',
        reason
      });
      alert(`⚠️ Request declined. MedLink engine is automatically escalating to the next ranked hospital.`);
      setActiveRequest(null);
      loadData();
    } catch (err) {
      alert('Decline failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Hospital Manager manages the ambulance status directly
  const handleUpdateAmbulanceStatus = async (inc, newStatus) => {
    setActionLoading(true);
    try {
      await updateIncidentStatus(inc.id, newStatus);
      setIncidents((prev) =>
        prev.map((i) => (i.id === inc.id ? { ...i, status: newStatus } : i))
      );
      playSuccessChime();
    } catch (err) {
      alert('Failed to update ambulance status: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Hospital Manager deletes an incident permanently
  const handleDeleteIncident = async (inc) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete emergency incident #${inc.incident_number}? This cannot be undone.`
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      await deleteIncident(inc.id);
      setIncidents((prev) => prev.filter((i) => i.id !== inc.id));
      alert(`✓ Emergency incident #${inc.incident_number} deleted successfully.`);
    } catch (err) {
      alert('Failed to delete incident: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Quick increment/decrement available count
  const handleAdjustResource = async (resource, delta) => {
    const newQty = resource.available_quantity + delta;
    if (newQty < 0 || newQty > resource.total_quantity) return;

    try {
      await updateHospitalResource(hospitalId, resource.id, {
        availableQuantity: newQty
      });
      setHospitalData((prev) => ({
        ...prev,
        resources: prev.resources.map((r) =>
          r.id === resource.id ? { ...r, available_quantity: newQty } : r
        )
      }));
    } catch (err) {
      alert('Failed to update capacity: ' + err.message);
    }
  };

  // Handle Adjust Blood Inventory Units (Feature 1)
  const handleAdjustBlood = async (bloodGroup, delta) => {
    const current = bloodInventory.find((b) => b.blood_group === bloodGroup);
    const curUnits = current ? current.units_available : 0;
    const newUnits = Math.max(0, curUnits + delta);
    const newStatus = newUnits === 0 ? 'critical_shortage' : newUnits < 5 ? 'low' : 'adequate';

    try {
      await updateHospitalBloodInventory(hospitalId, {
        bloodGroup,
        unitsAvailable: newUnits,
        status: newStatus
      });
      setBloodInventory((prev) =>
        prev.map((b) =>
          b.blood_group === bloodGroup
            ? { ...b, units_available: newUnits, status: newStatus }
            : b
        )
      );
    } catch (err) {
      alert('Failed to update blood inventory: ' + err.message);
    }
  };

  // Quick toggle on/off duty (Feature 5)
  const handleToggleSpecialist = async (specialist) => {
    try {
      const res = await toggleSpecialistDuty(hospitalId, specialist.id);
      if (res && res.specialist) {
        setHospitalData((prev) => ({
          ...prev,
          specialists: prev.specialists.map((s) =>
            s.id === specialist.id ? { ...s, available: res.specialist.available, on_duty: res.specialist.on_duty } : s
          )
        }));
      } else {
        await loadData();
      }
    } catch (err) {
      alert('Failed to update doctor duty status: ' + err.message);
    }
  };

  // Open Resource Modal for Add
  const handleOpenAddResource = () => {
    setEditingResource(null);
    setResTypeSelect(PRESET_RESOURCES[0]);
    setResCustomType('');
    setResTotalQty(10);
    setResAvailQty(5);
    setResStatus('available');
    setResNotes('');
    setShowResourceModal(true);
  };

  // Open Resource Modal for Edit
  const handleOpenEditResource = (res) => {
    setEditingResource(res);
    if (PRESET_RESOURCES.includes(res.resource_type)) {
      setResTypeSelect(res.resource_type);
      setResCustomType('');
    } else {
      setResTypeSelect('OTHER');
      setResCustomType(res.resource_type);
    }
    setResTotalQty(res.total_quantity);
    setResAvailQty(res.available_quantity);
    setResStatus(res.status || 'available');
    setResNotes(res.notes || '');
    setShowResourceModal(true);
  };

  // Save Resource (Add or Update)
  const handleSaveResource = async (e) => {
    e.preventDefault();
    const finalType = resTypeSelect === 'OTHER' ? resCustomType.trim() : resTypeSelect;
    if (!finalType) {
      alert('Please specify the resource type name.');
      return;
    }

    const total = Math.max(0, Number(resTotalQty) || 0);
    const avail = Math.min(total, Math.max(0, Number(resAvailQty) || 0));

    setActionLoading(true);
    try {
      if (editingResource) {
        await updateHospitalResource(hospitalId, editingResource.id, {
          totalQuantity: total,
          availableQuantity: avail,
          status: resStatus,
          notes: resNotes
        });
      } else {
        await addHospitalResource(hospitalId, {
          resourceType: finalType,
          totalQuantity: total,
          availableQuantity: avail,
          status: resStatus,
          notes: resNotes
        });
      }
      setShowResourceModal(false);
      await loadData();
    } catch (err) {
      alert('Error saving resource: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Resource
  const handleDeleteResource = async (res) => {
    if (!window.confirm(`Are you sure you want to remove "${res.resource_type}" from your hospital's capacity?`)) return;
    try {
      await deleteHospitalResource(hospitalId, res.id);
      await loadData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Open Specialist Modal for Add
  const handleOpenAddSpecialist = () => {
    setEditingSpecialist(null);
    setSpecSelect(PRESET_SPECIALTIES[0]);
    setSpecCustom('');
    setSpecDepartment('General Medicine');
    setSpecDoctorName('');
    setSpecShift('Morning (08:00 - 16:00)');
    setSpecPhone('');
    setSpecCount(1);
    setSpecAvailable(true);
    setSpecDutyNotes('On primary emergency rotation');
    setShowSpecialistModal(true);
  };

  // Open Specialist Modal for Edit
  const handleOpenEditSpecialist = (spec) => {
    setEditingSpecialist(spec);
    if (PRESET_SPECIALTIES.includes(spec.specialty)) {
      setSpecSelect(spec.specialty);
      setSpecCustom('');
    } else {
      setSpecSelect('OTHER');
      setSpecCustom(spec.specialty);
    }
    setSpecDepartment(spec.department || 'General Medicine');
    setSpecDoctorName(spec.doctor_name || '');
    setSpecShift(spec.shift || 'Morning (08:00 - 16:00)');
    setSpecPhone(spec.contact_phone || '');
    setSpecCount(spec.count_available || 1);
    setSpecAvailable(spec.available !== undefined ? spec.available : true);
    setSpecDutyNotes(spec.duty_notes || '');
    setShowSpecialistModal(true);
  };

  // Save Specialist (Add or Update)
  const handleSaveSpecialist = async (e) => {
    e.preventDefault();
    const finalSpec = specSelect === 'OTHER' ? specCustom.trim() : specSelect;
    if (!finalSpec) {
      alert('Please specify the specialty or doctor title.');
      return;
    }

    const count = Math.max(0, Number(specCount) || 0);

    setActionLoading(true);
    try {
      if (editingSpecialist) {
        await updateHospitalSpecialist(hospitalId, editingSpecialist.id, {
          specialty: finalSpec,
          department: specDepartment,
          available: specAvailable && count > 0,
          countAvailable: count,
          dutyNotes: specDutyNotes,
          doctorName: specDoctorName,
          shift: specShift,
          contactPhone: specPhone,
          onDuty: specAvailable
        });
      } else {
        await addHospitalSpecialist(hospitalId, {
          specialty: finalSpec,
          department: specDepartment,
          available: specAvailable && count > 0,
          countAvailable: count,
          dutyNotes: specDutyNotes,
          doctorName: specDoctorName,
          shift: specShift,
          contactPhone: specPhone,
          onDuty: specAvailable
        });
      }
      setShowSpecialistModal(false);
      await loadData();
    } catch (err) {
      alert('Error saving specialist: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Specialist
  const handleDeleteSpecialist = async (spec) => {
    if (!window.confirm(`Are you sure you want to remove "${spec.specialty}" from your doctor roster?`)) return;
    try {
      await deleteHospitalSpecialist(hospitalId, spec.id);
      await loadData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
        <p style={{ fontSize: '1.1rem' }}>Loading hospital portal & operational capacity...</p>
      </div>
    );
  }

  const hospital = hospitalData?.hospital;
  const resources = hospitalData?.resources || [];
  const specialists = hospitalData?.specialists || [];

  const glassCardStyle = {
    background: 'rgba(255, 255, 255, 0.84)',
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.85)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(15, 76, 129, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.95)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Hospital Identity Header Card */}
      <div style={{
        ...glassCardStyle,
        padding: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <span style={{
              background: '#dcfce7',
              color: '#15803d',
              padding: '0.2rem 0.6rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase'
            }}>
              🏥 HOSPITAL TRIAGE & RESOURCE MANAGER
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Facility ID #{hospitalId}
            </span>
          </div>

          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
            {hospital?.name || user?.hospital_name || 'Hospital Triage Facility'}
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#64748b' }}>
            📍 {hospital?.address} · 📞 {hospital?.phone || 'Emergency Direct Line Active'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 6px #16a34a', animation: 'pulse 1.5s infinite' }} />
            <span>Live Sync Active</span>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px' }}>
          {error}
        </div>
      )}



      {/* 🚨 Real-time Incoming Dispatch Alert Card (Flashes when request arrives) */}
      {activeRequest && (
        <div style={{
          background: '#fff1f2',
          border: '2px solid #f43f5e',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 8px 24px rgba(244, 63, 94, 0.25)',
          animation: 'pulse 1.5s infinite'
        }}>
          {/* Top Bar with Siren Audio & Countdown */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{
                  background: '#ffe4e6',
                  color: '#e11d48',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  textTransform: 'uppercase'
                }}>
                  🚨 INCOMING EMERGENCY ALLOCATION REQUEST
                </span>

                <button
                  type="button"
                  onClick={() => setSirenMuted(!sirenMuted)}
                  style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: sirenMuted ? '#f1f5f9' : '#fee2e2',
                    color: sirenMuted ? '#64748b' : '#dc2626',
                    border: '1px solid #fca5a5'
                  }}
                >
                  {sirenMuted ? '🔔 Sound Siren' : '🔕 Mute Siren'}
                </button>
              </div>

              <h3 style={{ margin: '0.5rem 0 0.2rem', fontSize: '1.35rem', color: '#881337' }}>
                Incident #{activeRequest.incidentNumber} — {activeRequest.conditionCategory?.toUpperCase()}
              </h3>

              <p style={{ margin: 0, fontSize: '0.95rem', color: '#9f1239' }}>
                👤 Patient: <strong>{activeRequest.patient?.name || 'Unidentified'}</strong> ({activeRequest.patient?.age || '?'} yo, {activeRequest.patient?.gender})
              </p>
              <p style={{ margin: '0.2rem 0', fontSize: '0.88rem', color: '#4c0519', fontStyle: 'italic' }}>
                Chief Complaint: "{activeRequest.chiefComplaint}"
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#9f1239' }}>
                🚗 Transit: {activeRequest.distanceKm} km away (~{activeRequest.travelTimeMinutes} mins)
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#e11d48', fontVariantNumeric: 'tabular-nums' }}>
                {requestSecondsLeft}s
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9f1239', textTransform: 'uppercase' }}>
                Auto-Escalation Countdown
              </span>
            </div>
          </div>

          {/* Pre-Arrival Preparation Checklist (Feature 3) */}
          <div style={{
            marginTop: '1rem',
            background: '#ffffff',
            border: '1px solid #fecdd3',
            borderRadius: '10px',
            padding: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1rem' }}>📋</span>
                <strong style={{ fontSize: '0.88rem', color: '#881337' }}>
                  Pre-Arrival Triage Preparation Checklist
                </strong>
                {(() => {
                  const readyCount = Object.values(preArrivalChecklist).filter(Boolean).length;
                  const pct = Math.round((readyCount / 5) * 100);
                  return (
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '12px',
                      background: pct === 100 ? '#dcfce7' : '#fef3c7',
                      color: pct === 100 ? '#15803d' : '#92400e'
                    }}>
                      {readyCount}/5 Ready ({pct}%)
                    </span>
                  );
                })()}
              </div>

              <button
                type="button"
                onClick={() => setPreArrivalChecklist({
                  bayCleared: true,
                  crashCartReady: true,
                  ventilatorChecked: true,
                  bloodBankStandby: true,
                  surgeonPaged: true
                })}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.55rem',
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                ✓ Mark All 5 Ready
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.5rem', fontSize: '0.8rem', color: '#334155' }}>
              {[
                { key: 'bayCleared', label: '🚨 Resuscitation Bay 1 Cleared & Sanitized' },
                { key: 'crashCartReady', label: '⚡ Crash Cart & Defibrillator Tested' },
                { key: 'ventilatorChecked', label: '🫁 Ventilator Circuit & O2 Primed' },
                { key: 'bloodBankStandby', label: '🩸 Blood Bank Notified (O-Neg Units)' },
                { key: 'surgeonPaged', label: '👨‍⚕️ On-Call Trauma Specialist Paged' }
              ].map((item) => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preArrivalChecklist[item.key]}
                    onChange={(e) => setPreArrivalChecklist((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: preArrivalChecklist[item.key] ? 700 : 400, color: preArrivalChecklist[item.key] ? '#15803d' : '#334155' }}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div style={{
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid #fecdd3',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem'
          }}>
            <button
              className="hosp-btn"
              style={{ background: '#ffffff', color: '#991b1b', border: '1px solid #fda4af', padding: '0.6rem 1.25rem', fontWeight: 700 }}
              disabled={actionLoading}
              onClick={handleDeclineRequest}
            >
              ✕ Decline & Auto-Escalate
            </button>
            <button
              className="btn-primary"
              style={{ background: '#16a34a', padding: '0.6rem 1.5rem', fontWeight: 700, fontSize: '0.95rem' }}
              disabled={actionLoading}
              onClick={handleAcceptRequest}
            >
              {actionLoading ? 'Confirming...' : '✓ Accept Patient & Lock Beds'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* CLEAN MINIMAL DASHBOARD VIEW (Donuts, Pie Charts, Graphs)   */}
      {/* ========================================================== */}
      {currentSection === 'dashboard' && (
        <CleanDashboard
          hospitalData={hospitalData}
          bloodInventory={bloodInventory}
          incidents={incidents}
          isAdmin={false}
          onNavigate={(sec) => onSectionChange && onSectionChange(sec)}
        />
      )}

      {/* ========================================================== */}
      {/* RELEVANCE PRIORITY 1: Emergency Incidents & Patient Queue  */}
      {/* ========================================================== */}
      {(currentSection === 'incidents' || currentSection === 'all') && (
        <div style={{
          ...glassCardStyle,
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                📋 Live Emergency Incident Queue ({liveIncidents.length})
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Active inbound dispatches and ambulance transit status for this facility
              </p>
            </div>
          </div>

          {liveIncidents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🟢</span>
              <p style={{ color: '#0f172a', fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>
                No active emergency incidents currently pending for this facility.
              </p>
              <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                All previous cases have arrived or been admitted. Completed cases are purged automatically to free up cache space.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {liveIncidents.map((inc) => (
                <div
                  key={inc.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong style={{ color: '#dc2626', fontSize: '0.95rem' }}>{inc.incident_number}</strong>
                        <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                          {inc.condition_category?.toUpperCase()}
                        </span>
                        <span className="badge" style={{
                          background: inc.status === 'assigned' ? '#dcfce7' : '#CCFBF1',
                          color: inc.status === 'assigned' ? '#15803d' : '#0F766E',
                          fontWeight: 700
                        }}>
                          {inc.status?.toUpperCase()}
                        </span>
                      </div>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#1e293b' }}>
                        👤 <strong>{inc.patient_name || 'Patient'}</strong> · 📍 {inc.address}
                      </p>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                        "{inc.chief_complaint}"
                      </p>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'right' }}>
                      {new Date(inc.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Ambulance Status Controller Bar (Hospital Manager Only) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f1f5f9',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#1e293b' }}>
                        AMBULANCE STATUS:
                      </span>
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '12px',
                        background: inc.status === 'arrived' || inc.status === 'closed' ? '#dcfce7' : '#CCFBF1',
                        color: inc.status === 'arrived' || inc.status === 'closed' ? '#15803d' : '#0F766E'
                      }}>
                        {inc.status === 'assigned' ? 'DISPATCHED' : inc.status?.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Manage Status:</span>
                      {[
                        { key: 'assigned', label: '🚨 Dispatched' },
                        { key: 'assessing', label: '🩺 On Scene' },
                        { key: 'en_route', label: '🚑 En Route' },
                        { key: 'arrived', label: '🏥 Arrived' },
                        { key: 'resolved', label: '✅ Resolved' }
                      ].map((st) => (
                        <button
                          key={st.key}
                          disabled={actionLoading || inc.status === st.key}
                          onClick={() => handleUpdateAmbulanceStatus(inc, st.key)}
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: inc.status === st.key ? 800 : 500,
                            cursor: inc.status === st.key ? 'default' : 'pointer',
                            background: inc.status === st.key ? '#0284c7' : '#ffffff',
                            color: inc.status === st.key ? '#ffffff' : '#334155',
                            border: inc.status === st.key ? '1px solid #0284c7' : '1px solid #cbd5e1'
                          }}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Action Toolbar */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
                    <button
                      className="hosp-btn"
                      style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', fontWeight: 700 }}
                      onClick={() => handleDeleteIncident(inc)}
                      title="Permanently delete incident"
                    >
                      🗑️ Delete Incident
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* RELEVANCE PRIORITY 2 & 3: Beds & Equipment + Doctors Roster*/}
      {/* ========================================================== */}
      {(currentSection === 'beds' || currentSection === 'doctors' || currentSection === 'all') && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: currentSection === 'all' ? 'repeat(auto-fit, minmax(420px, 1fr))' : '1fr',
          gap: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          
          {/* Priority 2: Beds & Critical Equipment Management */}
          {(currentSection === 'beds' || currentSection === 'all') && (
            <div style={{
              ...glassCardStyle,
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                    🛏️ Hospital Beds & Medical Equipment
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Add new equipment or adjust open capacities in real-time
                  </p>
                </div>

                <button
                  className="btn-primary"
                  style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', background: '#0F4C81' }}
                  onClick={handleOpenAddResource}
                >
                  ✚ Add Equipment / Bed
                </button>
              </div>

              {/* Equipment Category Filters */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {[
                  { id: 'all', label: 'All Equipment', count: resources.length },
                  { id: 'defibrillator', label: '⚡ Defibrillators', count: resources.filter(r => r.resource_type.toLowerCase().includes('defibrillator')).length },
                  { id: 'ventilator', label: '🫁 Ventilators', count: resources.filter(r => r.resource_type.toLowerCase().includes('ventilator')).length },
                  { id: 'bed', label: '🛏️ Hospital Beds', count: resources.filter(r => r.resource_type.toLowerCase().includes('bed') || r.resource_type.toLowerCase().includes('bay')).length },
                  { id: 'diagnostic', label: '🔬 Imaging & OR', count: resources.filter(r => r.resource_type.toLowerCase().includes('ct') || r.resource_type.toLowerCase().includes('mri') || r.resource_type.toLowerCase().includes('operating')).length }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setResourceFilter(f.id)}
                    style={{
                      border: '1px solid ' + (resourceFilter === f.id ? '#0F4C81' : '#e2e8f0'),
                      borderRadius: '20px',
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: resourceFilter === f.id ? '#F0FDFA' : '#ffffff',
                      color: resourceFilter === f.id ? '#0F766E' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                {resources.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No equipment or beds added yet.</p>
                ) : (
                  resources
                    .filter(res => {
                      const name = (res.resource_type || '').toLowerCase();
                      if (resourceFilter === 'defibrillator') return name.includes('defibrillator');
                      if (resourceFilter === 'ventilator') return name.includes('ventilator');
                      if (resourceFilter === 'bed') return name.includes('bed') || name.includes('bay');
                      if (resourceFilter === 'diagnostic') return name.includes('ct') || name.includes('mri') || name.includes('operating');
                      return true;
                    })
                    .map((res) => {
                    const isLow = res.available_quantity <= 2;
                    return (
                      <div
                        key={res.id}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '0.85rem 1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <h4 style={{ margin: 0, fontSize: '0.98rem', color: '#1e293b' }}>
                                {res.resource_type}
                              </h4>
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                background: res.status === 'available' ? '#dcfce7' : '#fee2e2',
                                color: res.status === 'available' ? '#15803d' : '#991b1b',
                                textTransform: 'uppercase'
                              }}>
                                {res.status}
                              </span>
                            </div>

                            {/* Clinical Triage Category Recognition Badge */}
                            {res.resource_type.toLowerCase().includes('defibrillator') ? (
                              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '4px',
                                  background: '#fee2e2',
                                  color: '#991b1b',
                                  border: '1px solid #fecaca'
                                }}>
                                  ⚡ Cardiac Resuscitation · Triage Priority
                                </span>
                                <span style={{ fontSize: '0.66rem', color: '#16a34a', fontWeight: 600 }}>✓ Triage Recognized</span>
                              </div>
                            ) : res.resource_type.toLowerCase().includes('ventilator') ? (
                              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '4px',
                                  background: '#dbeafe',
                                  color: '#1e40af',
                                  border: '1px solid #bfdbfe'
                                }}>
                                  🫁 Mechanical Ventilation · Triage Priority
                                </span>
                                <span style={{ fontSize: '0.66rem', color: '#16a34a', fontWeight: 600 }}>✓ Triage Recognized</span>
                              </div>
                            ) : res.resource_type.toLowerCase().includes('icu') ? (
                              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '4px',
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  border: '1px solid #fde68a'
                                }}>
                                  🛏️ Critical Care Bed · Triage Priority
                                </span>
                                <span style={{ fontSize: '0.66rem', color: '#16a34a', fontWeight: 600 }}>✓ Triage Recognized</span>
                              </div>
                            ) : null}

                            {res.notes && (
                              <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', display: 'block', marginTop: '0.2rem' }}>
                                {res.notes}
                              </span>
                            )}
                          </div>

                          {/* Quick Adjust Buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{
                              fontSize: '1.15rem',
                              fontWeight: 800,
                              color: isLow ? '#dc2626' : '#16a34a',
                              minWidth: '55px',
                              textAlign: 'right'
                            }}>
                              {res.available_quantity} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>/ {res.total_quantity}</span>
                            </span>

                            <button
                              className="hosp-btn"
                              style={{ padding: '0.15rem 0.5rem', fontSize: '0.95rem', fontWeight: 800 }}
                              disabled={res.available_quantity <= 0}
                              onClick={() => handleAdjustResource(res, -1)}
                              title="Decrement Available Count"
                            >
                              −
                            </button>

                            <button
                              className="hosp-btn"
                              style={{ padding: '0.15rem 0.5rem', fontSize: '0.95rem', fontWeight: 800, background: '#CCFBF1', color: '#0F766E' }}
                              disabled={res.available_quantity >= res.total_quantity}
                              onClick={() => handleAdjustResource(res, 1)}
                              title="Increment Available Count"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Manage actions (Edit / Delete) */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.4rem' }}>
                          <button
                            className="hosp-btn"
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => handleOpenEditResource(res)}
                          >
                            ✏️ Edit Capacity
                          </button>
                          <button
                            className="hosp-btn"
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: '#dc2626' }}
                            onClick={() => handleDeleteResource(res)}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Priority 3: Specialists / Doctors Management */}
          {(currentSection === 'doctors' || currentSection === 'all') && (() => {
            const totalDoctors = specialists.length;
            const onDutyDoctors = specialists.filter(s => (s.on_duty !== undefined ? s.on_duty : s.available)).length;
            const offDutyDoctors = totalDoctors - onDutyDoctors;
            const uniqueDepts = Array.from(new Set(specialists.map(s => s.department).filter(Boolean))).sort();
            const coveredDepts = new Set(
              specialists
                .filter(s => (s.on_duty !== undefined ? s.on_duty : s.available) && s.department)
                .map(s => s.department)
            ).size;

            const filteredSpecialists = specialists.filter((s) => {
              const isOnDuty = s.on_duty !== undefined ? s.on_duty : s.available;
              // 1. Shift filter
              if (shiftFilter !== 'all' && (!s.shift || !s.shift.toLowerCase().includes(shiftFilter.toLowerCase()))) {
                return false;
              }
              // 2. Department filter
              if (doctorDeptFilter !== 'all' && (s.department || '').toLowerCase() !== doctorDeptFilter.toLowerCase()) {
                return false;
              }
              // 3. Duty status filter
              if (doctorDutyFilter === 'on_duty' && !isOnDuty) return false;
              if (doctorDutyFilter === 'off_duty' && isOnDuty) return false;
              // 4. Search query
              if (doctorSearchQuery.trim()) {
                const q = doctorSearchQuery.toLowerCase();
                const name = (s.doctor_name || '').toLowerCase();
                const specialty = (s.specialty || '').toLowerCase();
                const dept = (s.department || '').toLowerCase();
                const phone = (s.contact_phone || '').toLowerCase();
                const notes = (s.duty_notes || '').toLowerCase();
                if (!name.includes(q) && !specialty.includes(q) && !dept.includes(q) && !phone.includes(q) && !notes.includes(q)) {
                  return false;
                }
              }
              return true;
            });

            return (
              <div style={{
                ...glassCardStyle,
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                {/* Header & Add Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>👨‍⚕️</span> Duty Doctors & Faculty Emergency Roster
                    </h3>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                      24/7 rotational clinical duty coverage across all hospital departments and specialties
                    </p>
                  </div>

                  <button
                    className="btn-primary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', background: '#0f766e', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    onClick={handleOpenAddSpecialist}
                  >
                    <span>✚</span> Add Doctor / Specialist
                  </button>
                </div>

                {/* KPI Roster Stats Banner */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.75rem',
                  background: '#f8fafc',
                  padding: '0.85rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Doctors</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{totalDoctors}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>🟢 On-Duty Active</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>{onDutyDoctors}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>⚪ On Standby</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#475569' }}>{offDutyDoctors}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600, textTransform: 'uppercase' }}>🏢 Active Depts Covered</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7' }}>{coveredDepts} / {uniqueDepts.length || 1}</span>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '0.85rem'
                }}>
                  <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                    {/* Search Input */}
                    <div style={{ flex: '2 1 240px', position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="🔍 Search by doctor name, specialty, department, phone, notes..."
                        value={doctorSearchQuery}
                        onChange={(e) => setDoctorSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.85rem',
                          boxSizing: 'border-box'
                        }}
                      />
                      {doctorSearchQuery && (
                        <button
                          onClick={() => setDoctorSearchQuery('')}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            fontSize: '0.9rem'
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Department Dropdown Filter */}
                    <div style={{ flex: '1 1 200px' }}>
                      <select
                        value={doctorDeptFilter}
                        onChange={(e) => setDoctorDeptFilter(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.65rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.85rem',
                          background: '#ffffff',
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value="all">🏢 All Departments ({totalDoctors})</option>
                        {uniqueDepts.map((dept) => {
                          const count = specialists.filter(s => (s.department || '').toLowerCase() === dept.toLowerCase()).length;
                          return (
                            <option key={dept} value={dept}>
                              {dept} ({count})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Filter Pills: Shifts & Duty Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
                    {/* Shift Filter Pills */}
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginRight: '0.2rem' }}>Shift:</span>
                      {['all', 'Morning', 'Evening', 'Night'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          style={{
                            fontSize: '0.74rem',
                            padding: '0.25rem 0.65rem',
                            borderRadius: '16px',
                            background: shiftFilter === s ? '#0f766e' : '#f1f5f9',
                            color: shiftFilter === s ? '#ffffff' : '#475569',
                            border: '1px solid ' + (shiftFilter === s ? '#0f766e' : '#e2e8f0'),
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onClick={() => setShiftFilter(s)}
                        >
                          {s === 'all' ? '🌐 All Shifts' : s === 'Morning' ? '🌅 Morning' : s === 'Evening' ? '🌇 Evening' : '🌙 Night'}
                        </button>
                      ))}
                    </div>

                    {/* Duty Status Pills */}
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginRight: '0.2rem' }}>Status:</span>
                      {[
                        { id: 'all', label: 'All Status' },
                        { id: 'on_duty', label: '🟢 On-Duty Only' },
                        { id: 'off_duty', label: '⚪ Off-Duty Only' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          style={{
                            fontSize: '0.74rem',
                            padding: '0.25rem 0.65rem',
                            borderRadius: '16px',
                            background: doctorDutyFilter === item.id ? '#1e293b' : '#f1f5f9',
                            color: doctorDutyFilter === item.id ? '#ffffff' : '#475569',
                            border: '1px solid ' + (doctorDutyFilter === item.id ? '#1e293b' : '#e2e8f0'),
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onClick={() => setDoctorDutyFilter(item.id)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Filter Results Summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                  <span>
                    Showing <strong>{filteredSpecialists.length}</strong> of <strong>{totalDoctors}</strong> doctors
                    {doctorDeptFilter !== 'all' ? ` in "${doctorDeptFilter}"` : ''}
                    {shiftFilter !== 'all' ? ` · ${shiftFilter} shift` : ''}
                    {doctorDutyFilter === 'on_duty' ? ' · On-Duty only' : doctorDutyFilter === 'off_duty' ? ' · Off-Duty only' : ''}
                  </span>
                  {(doctorSearchQuery || doctorDeptFilter !== 'all' || shiftFilter !== 'all' || doctorDutyFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setDoctorSearchQuery('');
                        setDoctorDeptFilter('all');
                        setShiftFilter('all');
                        setDoctorDutyFilter('all');
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#0284c7',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.76rem',
                        textDecoration: 'underline'
                      }}
                    >
                      Reset All Filters
                    </button>
                  )}
                </div>

                {/* Specialists Cards Grid / List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                  {filteredSpecialists.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '2.5rem 1rem',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px dashed #cbd5e1'
                    }}>
                      <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>No doctors match the selected filters.</p>
                      <p style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.8rem', color: '#94a3b8' }}>Try adjusting your search query, department, or shift criteria.</p>
                      <button
                        className="hosp-btn"
                        onClick={() => {
                          setDoctorSearchQuery('');
                          setDoctorDeptFilter('all');
                          setShiftFilter('all');
                          setDoctorDutyFilter('all');
                        }}
                      >
                        Reset All Filters
                      </button>
                    </div>
                  ) : (
                    filteredSpecialists.map((spec) => {
                      const isOnDuty = spec.on_duty !== undefined ? spec.on_duty : spec.available;
                      return (
                        <div
                          key={spec.id}
                          style={{
                            background: isOnDuty ? '#ffffff' : '#f8fafc',
                            border: '1px solid ' + (isOnDuty ? '#a7f3d0' : '#e2e8f0'),
                            borderRadius: '10px',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.6rem',
                            boxShadow: isOnDuty ? '0 2px 6px rgba(16, 185, 129, 0.08)' : 'none',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.65rem' }}>
                            <div>
                              {/* Doctor Name & Badges */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                <h4 style={{ margin: 0, fontSize: '1.02rem', color: '#0f172a', fontWeight: 700 }}>
                                  👨‍⚕️ {spec.doctor_name || spec.specialty}
                                </h4>

                                {spec.department && (
                                  <span style={{
                                    fontSize: '0.72rem',
                                    background: '#f1f5f9',
                                    color: '#334155',
                                    fontWeight: 700,
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1'
                                  }}>
                                    🏢 {spec.department}
                                  </span>
                                )}

                                <span style={{
                                  fontSize: '0.72rem',
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  fontWeight: 600,
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '6px'
                                }}>
                                  🩺 {spec.specialty}
                                </span>

                                {spec.shift && (
                                  <span style={{
                                    fontSize: '0.72rem',
                                    background: spec.shift.includes('Morning') ? '#fef3c7' : spec.shift.includes('Evening') ? '#ffedd5' : '#e0e7ff',
                                    color: spec.shift.includes('Morning') ? '#92400e' : spec.shift.includes('Evening') ? '#9a3412' : '#3730a3',
                                    fontWeight: 600,
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '6px'
                                  }}>
                                    {spec.shift}
                                  </span>
                                )}
                              </div>

                              {/* Duty Status, Contact, & Notes */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: '0.82rem',
                                  color: isOnDuty ? '#15803d' : '#64748b',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem'
                                }}>
                                  <span style={{
                                    display: 'inline-block',
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: isOnDuty ? '#16a34a' : '#94a3b8',
                                    boxShadow: isOnDuty ? '0 0 6px rgba(22, 163, 74, 0.6)' : 'none'
                                  }} />
                                  {isOnDuty ? `ON-DUTY ACTIVE (${spec.count_available || 1})` : 'STANDBY / OFF-DUTY'}
                                </span>

                                {spec.contact_phone && (
                                  <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 500 }}>
                                    📞 {spec.contact_phone}
                                  </span>
                                )}

                                {spec.duty_notes && (
                                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                                    📝 {spec.duty_notes}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 1-Click Duty Shift Toggle Button */}
                            <button
                              className="hosp-btn"
                              style={{
                                background: isOnDuty ? '#fee2e2' : '#dcfce7',
                                color: isOnDuty ? '#991b1b' : '#15803d',
                                border: '1px solid ' + (isOnDuty ? '#fecaca' : '#bbf7d0'),
                                fontWeight: 700,
                                padding: '0.4rem 0.9rem',
                                fontSize: '0.8rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onClick={() => handleToggleSpecialist(spec)}
                              title={isOnDuty ? 'Set doctor off duty' : 'Set doctor active on duty'}
                            >
                              {isOnDuty ? '⏸ Set Off-Duty' : '▶ Set On-Duty'}
                            </button>
                          </div>

                          {/* Manage actions (Edit / Delete) */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.45rem' }}>
                            <button
                              className="hosp-btn"
                              style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem' }}
                              onClick={() => handleOpenEditSpecialist(spec)}
                            >
                              ✏️ Edit Roster & Shift
                            </button>
                            <button
                              className="hosp-btn"
                              style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem', color: '#dc2626' }}
                              onClick={() => handleDeleteSpecialist(spec)}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}

        </div>
      )}

      {/* ========================================================== */}
      {/* RELEVANCE PRIORITY 4: Emergency Blood Bank & Plasma        */}
      {/* ========================================================== */}
      {(currentSection === 'blood' || currentSection === 'all') && (
        <div style={{
          ...glassCardStyle,
          border: '1px solid rgba(254, 202, 202, 0.8)',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 8px 32px rgba(220, 38, 38, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.95)',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#991b1b' }}>
                  🩸 Emergency Blood Bank & Plasma Reserves
                </h3>
                <span style={{ fontSize: '0.72rem', background: '#fee2e2', color: '#991b1b', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '12px' }}>
                  Live Facility Registry
                </span>
              </div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Instant unit inventory tracking for trauma and emergency surgery prep. Updates broadcast live across the regional dispatch network.
              </p>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
              ⚡ Instant Sync: Click − or + to log units transfused or received
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
            {bloodInventory.map((item) => {
              const isCrit = item.units_available === 0 || item.status === 'critical_shortage';
              const isLow = !isCrit && (item.units_available < 5 || item.status === 'low');
              return (
                <div
                  key={item.blood_group}
                  style={{
                    background: isCrit ? '#fef2f2' : isLow ? '#fffbeb' : '#f8fafc',
                    border: `1px solid ${isCrit ? '#fca5a5' : isLow ? '#fde68a' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.35rem',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: 800,
                    color: isCrit ? '#dc2626' : '#1e293b'
                  }}>
                    {item.blood_group}
                    {item.blood_group.includes('O-') && (
                      <span style={{ fontSize: '0.62rem', background: '#fee2e2', color: '#dc2626', padding: '1px 4px', borderRadius: '4px', marginLeft: '4px' }}>
                        Univ
                      </span>
                    )}
                  </div>

                  <div style={{
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    color: isCrit ? '#b91c1c' : isLow ? '#d97706' : '#15803d'
                  }}>
                    {item.units_available} <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>units</span>
                  </div>

                  <span style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    background: isCrit ? '#fee2e2' : isLow ? '#fef3c7' : '#dcfce7',
                    color: isCrit ? '#991b1b' : isLow ? '#92400e' : '#166534'
                  }}>
                    {item.status?.replace('_', ' ')}
                  </span>

                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                    <button
                      className="hosp-btn"
                      style={{ padding: '0.1rem 0.5rem', fontSize: '0.85rem', fontWeight: 800 }}
                      disabled={item.units_available <= 0}
                      onClick={() => handleAdjustBlood(item.blood_group, -1)}
                      title="Log unit transfused / deducted"
                    >
                      −
                    </button>
                    <button
                      className="hosp-btn"
                      style={{ padding: '0.1rem 0.5rem', fontSize: '0.85rem', fontWeight: 800, background: '#fee2e2', color: '#991b1b' }}
                      onClick={() => handleAdjustBlood(item.blood_group, 1)}
                      title="Log donor unit received"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* Modal: Add or Edit Equipment / Bed                         */}
      {/* ========================================================== */}
      {showResourceModal && (
        <div className="modal-overlay" onClick={() => setShowResourceModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '520px', padding: '1.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">
                {editingResource ? `Edit Capacity: ${editingResource.resource_type}` : '✚ Add Equipment or Bed Category'}
              </h3>
              <button className="modal-close" onClick={() => setShowResourceModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveResource} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {!editingResource && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Resource Category
                  </label>
                  <select
                    value={resTypeSelect}
                    onChange={(e) => setResTypeSelect(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  >
                    {PRESET_RESOURCES.map((p, i) => (
                      <option key={i} value={p}>{p}</option>
                    ))}
                    <option value="OTHER">✍️ Custom Equipment Category...</option>
                  </select>

                  {resTypeSelect === 'OTHER' && (
                    <input
                      type="text"
                      placeholder="Enter custom equipment name..."
                      value={resCustomType}
                      onChange={(e) => setResCustomType(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', marginTop: '0.5rem', boxSizing: 'border-box' }}
                    />
                  )}

                  {/* Triage Recognition Callout */}
                  {(resTypeSelect.toLowerCase().includes('defibrillator') || resCustomType.toLowerCase().includes('defibrillator')) && (
                    <div style={{ fontSize: '0.75rem', color: '#991b1b', background: '#fee2e2', padding: '0.45rem 0.65rem', borderRadius: '6px', marginTop: '0.45rem', border: '1px solid #fecaca' }}>
                      ⚡ <strong>Defibrillator Category:</strong> Automatically recognized and matched by the Triage Engine for incoming cardiac arrest & STEMI dispatches.
                    </div>
                  )}
                  {(resTypeSelect.toLowerCase().includes('ventilator') || resCustomType.toLowerCase().includes('ventilator')) && (
                    <div style={{ fontSize: '0.75rem', color: '#1e40af', background: '#dbeafe', padding: '0.45rem 0.65rem', borderRadius: '6px', marginTop: '0.45rem', border: '1px solid #bfdbfe' }}>
                      🫁 <strong>Ventilator Category:</strong> Automatically recognized and matched by the Triage Engine for acute respiratory failure & severe hypoxemia.
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Total Capacity
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={resTotalQty}
                    onChange={(e) => setResTotalQty(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Currently Available / Open
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={resTotalQty}
                    required
                    value={resAvailQty}
                    onChange={(e) => setResAvailQty(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Operational Status
                </label>
                <select
                  value={resStatus}
                  onChange={(e) => setResStatus(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                >
                  <option value="available">Available</option>
                  <option value="limited">Limited Capacity</option>
                  <option value="maintenance">Under Maintenance</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Internal Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Block B 3rd Floor"
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="hosp-btn"
                  onClick={() => setShowResourceModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : editingResource ? 'Save Capacity Updates' : 'Add to Hospital Capacity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* Modal: Add or Edit Doctor Specialist                       */}
      {/* ========================================================== */}
      {showSpecialistModal && (
        <div className="modal-overlay" onClick={() => setShowSpecialistModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '520px', padding: '1.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">
                {editingSpecialist ? `Edit Doctor: ${editingSpecialist.specialty}` : '✚ Add Doctor or Specialist Title'}
              </h3>
              <button className="modal-close" onClick={() => setShowSpecialistModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveSpecialist} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  🏢 Department
                </label>
                <select
                  value={PRESET_DEPARTMENTS.includes(specDepartment) ? specDepartment : 'OTHER'}
                  onChange={(e) => {
                    if (e.target.value !== 'OTHER') {
                      setSpecDepartment(e.target.value);
                    } else {
                      setSpecDepartment('');
                    }
                  }}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                >
                  {PRESET_DEPARTMENTS.map((d, i) => (
                    <option key={i} value={d}>{d}</option>
                  ))}
                  <option value="OTHER">✍️ Custom Department...</option>
                </select>
                {(!PRESET_DEPARTMENTS.includes(specDepartment) || specDepartment === '') && (
                  <input
                    type="text"
                    placeholder="Enter custom department name..."
                    value={specDepartment}
                    onChange={(e) => setSpecDepartment(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', marginTop: '0.5rem', boxSizing: 'border-box' }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  🩺 Specialty / Clinical Role
                </label>
                <select
                  value={specSelect}
                  onChange={(e) => setSpecSelect(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                >
                  {PRESET_SPECIALTIES.map((s, i) => (
                    <option key={i} value={s}>{s}</option>
                  ))}
                  <option value="OTHER">✍️ Custom Specialty Title...</option>
                </select>

                {specSelect === 'OTHER' && (
                  <input
                    type="text"
                    placeholder="Enter specialty name..."
                    value={specCustom}
                    onChange={(e) => setSpecCustom(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', marginTop: '0.5rem', boxSizing: 'border-box' }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Doctor Name / Lead Consultant (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Fayaz Ahmad Wani"
                  value={specDoctorName}
                  onChange={(e) => setSpecDoctorName(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Shift Assignment
                  </label>
                  <select
                    value={specShift}
                    onChange={(e) => setSpecShift(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  >
                    <option value="Morning (08:00 - 16:00)">🌅 Morning (08:00 - 16:00)</option>
                    <option value="Evening (16:00 - 00:00)">🌇 Evening (16:00 - 00:00)</option>
                    <option value="Night (00:00 - 08:00)">🌙 Night (00:00 - 08:00)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Contact Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={specPhone}
                    onChange={(e) => setSpecPhone(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Doctors on Duty / Available
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={specCount}
                    onChange={(e) => setSpecCount(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Duty Status
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={specAvailable}
                      onChange={(e) => setSpecAvailable(e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span>Active on Shift</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Duty Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. In Emergency Bay, reachable via Ext 402"
                  value={specDutyNotes}
                  onChange={(e) => setSpecDutyNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="hosp-btn"
                  onClick={() => setShowSpecialistModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ background: '#0f766e' }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : editingSpecialist ? 'Save Specialist Roster' : 'Add to Hospital Roster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
