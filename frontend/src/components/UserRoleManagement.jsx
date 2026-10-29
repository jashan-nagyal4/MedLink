import React, { useState, useEffect } from 'react';
import {
  getUsersAndRoles,
  assignUserRole,
  deletePreassignedRole,
  deleteUserAccount,
  getHospitalDetails,
  getHospitalBloodInventory,
  getHospitalIncidents,
  adminUpdateUser
} from '../api';
import { useAuth } from '../context/AuthContext';

const ROLE_METADATA = {
  admin: {
    id: 'admin',
    name: 'Central Dispatch Administrator',
    shortName: 'Central Admin',
    icon: '🛡️',
    tier: 'Tier 3 · Root CAD Authority',
    badgeColor: '#fee2e2',
    textColor: '#991b1b',
    borderColor: '#fca5a5',
    activeBorderColor: '#dc2626',
    accentColor: '#dc2626',
    summary: 'Central commanders with total oversight over dispatch queues, hospital directory provisioning, and user authorization tiers.',
    capabilities: [
      'Direct, escalate, and reassign emergency ambulance dispatches across all Jammu sectors',
      'Create, configure, and delete regional hospital facilities and operational statuses',
      'Grant, promote, or revoke user roles by email address with immediate sync',
      'Execute spatial PostGIS radius queries to find nearest open triage facilities',
      'Export certified incident audit logs and compliance reports in CSV format'
    ]
  },
  hospital_manager: {
    id: 'hospital_manager',
    name: 'Hospital Triage Manager',
    shortName: 'Hospital Manager',
    icon: '🏥',
    tier: 'Tier 2 · Facility Operational Command',
    badgeColor: '#CCFBF1',
    textColor: '#0F766E',
    borderColor: '#99F6E4',
    activeBorderColor: '#0F4C81',
    accentColor: '#0F4C81',
    summary: 'Facility-level commanders managing casualty intake, live bed & ventilator capacity, specialist shift rotations, and blood bank reserves.',
    capabilities: [
      'Receive targeted real-time incoming ambulance alerts with emergency siren & pre-arrival checklist',
      'Manage ICU bed, ward bed, ventilator, and defibrillator availability with 1-click controls',
      'Schedule specialist doctor duty rosters across 24-hr rotational shifts and toggle on-duty status',
      'Update emergency blood bank and plasma reserves across all 10 blood components',
      'Manage admitted casualty logs, escalate triage conditions, and complete patient care'
    ]
  },
  patient: {
    id: 'patient',
    name: 'Citizen / Patient',
    shortName: 'Citizen (Default)',
    icon: '👤',
    tier: 'Tier 1 · Public Emergency Access',
    badgeColor: '#dcfce7',
    textColor: '#166534',
    borderColor: '#bbf7d0',
    activeBorderColor: '#16a34a',
    accentColor: '#16a34a',
    summary: 'Public emergency access tier. Any citizen registering without a predefined role is automatically granted this tier.',
    capabilities: [
      'Submit emergency SOS incident reports with live GPS location or interactive Jammu map pin',
      'Request automated ambulance dispatch with real-time route & arrival time tracking',
      'Receive instant clinical triage ratings (Immediate, Urgent, Delayed) and rationale',
      'Lookup nearest regional hospitals and inspect live open bed and emergency capacity',
      'View personal incident status and hospital admission confirmations'
    ]
  },
  preassigned: {
    id: 'preassigned',
    name: 'Pending Role Invitations',
    shortName: 'Pending Invitations',
    icon: '✉️',
    tier: 'Queued Access Credentials',
    badgeColor: '#fef3c7',
    textColor: '#92400e',
    borderColor: '#fde68a',
    activeBorderColor: '#d97706',
    accentColor: '#d97706',
    summary: 'Pre-authorized roles mapped to specific email addresses waiting for user signup. Automatically inherits permissions upon initial registration.',
    capabilities: [
      'Pre-authorize hospital triage staff and doctors before they create their accounts',
      'Pre-assign central administrator privileges securely to official email handles',
      'Enforce institutional email domain validation and role security governance',
      'Revoke queued access invitations at any time prior to account activation'
    ]
  }
};

