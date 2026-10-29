import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile } from '../api';

const ROLE_INFO = {
  admin: {
    label: 'Central Dispatch Administrator',
    tier: 'Tier 3 · Root CAD Authority',
    icon: '🛡️',
    badgeBg: '#fee2e2',
    badgeColor: '#991b1b',
    borderColor: '#fca5a5',
    accentColor: '#dc2626',
    headerGradient: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)',
    privileges: [
      'Full oversight of regional incident queues and dispatch pipelines',
      'Automated spatial PostGIS hospital matching & manual escalation overrides',
      'Hospital facility directory configuration and resource governance',
      'User role assignment, invitation queues, and security provisioning',
      'Audit log generation and certified CSV export compliance'
    ]
  },
  hospital_manager: {
    label: 'Hospital Triage Manager',
    tier: 'Tier 2 · Facility Operational Command',
    icon: '🏥',
    badgeBg: '#CCFBF1',
    badgeColor: '#0F766E',
    borderColor: '#99F6E4',
    accentColor: '#0F4C81',
    headerGradient: 'linear-gradient(135deg, #0B3A63 0%, #0F4C81 100%)',
    privileges: [
      'Targeted ambulance dispatch alerts with audio sirens & ETA countdown',
      'Real-time bed capacity and life-support ventilator controls',
      'Specialist doctor duty roster scheduling and shift toggles',
      'Blood bank component reserves and universal donor safety tracking',
      'Emergency casualty admission, status escalation, and discharge'
    ]
  },
  patient: {
    label: 'Citizen / Patient',
    tier: 'Tier 1 · Public Emergency Access',
    icon: '👤',
    badgeBg: '#dcfce7',
    badgeColor: '#166534',
    borderColor: '#bbf7d0',
    accentColor: '#16a34a',
    headerGradient: 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)',
    privileges: [
      'Submit emergency SOS incident reports with GPS coordinates or map pin',
      'Instant clinical triage assessment (Immediate, Urgent, Delayed)',
      'Automated nearest hospital matching and live arrival time tracking',
      'Personal emergency incident history and hospital admission confirmations',
      'Direct one-click calling to emergency helpline and triage desks'
    ]
  }
};

