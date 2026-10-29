import React from 'react';
import medLinkLogo from '../assets/logo.png';

export default function LeftDock({
  activeTab,
  setActiveTab,
  role,
  user,
  hospitalsCount = 0,
  incidentsCount = 0,
  apiConnected = false,
  wsConnected = false,
  onQuickIntake,
  collapsed,
  setCollapsed,
  onLogout
}) {
  const adminNavItems = [
    { id: 'dashboard', label: 'Analytics Dashboard', icon: '📊', isNew: true },
    { id: 'incidents', label: 'Live Queue', icon: '📋', badge: incidentsCount, badgeColor: incidentsCount > 0 ? '#DC2626' : '#64748B' },
    { id: 'hospitals', label: 'Regional Hospitals', icon: '🏥', badge: hospitalsCount, badgeColor: '#0F4C81' },
    { id: 'integration', label: 'System Integration', icon: '🧪', isNew: true },
    { id: 'evaluation', label: 'System Evaluation', icon: '📈', isNew: true },
    { id: 'users', label: 'User & Roles', icon: '👥' }
  ];

  // Hospital Manager categories (Dashboard -> Incidents -> Beds -> Doctors -> Blood Bank)
  const hospitalNavItems = [
    { id: 'dashboard', label: 'Analytics Dashboard', icon: '📊', isNew: true },
    { id: 'incidents', label: 'Emergency Incidents', icon: '🚨', badge: incidentsCount, badgeColor: incidentsCount > 0 ? '#DC2626' : '#64748B' },
    { id: 'beds', label: 'Beds & Equipments', icon: '🛏️' },
    { id: 'doctors', label: 'Duty Doctors & Rosters', icon: '👨‍⚕️' },
    { id: 'blood', label: 'Blood Bank & Plasma', icon: '🩸' }
  ];

  // Citizen navigation categories (Emergency Helpdesk & Regional Hospitals Directory)
  const citizenNavItems = [
    { id: 'dashboard', label: 'Emergency Helpdesk', icon: '🚨' },
    { id: 'hospitals', label: 'Regional Hospitals', icon: '🏥', badge: hospitalsCount, badgeColor: '#0F4C81' }
  ];

  const currentNavItems = role === 'admin' ? adminNavItems : role === 'hospital_manager' ? hospitalNavItems : citizenNavItems;

  return (
    <aside className={`left-dock ${collapsed ? 'collapsed' : ''}`}>
      {/* 1. Header & Brand Logo */}
      <div className="dock-header">
        <div className="dock-brand" onClick={() => setActiveTab('incidents')} style={{ cursor: 'pointer' }}>
          <div className="dock-brand-icon">
            <img src={medLinkLogo} alt="MedLink Logo" className="dock-logo-img" />
          </div>
          {!collapsed && (
            <div className="dock-brand-text">
              <span className="dock-title">MedLink</span>
              <span className="dock-subtitle">CAD COMMAND</span>
            </div>
          )}
        </div>
        <button
          className="dock-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* 2. Quick Action: Emergency Intake SOS */}
      <div className="dock-action-section">
        <button
          className="dock-sos-btn"
          onClick={onQuickIntake}
          title="File Immediate Emergency Incident Report"
        >
          <span className="dock-sos-icon">🚨</span>
          {!collapsed && <span className="dock-sos-label">Quick Intake</span>}
        </button>
      </div>

      {/* 3. Navigation Links (Sorted relevance-wise) */}
      <div className="dock-nav-section">
        {!collapsed && (
          <span className="dock-section-title">
            {role === 'admin' ? 'COMMAND MODULES' : role === 'hospital_manager' ? 'FACILITY MODULES' : 'CITIZEN SERVICES'}
          </span>
        )}
        <nav className="dock-nav">
          {currentNavItems.length > 0 ? (
            currentNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  className={`dock-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="dock-nav-icon">{item.icon}</span>
                  {!collapsed && (
                    <span className="dock-nav-label">
                      {item.label}
                      {item.isNew && <span className="dock-pill-new">LIVE</span>}
                    </span>
                  )}
                  {!collapsed && item.badge !== undefined && item.badge > 0 && (
                    <span
                      className="dock-nav-badge"
                      style={{ background: item.badgeColor }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div style={{ padding: collapsed ? '0' : '0.5rem 0.25rem' }}>
              {!collapsed && (
                <div style={{
                  background: '#1e293b',
                  borderRadius: '8px',
                  padding: '0.65rem 0.75rem',
                  border: '1px solid #334155'
                }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                    Citizen Portal
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
                    Emergency Assistance
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      {/* 4. Real-Time Engine & API Health Status */}
      {!collapsed && (
        <div style={{ padding: '0.75rem 1rem 0.25rem' }}>
          <div className="dock-health-indicators">
            <div className="dock-health-item" title={apiConnected ? 'REST API Online' : 'REST API Disconnected'}>
              <span className={`dock-status-dot ${apiConnected ? 'online' : 'offline'}`} />
              <span>{apiConnected ? 'API OK' : 'API Off'}</span>
            </div>
            <div className="dock-health-item" title={wsConnected ? 'WebSocket Real-time Engine Connected' : 'WebSocket Disconnected'}>
              <span className={`dock-status-dot ${wsConnected ? 'online' : 'offline'}`} />
              <span>{wsConnected ? 'Real-Time' : 'WS Off'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. User Account & Switcher Section (Pinned at Bottom) */}
      <div className="dock-user-section">
        <div className="dock-user-card">
          <div className="dock-user-avatar">
            {role === 'admin' ? '🛡️' : role === 'hospital_manager' ? '🏥' : '👤'}
          </div>
          {!collapsed && (
            <div className="dock-user-info">
              <span className="dock-user-name">{user?.name || 'Authorized User'}</span>
              <span className="dock-user-role">
                {role?.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>

        {!collapsed ? (
          <button
            onClick={onLogout}
            className="dock-logout-btn"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.5rem',
              fontWeight: 700,
              fontSize: '0.82rem',
              marginTop: '0.5rem'
            }}
            title="Sign Out of MedLink"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        ) : (
          <button
            onClick={onLogout}
            className="dock-logout-btn"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.45rem',
              marginTop: '0.5rem',
              fontSize: '0.85rem'
            }}
            title="Sign Out of MedLink"
          >
            🚪
          </button>
        )}
      </div>
    </aside>
  );
}