export default function UserRoleManagement({ hospitals = [] }) {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [preassigned, setPreassigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Active Selected Role Category Tab
  const [selectedCategory, setSelectedCategory] = useState('hospital_manager'); // 'admin' | 'hospital_manager' | 'patient' | 'preassigned'
  const [showAddForm, setShowAddForm] = useState(false);

  // Search filter within selected category
  const [searchQuery, setSearchQuery] = useState('');

  // Manager & User Inspection Dossier Modal State
  const [inspectingUser, setInspectingUser] = useState(null);
  const [managerFacilityDetails, setManagerFacilityDetails] = useState(null);
  const [managerBloodInventory, setManagerBloodInventory] = useState([]);
  const [managerIncidents, setManagerIncidents] = useState([]);
  const [infoLoading, setInfoLoading] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [modalHospitalSelect, setModalHospitalSelect] = useState('');

  // Admin Direct Edit Manager Information State
  const [isEditingManager, setIsEditingManager] = useState(false);
  const [editManagerForm, setEditManagerForm] = useState({
    name: '',
    phone: '',
    email: '',
    hospitalId: '',
    notes: ''
  });
  const [savingManagerEdit, setSavingManagerEdit] = useState(false);

  // Form State
  const [formEmail, setFormEmail] = useState('');
  const [formHospitalId, setFormHospitalId] = useState(hospitals[0]?.id || '');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load data from backend
  const fetchData = async () => {
    try {
      setError(null);
      const data = await getUsersAndRoles();
      setUsers(data.users || []);
      setPreassigned(data.preassigned || []);
    } catch (err) {
      setError(err.message || 'Failed to load user access list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update default hospital when hospitals prop updates
  useEffect(() => {
    if (!formHospitalId && hospitals.length > 0) {
      setFormHospitalId(hospitals[0].id);
    }
  }, [hospitals, formHospitalId]);

  // Handle Role Assignment from the active category view
  const handleAssignRole = async (e) => {
    e.preventDefault();
    if (!formEmail.trim()) {
      setError('Please provide a valid user email address.');
      return;
    }

    const targetRole = selectedCategory === 'preassigned' ? 'hospital_manager' : selectedCategory;

    if (targetRole === 'hospital_manager' && !formHospitalId) {
      setError('Please select an assigned hospital for this Hospital Manager.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await assignUserRole({
        email: formEmail.trim().toLowerCase(),
        role: targetRole,
        hospitalId: targetRole === 'hospital_manager' ? Number(formHospitalId) : null,
        notes: formNotes.trim()
      });

      setSuccessMsg(res.message);
      setFormEmail('');
      setFormNotes('');
      setShowAddForm(false);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to assign role.');
    } finally {
      setSubmitting(false);
    }
  };

  // Revoke Preassigned Role
  const handleRevokePreassigned = async (item) => {
    if (!window.confirm(`Revoke pre-assigned role for ${item.email}?`)) return;
    try {
      await deletePreassignedRole(item.id);
      setSuccessMsg(`Pre-assigned role for ${item.email} has been revoked.`);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to revoke pre-assigned role.');
    }
  };

  // Delete User Account
  const handleDeleteUser = async (u) => {
    if (Number(u.id) === Number(currentUser?.id)) {
      alert('You cannot delete your own active administrator account.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete user account '${u.name}' (${u.email})?`)) return;

    try {
      await deleteUserAccount(u.id);
      setSuccessMsg(`User account ${u.email} deleted successfully.`);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to delete user.');
    }
  };

  // Quick Role Change from Table
  const handleQuickRoleChange = async (targetUser, newRole) => {
    let targetHospitalId = targetUser.hospital_id;
    if (newRole === 'hospital_manager' && !targetHospitalId) {
      targetHospitalId = hospitals[0]?.id || null;
    }

    try {
      await assignUserRole({
        email: targetUser.email,
        role: newRole,
        hospitalId: newRole === 'hospital_manager' ? targetHospitalId : null,
        notes: `Role adjusted by administrator ${currentUser?.email}`
      });
      setSuccessMsg(`Updated ${targetUser.email} to ${newRole === 'patient' ? 'Citizen' : newRole}.`);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to update role.');
    }
  };

  // Quick Hospital Reassignment for Managers
  const handleQuickHospitalChange = async (targetUser, newHospitalId) => {
    try {
      await assignUserRole({
        email: targetUser.email,
        role: 'hospital_manager',
        hospitalId: Number(newHospitalId),
        notes: `Facility reassigned by administrator ${currentUser?.email}`
      });
      setSuccessMsg(`Reassigned ${targetUser.email} to selected healthcare facility.`);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to reassign hospital.');
    }
  };

  // Inspect User / Manager Operational Dossier
  const handleInspectUser = async (u) => {
    setInspectingUser(u);
    setModalHospitalSelect(u.hospital_id || (hospitals[0]?.id || ''));
    setManagerFacilityDetails(null);
    setManagerBloodInventory([]);
    setManagerIncidents([]);
    setCopiedEmail(false);
    setIsEditingManager(false);
    setEditManagerForm({
      name: u.name || '',
      phone: u.phone || '',
      email: u.email || '',
      hospitalId: u.hospital_id || (hospitals[0]?.id || ''),
      notes: u.notes || ''
    });

    if (u.role === 'hospital_manager' && u.hospital_id) {
      setInfoLoading(true);
      try {
        const [hospData, bloodData, incData] = await Promise.all([
          getHospitalDetails(u.hospital_id).catch(() => null),
          getHospitalBloodInventory(u.hospital_id).catch(() => ({ bloodInventory: [] })),
          getHospitalIncidents(u.hospital_id).catch(() => ({ incidents: [] }))
        ]);
        setManagerFacilityDetails(hospData);
        setManagerBloodInventory(bloodData?.bloodInventory || hospData?.bloodInventory || []);
        setManagerIncidents(incData?.incidents || []);
      } catch (err) {
        console.error("Failed to load facility info for manager:", err);
      } finally {
        setInfoLoading(false);
      }
    }
  };

  // Admin Direct Save for Hospital Manager or User details
  const handleSaveManagerEdit = async (e) => {
    if (e) e.preventDefault();
    if (!editManagerForm.name.trim()) {
      setError("User name cannot be empty.");
      return;
    }
    setSavingManagerEdit(true);
    setError(null);
    try {
      const res = await adminUpdateUser(inspectingUser.id, {
        name: editManagerForm.name.trim(),
        phone: editManagerForm.phone.trim() || null,
        email: editManagerForm.email.trim().toLowerCase(),
        hospitalId: editManagerForm.hospitalId ? Number(editManagerForm.hospitalId) : null,
        notes: editManagerForm.notes ? editManagerForm.notes.trim() : null
      });

      setSuccessMsg(res.message);
      setInspectingUser(res.user);
      setIsEditingManager(false);
      await fetchData();

      if (res.user.hospital_id) {
        const [hospData, bloodData, incData] = await Promise.all([
          getHospitalDetails(res.user.hospital_id).catch(() => null),
          getHospitalBloodInventory(res.user.hospital_id).catch(() => ({ bloodInventory: [] })),
          getHospitalIncidents(res.user.hospital_id).catch(() => ({ incidents: [] }))
        ]);
        setManagerFacilityDetails(hospData);
        setManagerBloodInventory(bloodData?.bloodInventory || hospData?.bloodInventory || []);
        setManagerIncidents(incData?.incidents || []);
      }
    } catch (err) {
      setError(err.message || "Failed to update hospital manager details.");
    } finally {
      setSavingManagerEdit(false);
    }
  };

  const handleCopyEmail = (email) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  // Category counts
  const adminUsers = users.filter((u) => u.role === 'admin');
  const managerUsers = users.filter((u) => u.role === 'hospital_manager');
  const citizenUsers = users.filter((u) => u.role === 'patient');

  // Active Category Data
  const currentMeta = ROLE_METADATA[selectedCategory] || ROLE_METADATA.hospital_manager;

  const currentCategoryUsers = (
    selectedCategory === 'admin'
      ? adminUsers
      : selectedCategory === 'hospital_manager'
      ? managerUsers
      : selectedCategory === 'patient'
      ? citizenUsers
      : []
  ).filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.hospital_name?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q)
    );
  });

  const currentCategoryPreassigned = preassigned.filter((p) => {
    if (selectedCategory === 'preassigned') {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return p.email?.toLowerCase().includes(q) || p.role?.toLowerCase().includes(q) || p.hospital_name?.toLowerCase().includes(q);
    }
    return p.role === selectedCategory;
  });

  const glassCardStyle = {
    background: 'rgba(255, 255, 255, 0.84)',
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.85)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(15, 76, 129, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.95)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>

      {/* Top Banner Card */}
      <div style={{
        ...glassCardStyle,
        padding: '1.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <span style={{
                background: '#e0f2fe',
                color: '#0369a1',
                padding: '0.2rem 0.6rem',
                borderRadius: '20px',
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                SECURITY & ROLE TIERS
              </span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Total Registered: <strong>{users.length}</strong> · Queued: <strong>{preassigned.length}</strong>
              </span>
            </div>

            <h2 style={{ margin: 0, fontSize: '1.45rem', color: '#0f172a', fontWeight: 800 }}>
              👥 User Roles & Access Categories
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#64748b' }}>
              Select a role category below to view authorized users, access capabilities, and assign new emails.
            </p>
          </div>

          <button
            onClick={fetchData}
            className="hosp-btn"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
          >
            ↻ Refresh Users
          </button>
        </div>

        {/* Global Feedback Notifications */}
        {error && (
          <div style={{ marginTop: '1rem', background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: '0.65rem 1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
            ⚠️ {error}
          </div>
        )}
        {successMsg && (
          <div style={{ marginTop: '1rem', background: '#ecfdf5', border: '1px solid #10b981', color: '#065f46', padding: '0.65rem 1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
            ✓ {successMsg}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 1. ROLE CATEGORY SELECTOR CARDS                              */}
      {/* ============================================================ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem'
      }}>
        {[
          {
            id: 'hospital_manager',
            title: 'Hospital Managers',
            count: managerUsers.length,
            unit: 'Coordinators',
            icon: '🏥',
            desc: 'Facility triage & resource controllers',
            meta: ROLE_METADATA.hospital_manager
          },
          {
            id: 'admin',
            title: 'Central Admins',
            count: adminUsers.length,
            unit: 'Commanders',
            icon: '🛡️',
            desc: 'Full regional CAD & governance tier',
            meta: ROLE_METADATA.admin
          },
          {
            id: 'patient',
            title: 'Citizens / Patients',
            count: citizenUsers.length,
            unit: 'Registered',
            icon: '👤',
            desc: 'Emergency SOS intake & booking',
            meta: ROLE_METADATA.patient
          },
          {
            id: 'preassigned',
            title: 'Pending Invitations',
            count: preassigned.length,
            unit: 'Queued Emails',
            icon: '✉️',
            desc: 'Pre-authorized pending signups',
            meta: ROLE_METADATA.preassigned
          }
        ].map((cat) => {
          const isSelected = selectedCategory === cat.id;

          return (
            <div
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setSearchQuery('');
                setShowAddForm(false);
              }}
              style={{
                background: isSelected ? '#ffffff' : '#f8fafc',
                border: isSelected ? `2px solid ${cat.meta.activeBorderColor}` : '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.25rem',
                cursor: 'pointer',
                boxShadow: isSelected ? `0 6px 18px rgba(37, 99, 235, 0.12)` : 'none',
                transform: isSelected ? 'translateY(-2px)' : 'none',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {isSelected && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  background: cat.meta.accentColor,
                  color: '#ffffff',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '0.2rem 0.6rem',
                  borderBottomLeftRadius: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  ACTIVE VIEW
                </div>
              )}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: cat.meta.badgeColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.3rem'
                  }}>
                    {cat.icon}
                  </div>

                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '12px',
                    background: cat.meta.badgeColor,
                    color: cat.meta.textColor
                  }}>
                    {cat.count} {cat.unit}
                  </span>
                </div>

                <h3 style={{ margin: '0.35rem 0 0.15rem', fontSize: '1.05rem', color: isSelected ? '#0f172a' : '#334155', fontWeight: 800 }}>
                  {cat.title}
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.35 }}>
                  {cat.desc}
                </p>
              </div>

              <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
                <span style={{ color: isSelected ? cat.meta.accentColor : '#64748b', fontWeight: isSelected ? 800 : 600 }}>
                  {isSelected ? '✓ Viewing Category' : 'Click to View →'}
                </span>
                <span style={{ color: '#94a3b8' }}>
                  {cat.meta.tier.split('·')[0]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* 2. DEDICATED CATEGORY INFORMATION & PERSONNEL PANEL          */}
      {/* ============================================================ */}
      <div style={{
        ...glassCardStyle,
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        
        {/* Category Header & Role Intelligence */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '1.25rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '1.4rem' }}>{currentMeta.icon}</span>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>
                {currentMeta.name}
              </h3>
              <span style={{
                background: currentMeta.badgeColor,
                color: currentMeta.textColor,
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '12px'
              }}>
                {currentMeta.tier}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', maxWidth: '800px' }}>
              {currentMeta.summary}
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn-primary"
              style={{
                padding: '0.45rem 0.95rem',
                fontSize: '0.82rem',
                background: showAddForm ? '#475569' : currentMeta.accentColor,
                fontWeight: 700
              }}
            >
              {showAddForm ? '✕ Close Form' : `✚ Add User to ${currentMeta.shortName}`}
            </button>
          </div>
        </div>

        {/* Role Privileges & Capabilities Pill Box */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1rem 1.25rem'
        }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
            🔒 Authorized Operational Capabilities for {currentMeta.name}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.45rem 1.25rem' }}>
            {currentMeta.capabilities.map((cap, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.8rem', color: '#334155' }}>
                <span style={{ color: currentMeta.accentColor, fontWeight: 800 }}>✓</span>
                <span>{cap}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Inline Add / Assign User Form for this Role */}
        {showAddForm && (
          <div style={{
            background: '#ffffff',
            border: `2px solid ${currentMeta.borderColor}`,
            borderRadius: '10px',
            padding: '1.25rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.98rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              ✉️ Grant <strong>{currentMeta.shortName}</strong> Access by Email
            </h4>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#64748b' }}>
              Provide the email handle. If the account exists, access is updated immediately. If not yet registered, an invitation is pre-assigned.
            </p>

            <form onSubmit={handleAssignRole} style={{ display: 'grid', gridTemplateColumns: selectedCategory === 'hospital_manager' ? '1fr 1fr' : '1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  User Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. specialist@medlink.org"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              {selectedCategory === 'hospital_manager' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                    Assigned Hospital Facility *
                  </label>
                  <select
                    value={formHospitalId}
                    onChange={(e) => setFormHospitalId(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#ffffff', boxSizing: 'border-box' }}
                  >
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ gridColumn: selectedCategory === 'hospital_manager' ? '1 / -1' : 'auto' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Administrative Memo / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chief of Trauma Care / Emergency Bay Coordinator"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', gridColumn: selectedCategory === 'hospital_manager' ? '1 / -1' : 'auto', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  className="hosp-btn"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                  style={{ background: currentMeta.accentColor, padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  {submitting ? 'Granting Role...' : `Save & Grant ${currentMeta.shortName} Access`}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================ */}
        {/* 3. PERSONNEL DIRECTORY FOR SELECTED ROLE                     */}
        {/* ============================================================ */}
        {selectedCategory !== 'preassigned' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 700 }}>
                  Active {currentMeta.shortName} Accounts ({currentCategoryUsers.length})
                </h4>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Authorized personnel actively holding the {currentMeta.shortName} tier
                </p>
              </div>

              {/* In-category Search Filter */}
              <input
                type="text"
                placeholder={`Filter ${currentMeta.shortName.toLowerCase()}s by name or email...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  minWidth: '260px'
                }}
              />
            </div>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                Loading personnel list...
              </div>
            ) : currentCategoryUsers.length === 0 ? (
              <div style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                color: '#64748b',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{currentMeta.icon}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
                  No {currentMeta.shortName} accounts found {searchQuery ? 'matching your search' : 'currently active'}
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.25rem 0 1rem' }}>
                  You can assign this role to any user email address using the button above.
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="btn-primary"
                  style={{ background: currentMeta.accentColor, padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
                >
                  ✚ Grant {currentMeta.shortName} Access
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Personnel / Contact</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Email Handle</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Facility Assignment</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Reassign Tier</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Joined Date</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentCategoryUsers.map((u) => {
                      const isSelf = Number(u.id) === Number(currentUser?.id);

                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div
                              onClick={() => handleInspectUser(u)}
                              style={{
                                fontWeight: 700,
                                color: u.role === 'hospital_manager' ? '#0F766E' : '#0f172a',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                              title="Click to inspect user dossier"
                            >
                              <span>{u.name}</span>
                              {isSelf && <span style={{ fontSize: '0.68rem', color: '#0F4C81', fontWeight: 800 }}>(Active Admin)</span>}
                              {u.role === 'hospital_manager' && (
                                <span style={{
                                  fontSize: '0.65rem',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '6px',
                                  background: '#CCFBF1',
                                  color: '#0F766E',
                                  fontWeight: 800
                                }}>
                                  👁️ Info
                                </span>
                              )}
                            </div>
                            {u.phone ? (
                              <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>
                                📞 {u.phone}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                📞 No mobile added
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '0.75rem 1rem', color: '#334155', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                            {u.email}
                          </td>

                          <td style={{ padding: '0.75rem 1rem' }}>
                            {u.role === 'hospital_manager' ? (
                              <select
                                value={u.hospital_id || ''}
                                disabled={isSelf}
                                onChange={(e) => handleQuickHospitalChange(u, e.target.value)}
                                style={{
                                  padding: '0.3rem 0.5rem',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.78rem',
                                  maxWidth: '220px',
                                  background: '#ffffff'
                                }}
                              >
                                {hospitals.map((h) => (
                                  <option key={h.id} value={h.id}>{h.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '0.78rem' }}>
                                {u.role === 'admin' ? '🌐 Central Regional Access' : '— Public Access'}
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '0.75rem 1rem' }}>
                            <select
                              value={u.role}
                              disabled={isSelf}
                              onChange={(e) => handleQuickRoleChange(u, e.target.value)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                cursor: isSelf ? 'not-allowed' : 'pointer',
                                background:
                                  u.role === 'admin'
                                    ? '#fee2e2'
                                    : u.role === 'hospital_manager'
                                    ? '#dbeafe'
                                    : '#dcfce7',
                                color:
                                  u.role === 'admin'
                                    ? '#991b1b'
                                    : u.role === 'hospital_manager'
                                    ? '#1e40af'
                                    : '#166534'
                              }}
                            >
                              <option value="admin">🛡️ Central Admin</option>
                              <option value="hospital_manager">🏥 Hospital Manager</option>
                              <option value="patient">👤 Citizen</option>
                            </select>
                          </td>

                          <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.78rem' }}>
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>

                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <button
                              className="hosp-btn"
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.2rem 0.5rem',
                                background: '#F0FDFA',
                                color: '#0F766E',
                                border: '1px solid #99F6E4',
                                fontWeight: 700,
                                marginRight: '0.4rem',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleInspectUser(u)}
                              title="Inspect Manager / User Dossier"
                            >
                              👁️ Info
                            </button>
                            <button
                              className="hosp-btn"
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.2rem 0.5rem',
                                background: '#f0fdf4',
                                color: '#166534',
                                border: '1px solid #bbf7d0',
                                fontWeight: 700,
                                marginRight: '0.4rem',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                handleInspectUser(u);
                                setIsEditingManager(true);
                              }}
                              title="Edit user mobile number and credentials"
                            >
                              ✏️ Edit
                            </button>
                            {!isSelf && (
                              <button
                                className="hosp-btn"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                                onClick={() => handleDeleteUser(u)}
                                title="Remove User Account"
                              >
                                🗑️ Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Preassigned Invitations for this Category */}
        {currentCategoryPreassigned.length > 0 && (
          <div style={{ marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
            <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.98rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              ⏳ Pending Pre-assigned Invitations ({currentCategoryPreassigned.length})
            </h4>
            <p style={{ margin: '0 0 0.85rem', fontSize: '0.78rem', color: '#64748b' }}>
              These email addresses have been pre-granted {currentMeta.shortName} access and will automatically activate upon user registration.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
              {currentCategoryPreassigned.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    background: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', fontFamily: 'monospace' }}>
                      {item.email}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                      <span className="badge" style={{
                        background: item.role === 'admin' ? '#fee2e2' : item.role === 'hospital_manager' ? '#dbeafe' : '#dcfce7',
                        color: item.role === 'admin' ? '#991b1b' : item.role === 'hospital_manager' ? '#1e40af' : '#166534',
                        fontSize: '0.68rem'
                      }}>
                        {item.role === 'hospital_manager' ? '🏥 Manager' : item.role === 'admin' ? '🛡️ Admin' : '👤 Citizen'}
                      </span>
                      {item.hospital_name && (
                        <span style={{ fontSize: '0.72rem', color: '#475569' }}>
                          📍 {item.hospital_name}
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginTop: '0.2rem' }}>
                        "{item.notes}"
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <button
                      className="hosp-btn"
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.2rem 0.5rem',
                        background: '#F0FDFA',
                        color: '#0F766E',
                        border: '1px solid #99F6E4',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                      onClick={() => handleInspectUser({ ...item, is_preassigned: true, name: item.email.split('@')[0] })}
                      title="Inspect Pre-assigned Invitation"
                    >
                      👁️ Info
                    </button>
                    <button
                      className="hosp-btn"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                      onClick={() => handleRevokePreassigned(item)}
                      title="Revoke Pre-assigned Role"
                    >
                      Revoke ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ============================================================ */}
      {/* 4. MANAGER & USER OPERATIONAL INTELLIGENCE DOSSIER MODAL      */}
      {/* ============================================================ */}
      {inspectingUser && (() => {
        const isManager = inspectingUser.role === 'hospital_manager';
        const isPreassigned = !!inspectingUser.is_preassigned;
        const hosp = managerFacilityDetails?.hospital || hospitals.find(h => Number(h.id) === Number(inspectingUser.hospital_id));
        const resources = managerFacilityDetails?.resources || [];
        const icu = resources.find(r => r.resource_type?.toLowerCase().includes('icu'));
        const ward = resources.find(r => r.resource_type?.toLowerCase().includes('ward') || r.resource_type?.toLowerCase().includes('bed'));
        const vent = resources.find(r => r.resource_type?.toLowerCase().includes('ventilator'));
        const defib = resources.find(r => r.resource_type?.toLowerCase().includes('defibrillator'));

        const specialists = managerFacilityDetails?.specialists || [];
        const onDutySpecialists = specialists.filter(s => s.on_duty);

        const bloodItems = managerBloodInventory.length > 0 ? managerBloodInventory : (managerFacilityDetails?.bloodInventory || []);
        const totalBloodUnits = bloodItems.reduce((acc, b) => acc + (Number(b.units_available) || 0), 0);
        const oNegItem = bloodItems.find(b => b.blood_group?.includes('O-'));

        const incidents = managerIncidents || [];
        const activeIncidents = incidents.filter(i => i.status !== 'resolved' && i.status !== 'cancelled');

        return (
          <div
            className="modal-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.7)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1100,
              padding: '1rem'
            }}
            onClick={() => setInspectingUser(null)}
          >
            <div
              className="modal-content"
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '780px',
                maxHeight: '92vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid #e2e8f0',
                padding: '0',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                background: isManager ? 'linear-gradient(135deg, #0B3A63 0%, #0F4C81 100%)' : 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
                color: '#ffffff',
                padding: '1.5rem',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                    <span style={{
                      background: 'rgba(255,255,255,0.2)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase'
                    }}>
                      {isManager ? '🏥 HOSPITAL MANAGER DOSSIER' : isPreassigned ? '✉️ QUEUED INVITATION DOSSIER' : '🛡️ PERSONNEL PROFILE'}
                    </span>
                    <span style={{
                      background: isPreassigned ? '#fef3c7' : '#dcfce7',
                      color: isPreassigned ? '#92400e' : '#166534',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '10px',
                      fontSize: '0.7rem',
                      fontWeight: 700
                    }}>
                      {isPreassigned ? 'Queued Access' : 'Verified Active Account'}
                    </span>
                  </div>

                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
                    {inspectingUser.name || inspectingUser.email}
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', color: '#e0e7ff', fontFamily: 'monospace' }}>
                      ✉️ {inspectingUser.email}
                    </span>
                    <button
                      onClick={() => handleCopyEmail(inspectingUser.email)}
                      style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                      title="Copy email to clipboard"
                    >
                      {copiedEmail ? '✓ Copied!' : '📋 Copy'}
                    </button>
                    {inspectingUser.phone && (
                      <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                        · 📞 {inspectingUser.phone}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                  {!isPreassigned && (
                    <button
                      onClick={() => setIsEditingManager(!isEditingManager)}
                      style={{
                        background: isEditingManager ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)',
                        border: '1px solid rgba(255,255,255,0.4)',
                        color: '#ffffff',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '0.35rem 0.8rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                      title="Edit personnel mobile number and credentials"
                    >
                      {isEditingManager ? '👁️ View Mode' : '✏️ Edit Info'}
                    </button>
                  )}

                  <button
                    onClick={() => setInspectingUser(null)}
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      color: '#ffffff',
                      fontSize: '1.1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}
                    title="Close Dossier"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Content Body */}
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Admin Direct Edit Manager / User Information Form */}
                {isEditingManager && !isPreassigned && (
                  <div style={{
                    background: '#F0FDFA',
                    border: '2px solid #14B8A6',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    boxShadow: '0 4px 14px rgba(20, 184, 166, 0.12)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0F766E', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        ✏️ Edit Personnel & Contact Information
                      </h4>
                      <span style={{ fontSize: '0.72rem', color: '#0F766E', fontWeight: 700, background: '#CCFBF1', padding: '0.15rem 0.5rem', borderRadius: '8px' }}>
                        Admin Override Active
                      </span>
                    </div>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#0F766E' }}>
                      Update the manager's name, primary mobile number, email address, facility assignment, and administrative notes.
                    </p>

                    <form onSubmit={handleSaveManagerEdit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#1e3a8a', marginBottom: '0.2rem' }}>
                          Manager Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={editManagerForm.name}
                          onChange={(e) => setEditManagerForm({ ...editManagerForm, name: e.target.value })}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #93c5fd', fontSize: '0.85rem', background: '#ffffff', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#1e3a8a', marginBottom: '0.2rem' }}>
                          Mobile / Phone Number *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. +91 94191 10074"
                          value={editManagerForm.phone}
                          onChange={(e) => setEditManagerForm({ ...editManagerForm, phone: e.target.value })}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #93c5fd', fontSize: '0.85rem', background: '#ffffff', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#1e3a8a', marginBottom: '0.2rem' }}>
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={editManagerForm.email}
                          onChange={(e) => setEditManagerForm({ ...editManagerForm, email: e.target.value })}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #93c5fd', fontSize: '0.85rem', background: '#ffffff', boxSizing: 'border-box' }}
                        />
                      </div>

                      {isManager && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#1e3a8a', marginBottom: '0.2rem' }}>
                            Assigned Hospital Facility *
                          </label>
                          <select
                            value={editManagerForm.hospitalId}
                            onChange={(e) => setEditManagerForm({ ...editManagerForm, hospitalId: e.target.value })}
                            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #93c5fd', fontSize: '0.85rem', background: '#ffffff', boxSizing: 'border-box' }}
                          >
                            {hospitals.map(h => (
                              <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#1e3a8a', marginBottom: '0.2rem' }}>
                          Administrative Memo / Operational Notes
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Chief of Trauma Intake / Night Shift Coordinator"
                          value={editManagerForm.notes}
                          onChange={(e) => setEditManagerForm({ ...editManagerForm, notes: e.target.value })}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #93c5fd', fontSize: '0.85rem', background: '#ffffff', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.25rem' }}>
                        <button
                          type="button"
                          onClick={() => setIsEditingManager(false)}
                          className="hosp-btn"
                          style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingManagerEdit}
                          className="btn-primary"
                          style={{ background: '#0F4C81', fontSize: '0.82rem', padding: '0.4rem 1.25rem', fontWeight: 700 }}
                        >
                          {savingManagerEdit ? 'Saving Info...' : '💾 Save Manager Info'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Section 1: Personnel Account Credentials */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem'
                }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.65rem' }}>
                    👤 Account Authorization & Operational Identity
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', fontSize: '0.82rem' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Assigned Access Tier:</span>
                      <strong style={{ color: '#0f172a' }}>
                        {inspectingUser.role === 'admin' ? '🛡️ Central Dispatch Administrator' : inspectingUser.role === 'hospital_manager' ? '🏥 Hospital Triage Manager' : '👤 Citizen / Patient'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Internal User ID:</span>
                      <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>#{inspectingUser.id || 'PREASSIGNED'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Account Registered On:</span>
                      <strong style={{ color: '#0f172a' }}>
                        {inspectingUser.created_at ? new Date(inspectingUser.created_at).toLocaleString() : 'Pending Registration'}
                      </strong>
                    </div>
                    {inspectingUser.notes && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Administrative Memo / Security Notes:</span>
                        <div style={{ fontStyle: 'italic', color: '#334155', background: '#ffffff', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '0.2rem' }}>
                          "{inspectingUser.notes}"
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2: Hospital Manager Facility Command Status */}
                {isManager && (
                  <div>
                    {/* Facility Header */}
                    <div style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '1.25rem',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0F4C81', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            🏥 ASSIGNED REGIONAL HEALTHCARE FACILITY
                          </div>
                          <h4 style={{ margin: '0.2rem 0 0', fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>
                            {hosp?.name || inspectingUser.hospital_name || 'No Facility Assigned'}
                          </h4>
                          {hosp?.address && (
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                              📍 {hosp.address} {hosp.phone ? `· 📞 Direct: ${hosp.phone}` : ''}
                            </p>
                          )}
                        </div>

                        {hosp && (
                          <span style={{
                            background: hosp.operational_status === 'operational' ? '#dcfce7' : '#fee2e2',
                            color: hosp.operational_status === 'operational' ? '#166534' : '#991b1b',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '0.25rem 0.65rem',
                            borderRadius: '12px',
                            border: `1px solid ${hosp.operational_status === 'operational' ? '#bbf7d0' : '#fca5a5'}`
                          }}>
                            ● {hosp.operational_status ? hosp.operational_status.toUpperCase() : 'OPERATIONAL'}
                          </span>
                        )}
                      </div>

                      {/* If unassigned warning */}
                      {!inspectingUser.hospital_id && (
                        <div style={{
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          padding: '0.85rem',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.75rem'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400e' }}>
                              ⚠️ Unassigned Facility Command
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#b45309' }}>
                              This manager does not have a designated hospital. Assign one below to connect them with live facility metrics.
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <select
                              value={modalHospitalSelect}
                              onChange={(e) => setModalHospitalSelect(e.target.value)}
                              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #d97706', fontSize: '0.8rem', background: '#ffffff' }}
                            >
                              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                            </select>
                            <button
                              className="btn-primary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', background: '#d97706' }}
                              onClick={async () => {
                                await handleQuickHospitalChange(inspectingUser, modalHospitalSelect);
                                handleInspectUser({ ...inspectingUser, hospital_id: modalHospitalSelect });
                              }}
                            >
                              Assign Facility
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Section 3: Live Facility Telemetry & Operational Metrics */}
                    {inspectingUser.hospital_id && (
                      <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h4 style={{ margin: 0, fontSize: '0.98rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            📊 Live Facility Capacity & Triage Readiness
                          </h4>
                          {infoLoading && (
                            <span style={{ fontSize: '0.75rem', color: '#0F4C81', fontWeight: 600 }}>
                              ↻ Syncing telemetry...
                            </span>
                          )}
                        </div>

                        {infoLoading ? (
                          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>🏥</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Fetching real-time bed, ventilator, and staff telemetry...</div>
                          </div>
                        ) : (
                          <>
                            {/* Key Capacity Gauges Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                              
                              {/* ICU Capacity */}
                              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem' }}>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                                  🛏️ ICU Saturation
                                </div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (icu?.available_quantity || 0) > 0 ? '#16a34a' : '#dc2626', margin: '0.2rem 0' }}>
                                  {icu ? `${icu.available_quantity} / ${icu.total_quantity}` : 'N/A'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  {icu ? `${Math.round(((icu.total_quantity - icu.available_quantity) / (icu.total_quantity || 1)) * 100)}% occupied` : 'Data unconfigured'}
                                </div>
                              </div>

                              {/* General Beds */}
                              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem' }}>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                                  🏥 Ward Beds
                                </div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (ward?.available_quantity || 0) > 0 ? '#0F4C81' : '#dc2626', margin: '0.2rem 0' }}>
                                  {ward ? `${ward.available_quantity} / ${ward.total_quantity}` : 'N/A'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  {ward ? `${Math.round(((ward.total_quantity - ward.available_quantity) / (ward.total_quantity || 1)) * 100)}% occupied` : 'Data unconfigured'}
                                </div>
                              </div>

                              {/* Defibrillators */}
                              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem' }}>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                                  ⚡ Defibrillators
                                </div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (defib?.available_quantity || 0) > 0 ? '#0891b2' : '#dc2626', margin: '0.2rem 0' }}>
                                  {defib ? `${defib.available_quantity} / ${defib.total_quantity}` : 'N/A'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  {defib ? 'Resuscitation Ready' : 'Category Missing'}
                                </div>
                              </div>

                              {/* Mechanical Ventilators */}
                              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem' }}>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                                  🫁 Ventilators
                                </div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (vent?.available_quantity || 0) > 0 ? '#7c3aed' : '#dc2626', margin: '0.2rem 0' }}>
                                  {vent ? `${vent.available_quantity} / ${vent.total_quantity}` : 'N/A'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  {vent ? 'Life Support Online' : 'Category Missing'}
                                </div>
                              </div>

                            </div>

                            {/* Blood Inventory & On-Duty Doctors Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                              
                              {/* Blood Bank Overview */}
                              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>
                                    🩸 Blood Bank & Component Reserves
                                  </div>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '10px', background: '#fee2e2', color: '#991b1b' }}>
                                    {totalBloodUnits} Total Units
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', padding: '0.4rem 0.6rem', background: '#fef2f2', borderRadius: '6px', fontSize: '0.78rem' }}>
                                  <span style={{ fontSize: '1rem' }}>⚠️</span>
                                  <div>
                                    <strong>Universal Donor O- Reserve: </strong>
                                    <span style={{ color: (oNegItem?.units_available || 0) > 3 ? '#16a34a' : '#dc2626', fontWeight: 800 }}>
                                      {oNegItem ? `${oNegItem.units_available} units available` : 'Critical / None recorded'}
                                    </span>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                  {bloodItems.slice(0, 8).map((b, i) => (
                                    <span
                                      key={i}
                                      style={{
                                        fontSize: '0.72rem',
                                        padding: '0.2rem 0.45rem',
                                        borderRadius: '6px',
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        color: '#334155'
                                      }}
                                    >
                                      <strong>{b.blood_group}:</strong> {b.units_available}u
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* On-Duty Specialists */}
                              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>
                                    👨‍⚕️ Specialist Roster & On-Duty Shift
                                  </div>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '10px', background: '#e0f2fe', color: '#0369a1' }}>
                                    {onDutySpecialists.length} On Duty ({specialists.length} Total)
                                  </span>
                                </div>

                                {specialists.length === 0 ? (
                                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>No specialist rosters configured for this hospital.</div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '140px', overflowY: 'auto' }}>
                                    {specialists.map((s) => (
                                      <div
                                        key={s.id}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          padding: '0.3rem 0.5rem',
                                          borderRadius: '6px',
                                          background: s.on_duty ? '#f0fdf4' : '#f8fafc',
                                          border: `1px solid ${s.on_duty ? '#bbf7d0' : '#e2e8f0'}`,
                                          fontSize: '0.76rem'
                                        }}
                                      >
                                        <div>
                                          <strong style={{ color: '#0f172a' }}>{s.doctor_name || s.specialty}</strong>
                                          <span style={{ color: '#64748b', marginLeft: '0.35rem' }}>({s.specialty})</span>
                                        </div>
                                        <span style={{
                                          fontSize: '0.68rem',
                                          fontWeight: 700,
                                          padding: '0.1rem 0.35rem',
                                          borderRadius: '4px',
                                          background: s.on_duty ? '#dcfce7' : '#f1f5f9',
                                          color: s.on_duty ? '#166534' : '#64748b'
                                        }}>
                                          {s.on_duty ? '● ON DUTY' : 'Standby'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                            </div>

                            {/* Active Incidents Assigned to this Hospital */}
                            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
                                  🚨 Active Inbound Casualties & Assigned Incidents
                                </div>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '10px', background: activeIncidents.length > 0 ? '#fef3c7' : '#ecfdf5', color: activeIncidents.length > 0 ? '#92400e' : '#065f46' }}>
                                  {activeIncidents.length} Active Cases
                                </span>
                              </div>

                              {activeIncidents.length === 0 ? (
                                <div style={{ fontSize: '0.78rem', color: '#166534', padding: '0.4rem 0.6rem', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                  ✓ No critical casualty transfers or pending emergency intakes active at this facility.
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '160px', overflowY: 'auto' }}>
                                  {activeIncidents.map((inc) => (
                                    <div
                                      key={inc.id}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.45rem 0.65rem',
                                        borderRadius: '6px',
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.78rem'
                                      }}
                                    >
                                      <div>
                                        <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                                          {inc.incident_number}
                                        </span>
                                        <span style={{ color: '#475569', marginLeft: '0.5rem' }}>
                                          {inc.chief_complaint}
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                        <span style={{
                                          fontSize: '0.68rem',
                                          fontWeight: 800,
                                          padding: '0.1rem 0.4rem',
                                          borderRadius: '4px',
                                          background: inc.triage_level?.toLowerCase() === 'immediate' ? '#fee2e2' : inc.triage_level?.toLowerCase() === 'urgent' ? '#fef3c7' : '#dcfce7',
                                          color: inc.triage_level?.toLowerCase() === 'immediate' ? '#991b1b' : inc.triage_level?.toLowerCase() === 'urgent' ? '#92400e' : '#166534'
                                        }}>
                                          {inc.triage_level || 'NORMAL'}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                          ({inc.status})
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                          </>
                        )}
                      </div>
                    )}

                  </div>
                )}

                {/* Section 4: Admin Fast Actions & Management Controls */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    ⚡ Administrator Rapid Governance Controls
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
                    
                    {/* Facility Reassignment Dropdown (If Manager) */}
                    {isManager && !isPreassigned && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                          Reassign Hospital Facility:
                        </label>
                        <select
                          value={modalHospitalSelect}
                          onChange={async (e) => {
                            const newHospId = e.target.value;
                            setModalHospitalSelect(newHospId);
                            await handleQuickHospitalChange(inspectingUser, newHospId);
                            handleInspectUser({ ...inspectingUser, hospital_id: newHospId });
                          }}
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.82rem',
                            background: '#ffffff'
                          }}
                        >
                          {hospitals.map(h => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Role Adjustment Dropdown (If Registered User) */}
                    {!isPreassigned && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                          Modify Access Tier / Role:
                        </label>
                        <select
                          value={inspectingUser.role}
                          disabled={Number(inspectingUser.id) === Number(currentUser?.id)}
                          onChange={async (e) => {
                            const newRole = e.target.value;
                            await handleQuickRoleChange(inspectingUser, newRole);
                            handleInspectUser({ ...inspectingUser, role: newRole });
                          }}
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.82rem',
                            background: '#ffffff',
                            fontWeight: 700
                          }}
                        >
                          <option value="admin">🛡️ Central Admin</option>
                          <option value="hospital_manager">🏥 Hospital Manager</option>
                          <option value="patient">👤 Citizen / Patient</option>
                        </select>
                      </div>
                    )}

                    {/* Delete Account or Revoke Preassignment */}
                    <div>
                      {isPreassigned ? (
                        <button
                          className="hosp-btn"
                          style={{
                            width: '100%',
                            padding: '0.45rem',
                            fontSize: '0.82rem',
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            fontWeight: 700
                          }}
                          onClick={async () => {
                            await handleRevokePreassigned(inspectingUser);
                            setInspectingUser(null);
                          }}
                        >
                          ✕ Revoke Pre-assigned Invitation
                        </button>
                      ) : (
                        Number(inspectingUser.id) !== Number(currentUser?.id) && (
                          <button
                            className="hosp-btn"
                            style={{
                              width: '100%',
                              padding: '0.45rem',
                              fontSize: '0.82rem',
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fca5a5',
                              fontWeight: 700
                            }}
                            onClick={async () => {
                              await handleDeleteUser(inspectingUser);
                              setInspectingUser(null);
                            }}
                          >
                            🗑️ Delete Account Permanently
                          </button>
                        )
                      )}
                    </div>

                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '1rem 1.5rem',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                borderBottomLeftRadius: '16px',
                borderBottomRightRadius: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  MedLink Regional CAD · Real-Time Access & Command Center
                </span>
                <button
                  className="btn-primary"
                  style={{
                    background: '#334155',
                    padding: '0.45rem 1.25rem',
                    fontSize: '0.82rem',
                    fontWeight: 700
                  }}
                  onClick={() => setInspectingUser(null)}
                >
                  ✕ Close Dossier
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