export default function UserProfileSection({ onBackToDashboard }) {
  const { user, updateUser } = useAuth();

  const roleMeta = ROLE_INFO[user?.role] || ROLE_INFO.patient;

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Sync form data if user changes
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: user.name || '',
        phone: user.phone || ''
      }));
    }
  }, [user]);

  const handleCopyEmail = () => {
    if (user?.email && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(user.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!formData.name.trim()) {
      setError('Please provide your full legal name.');
      return;
    }

    if (showPasswordChange && formData.newPassword) {
      if (formData.newPassword.length < 6) {
        setError('New password must be at least 6 characters long.');
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setError('New password and confirmation password do not match.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null
      };

      if (showPasswordChange && formData.newPassword) {
        payload.password = formData.newPassword;
        if (formData.currentPassword) {
          payload.currentPassword = formData.currentPassword;
        }
      }

      const res = await updateUserProfile(payload);
      if (res.success && res.user) {
        updateUser(res.user);
        setSuccessMsg('Your profile information has been successfully updated.');
        setIsEditing(false);
        setShowPasswordChange(false);
        setFormData((prev) => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setShowPasswordChange(false);
    setError(null);
    setFormData({
      name: user?.name || '',
      phone: user?.phone || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  const glassCardStyle = {
    background: 'rgba(255, 255, 255, 0.84)',
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.85)',
    borderRadius: '14px',
    boxShadow: '0 8px 32px rgba(15, 76, 129, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.95)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      
      {/* 1. Profile Top Hero Card */}
      <div style={{
        background: roleMeta.headerGradient,
        borderRadius: '16px',
        padding: '2rem',
        color: '#ffffff',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        boxShadow: '0 8px 32px rgba(15, 76, 129, 0.16), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.25rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle decorative background glow */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', zIndex: 1 }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            {roleMeta.icon}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
              <span style={{
                background: 'rgba(255, 255, 255, 0.25)',
                padding: '0.2rem 0.65rem',
                borderRadius: '12px',
                fontSize: '0.74rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                {roleMeta.tier}
              </span>
              <span style={{
                background: '#ffffff',
                color: roleMeta.accentColor,
                padding: '0.15rem 0.55rem',
                borderRadius: '10px',
                fontSize: '0.72rem',
                fontWeight: 800
              }}>
                ● ONLINE / AUTHENTICATED
              </span>
            </div>

            <h2 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, color: '#ffffff' }}>
              {user?.name || 'Authenticated User'}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              <span style={{ color: '#e0e7ff', fontFamily: 'monospace' }}>
                ✉️ {user?.email}
              </span>
              <button
                onClick={handleCopyEmail}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
                title="Copy email handle"
              >
                {copiedEmail ? '✓ Copied!' : '📋 Copy'}
              </button>

              {user?.phone ? (
                <span style={{ color: '#cbd5e1' }}>
                  · 📞 <strong>{user.phone}</strong>
                </span>
              ) : (
                <span style={{ color: '#fed7aa', fontStyle: 'italic', fontSize: '0.8rem' }}>
                  · 📞 No mobile number added
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Edit / Cancel Toggle Button */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', zIndex: 1 }}>
          {!isEditing ? (
            <button
              onClick={() => {
                setIsEditing(true);
                setError(null);
                setSuccessMsg(null);
              }}
              style={{
                background: '#ffffff',
                color: roleMeta.accentColor,
                border: 'none',
                borderRadius: '8px',
                padding: '0.55rem 1.15rem',
                fontSize: '0.86rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
              }}
            >
              ✏️ Edit Profile
            </button>
          ) : (
            <button
              onClick={handleCancel}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '8px',
                padding: '0.55rem 1.15rem',
                fontSize: '0.86rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ✕ Cancel
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.88rem' }}>
          ⚠️ {error}
        </div>
      )}
      {successMsg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #10b981', color: '#065f46', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.88rem' }}>
          ✓ {successMsg}
        </div>
      )}

      {/* 2. Main Content: Edit Form OR Detailed Profile Cards */}
      {isEditing ? (
        /* ============================================================ */
        /* EDIT PROFILE MODE                                            */
        /* ============================================================ */
        <div style={{
          ...glassCardStyle,
          borderRadius: '14px',
          padding: '1.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '1.25rem' }}>✏️</span>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>
              Edit Personal Profile & Contact Information
            </h3>
          </div>
          <p style={{ margin: '0 0 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>
            Update your full name, primary mobile number for emergency notifications, and account credentials.
          </p>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {/* Full Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Dr. Rajesh Gupta or Jashanpreet Singh"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                  Displayed on official dispatch logs and triage rosters.
                </span>
              </div>

              {/* Mobile / Phone Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Primary Mobile / Contact Number
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. +91 94191 10074"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                  Used for SMS casualty alerts, emergency dispatch escalations, and duty coordination.
                </span>
              </div>
            </div>

            {/* Read-Only Identity Fields */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              fontSize: '0.82rem'
            }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Email Handle (System ID):</span>
                <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{user?.email}</strong>
                <span style={{ color: '#94a3b8', fontSize: '0.7rem', display: 'block' }}>Managed by Central Administrator</span>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Current Role Tier:</span>
                <strong style={{ color: roleMeta.accentColor }}>{roleMeta.label}</strong>
              </div>

              {user?.role === 'hospital_manager' && (
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.74rem' }}>Designated Facility:</span>
                  <strong style={{ color: '#0f172a' }}>{user?.hospital_name || 'Assigned by Administrator'}</strong>
                </div>
              )}
            </div>

            {/* Optional Password Update Section */}
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
              background: '#ffffff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>🔒 Account Security & Password</strong>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                    Leave blank if you do not want to change your password.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasswordChange(!showPasswordChange)}
                  className="hosp-btn"
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                >
                  {showPasswordChange ? '✕ Cancel Password Change' : '🔑 Change Password'}
                </button>
              </div>

              {showPasswordChange && (
                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Current Password (Optional verification)
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={formData.currentPassword}
                      onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      New Password (Min 6 chars) *
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={formData.newPassword}
                      onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      Confirm New Password *
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={handleCancel}
                className="hosp-btn"
                style={{ padding: '0.55rem 1.25rem', fontSize: '0.88rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
                style={{
                  background: roleMeta.accentColor,
                  padding: '0.55rem 1.5rem',
                  fontSize: '0.88rem',
                  fontWeight: 800
                }}
              >
                {saving ? 'Saving Updates...' : '💾 Save Changes'}
              </button>
            </div>

          </form>
        </div>
      ) : (
        /* ============================================================ */
        /* VIEW PROFILE MODE                                            */
        /* ============================================================ */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>

          {/* Card 1: Personal & Contact Identity */}
          <div style={{
            ...glassCardStyle,
            borderRadius: '14px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>📇</span> Personal Credentials
                </h4>
                <button
                  onClick={() => setIsEditing(true)}
                  className="hosp-btn"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                >
                  ✏️ Edit
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(226, 232, 240, 0.7)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: '#64748b' }}>Full Name:</span>
                  <strong style={{ color: '#0f172a' }}>{user?.name || 'N/A'}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(226, 232, 240, 0.7)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: '#64748b' }}>Email Handle:</span>
                  <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{user?.email}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(226, 232, 240, 0.7)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: '#64748b' }}>Primary Mobile:</span>
                  <strong style={{ color: user?.phone ? '#16a34a' : '#ea580c' }}>
                    {user?.phone ? `📞 ${user.phone}` : '⚠️ Not set'}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(226, 232, 240, 0.7)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: '#64748b' }}>Account ID:</span>
                  <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>#{user?.id}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Registration Date:</span>
                  <span style={{ color: '#334155' }}>
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active Member'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(226, 232, 240, 0.7)', fontSize: '0.75rem', color: '#64748b' }}>
              🔒 Protected by 256-bit JWT authentication & Argon2 password hashing.
            </div>
          </div>

          {/* Card 2: Role Tier & Institutional Privileges */}
          <div style={{
            ...glassCardStyle,
            borderRadius: '14px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🛡️</span> Role & Command Authorization
                </h4>
                <span style={{
                  background: roleMeta.badgeBg,
                  color: roleMeta.badgeColor,
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px'
                }}>
                  {roleMeta.label}
                </span>
              </div>

              {/* Designated Facility Badge if Hospital Manager */}
              {user?.role === 'hospital_manager' && (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 800, textTransform: 'uppercase' }}>
                    🏥 DESIGNATED HEALTHCARE FACILITY
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '0.15rem' }}>
                    {user?.hospital_name || 'GMC Jammu Trauma Center'}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#15803d', marginTop: '0.2rem' }}>
                    You hold operational authority over live bed allocations, duty rosters, and casualty admissions at this facility.
                  </div>
                </div>
              )}

              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                Active Operational Privileges
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {roleMeta.privileges.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.8rem', color: '#334155' }}>
                    <span style={{ color: roleMeta.accentColor, fontWeight: 800 }}>✓</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Role Tier Status: Verified</span>
              <button
                onClick={onBackToDashboard}
                className="hosp-btn"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
              >
                Go to Workspace →
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
