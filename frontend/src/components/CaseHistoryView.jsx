import React, { useState, useMemo } from 'react';

/**
 * CaseHistoryView Component
 * Displays resolved and closed emergency incident cases with comprehensive audit trail,
 * search filtering, outcome KPIs, and detailed clinical case dossiers.
 */
export default function CaseHistoryView({
  incidents = [],
  hospitals = [],
  onDeleteCase,
  isHospitalManager = false,
  hospitalName = ''
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [selectedCase, setSelectedCase] = useState(null);

  // Filter resolved cases
  const resolvedList = useMemo(() => {
    return incidents.filter((inc) => {
      // Must be resolved status
      const isResolved = ['arrived', 'closed', 'resolved', 'cancelled', 'transferred'].includes(inc.status);
      if (!isResolved) return false;

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'arrived' && inc.status !== 'arrived') return false;
        if (statusFilter === 'closed' && inc.status !== 'closed' && inc.status !== 'resolved') return false;
        if (statusFilter === 'cancelled' && inc.status !== 'cancelled') return false;
        if (statusFilter === 'transferred' && inc.status !== 'transferred') return false;
      }

      // Severity filter
      if (severityFilter !== 'all' && inc.severity !== severityFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesNumber = (inc.incident_number || '').toLowerCase().includes(query);
        const matchesPatient = (inc.patient_name || '').toLowerCase().includes(query);
        const matchesAddress = (inc.address || '').toLowerCase().includes(query);
        const matchesComplaint = (inc.chief_complaint || '').toLowerCase().includes(query);
        const matchesCategory = (inc.condition_category || '').toLowerCase().includes(query);
        const matchesHospital = (inc.assigned_hospital_name || '').toLowerCase().includes(query);
        const matchesCaller = (inc.caller_name || '').toLowerCase().includes(query);
        if (!matchesNumber && !matchesPatient && !matchesAddress && !matchesComplaint && !matchesCategory && !matchesHospital && !matchesCaller) {
          return false;
        }
      }

      return true;
    });
  }, [incidents, statusFilter, severityFilter, searchTerm]);

  // Statistics
  const totalArrived = incidents.filter(i => i.status === 'arrived').length;
  const totalClosed = incidents.filter(i => i.status === 'closed' || i.status === 'resolved').length;
  const totalTransferred = incidents.filter(i => i.status === 'transferred').length;
  const totalCancelled = incidents.filter(i => i.status === 'cancelled').length;

  const getSeverityBadge = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return <span style={{ padding: '0.2rem 0.55rem', borderRadius: '12px', background: '#fee2e2', color: '#dc2626', fontSize: '0.74rem', fontWeight: 700 }}>🔴 Critical</span>;
      case 'high':
        return <span style={{ padding: '0.2rem 0.55rem', borderRadius: '12px', background: '#ffedd5', color: '#ea580c', fontSize: '0.74rem', fontWeight: 700 }}>🟠 High</span>;
      case 'medium':
        return <span style={{ padding: '0.2rem 0.55rem', borderRadius: '12px', background: '#fef3c7', color: '#d97706', fontSize: '0.74rem', fontWeight: 700 }}>🟡 Medium</span>;
      default:
        return <span style={{ padding: '0.2rem 0.55rem', borderRadius: '12px', background: '#f1f5f9', color: '#475569', fontSize: '0.74rem', fontWeight: 700 }}>🔵 Low</span>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'arrived':
        return <span style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', background: '#dcfce7', color: '#16a34a', fontSize: '0.74rem', fontWeight: 700, border: '1px solid #bbf7d0' }}>🟢 Arrived & Admitted</span>;
      case 'closed':
      case 'resolved':
        return <span style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', background: '#e0f2fe', color: '#0284c7', fontSize: '0.74rem', fontWeight: 700, border: '1px solid #bae6fd' }}>🏁 Closed / Resolved</span>;
      case 'transferred':
        return <span style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', background: '#f3e8ff', color: '#9333ea', fontSize: '0.74rem', fontWeight: 700, border: '1px solid #e9d5ff' }}>🔄 Transferred</span>;
      case 'cancelled':
        return <span style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', background: '#f1f5f9', color: '#64748b', fontSize: '0.74rem', fontWeight: 700, border: '1px solid #cbd5e1' }}>⚪ Cancelled</span>;
      default:
        return <span style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', background: '#f8fafc', color: '#475569', fontSize: '0.74rem', fontWeight: 700 }}>{status}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* 1. Header Banner */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.4rem' }}>📜</span>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              {isHospitalManager ? `${hospitalName || 'Facility'}: Emergency Case History` : 'Regional Emergency Case History & Audit Trail'}
            </h2>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            Archived log of past patient arrivals, completed trauma admissions, and resolved dispatch lifecycles.
          </p>
        </div>

        {/* Quick KPI Counters */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.45rem 0.85rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Archived</span>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{incidents.filter(i => ['arrived', 'closed', 'resolved', 'cancelled', 'transferred'].includes(i.status)).length}</div>
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.45rem 0.85rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>Admitted</span>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a' }}>{totalArrived}</div>
          </div>
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '0.45rem 0.85rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 700, textTransform: 'uppercase' }}>Closed / Resolved</span>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0284c7' }}>{totalClosed}</div>
          </div>
          {totalTransferred > 0 && (
            <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '0.45rem 0.85rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: '#9333ea', fontWeight: 700, textTransform: 'uppercase' }}>Transferred</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#9333ea' }}>{totalTransferred}</div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Search & Filters Bar */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Search input */}
        <div style={{ flex: '1 1 280px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
          <input
            type="text"
            placeholder="Search by Case #, Patient, Landmark, Hospital, Chief Complaint..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem 0.55rem 2.25rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.84rem',
              color: '#0f172a',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.82rem',
              color: '#334155',
              background: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Outcomes</option>
            <option value="arrived">🟢 Arrived & Admitted</option>
            <option value="closed">🏁 Closed / Completed</option>
            <option value="transferred">🔄 Transferred</option>
            <option value="cancelled">⚪ Cancelled</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.82rem',
              color: '#334155',
              background: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Severities</option>
            <option value="critical">🔴 Critical</option>
            <option value="high">🟠 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🔵 Low</option>
          </select>

          {(searchTerm || statusFilter !== 'all' || severityFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setSeverityFilter('all');
              }}
              style={{
                background: 'transparent',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                borderRadius: '8px',
                padding: '0.45rem 0.75rem',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ✕ Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Case History Records Table */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
      }}>
        {resolvedList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: '#64748b' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📭</span>
            <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a', fontSize: '1.1rem' }}>No Historical Records Found</h3>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              {searchTerm || statusFilter !== 'all' || severityFilter !== 'all'
                ? 'No past cases match your current search criteria.'
                : 'Emergency cases that arrive at hospitals or get closed will automatically appear in this permanent audit log.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Incident #</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Patient & Condition</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Incident Location</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Admitted Facility</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Resolution</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Recorded At</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resolvedList.map((inc, idx) => {
                  const dateStr = inc.created_at ? new Date(inc.created_at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : '—';

                  return (
                    <tr
                      key={inc.id || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Incident Number & Severity */}
                      <td style={{ padding: '0.85rem 1.25rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', fontSize: '0.88rem' }}>
                            {inc.incident_number}
                          </span>
                          <div>{getSeverityBadge(inc.severity)}</div>
                        </div>
                      </td>

                      {/* Patient & Condition */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <strong style={{ color: '#0f172a', fontSize: '0.88rem' }}>
                            {inc.patient_name || 'Emergency Patient'}
                          </strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{
                              padding: '0.15rem 0.45rem',
                              borderRadius: '6px',
                              background: '#CCFBF1',
                              color: '#0F766E',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              textTransform: 'uppercase'
                            }}>
                              {inc.condition_category || 'General'}
                            </span>
                            <span style={{ fontSize: '0.76rem', color: '#64748b', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inc.chief_complaint}>
                              {inc.chief_complaint || 'No complaint details'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Address */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', maxWidth: '200px' }}>
                        <span style={{ color: '#334155', fontSize: '0.82rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inc.address}>
                          📍 {inc.address || 'Jammu Region'}
                        </span>
                      </td>

                      {/* Admitted Hospital */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '8px',
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          color: '#15803d',
                          fontWeight: 700,
                          fontSize: '0.8rem'
                        }}>
                          🏥 {inc.assigned_hospital_name || 'Admitted at Facility'}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                        {getStatusBadge(inc.status)}
                      </td>

                      {/* Timestamp */}
                      <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', color: '#64748b', fontSize: '0.78rem' }}>
                        {dateStr}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.85rem 1.25rem', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setSelectedCase(inc)}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              color: '#334155',
                              cursor: 'pointer'
                            }}
                            title="View complete clinical incident audit dossier"
                          >
                            👁️ View
                          </button>

                          {onDeleteCase && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Permanently remove historical case #${inc.incident_number}?`)) {
                                  onDeleteCase(inc.id);
                                }
                              }}
                              style={{
                                background: '#fee2e2',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                padding: '0.35rem 0.55rem',
                                fontSize: '0.76rem',
                                color: '#b91c1c',
                                cursor: 'pointer'
                              }}
                              title="Delete case record from database"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Full Case Dossier Modal */}
      {selectedCase && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
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
            maxWidth: '650px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.75rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>📁</span>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>
                    Emergency Case Dossier: #{selectedCase.incident_number}
                  </h3>
                </div>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Archived clinical timeline and admission verification record
                </p>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Patient and Clinical Overview */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Patient Information</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Name</span>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{selectedCase.patient_name || 'Patient'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Triage Priority</span>
                    <div>{getSeverityBadge(selectedCase.severity)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Clinical Specialty Category</span>
                    <div style={{ fontWeight: 700, color: '#0F4C81', fontSize: '0.85rem', textTransform: 'uppercase' }}>{selectedCase.condition_category}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Lifecycle Outcome</span>
                    <div>{getStatusBadge(selectedCase.status)}</div>
                  </div>
                </div>
              </div>

              {/* Chief Complaint */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Chief Complaint & Symptoms</span>
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.88rem', color: '#0f172a', lineHeight: 1.5 }}>
                  {selectedCase.chief_complaint || 'No recorded description'}
                </p>
              </div>

              {/* Admission Facility */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '1rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>Admitted Receiving Facility</span>
                <div style={{ fontWeight: 800, color: '#15803d', fontSize: '1rem', marginTop: '0.35rem' }}>
                  🏥 {selectedCase.assigned_hospital_name || 'Admitted Facility'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: '0.25rem' }}>
                  📍 Incident Location: {selectedCase.address}
                </div>
              </div>

              {/* Field Notes & Caller */}
              {selectedCase.notes && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Field Notes & Triage Comments</span>
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: '#334155' }}>
                    {selectedCase.notes}
                  </p>
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedCase(null)}
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.55rem 1.25rem',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
