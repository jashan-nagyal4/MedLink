/**
 * MedLink Dual-Portal Login & Authentication Page
 * 
 * Styled with Clinical Healthcare Design System:
 * Primary: #0F4C81, Primary hover: #0B3A63
 * Accent: #14B8A6, Accent dark: #0F766E
 * Page background: #F8FAFC, Surface: #FFFFFF
 * Main text: #0F172A, Body text: #475569, Muted text: #64748B
 * Border: #E2E8F0, Danger: #DC2626
 * 
 * Features:
 * 1. Citizen Portal: For public citizens & patients (Sign in & registration).
 * 2. Staff Portal: For authorized dispatchers, hospital managers, and medical staff.
 * 
 * Enforces strict role-based access:
 * - Admin/Manager accounts cannot log in through Citizen portal.
 * - Citizen accounts cannot log in through Staff portal.
 */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import medLinkLogo from '../assets/logo.png';

export default function LoginPage() {
  const { login, register, logout } = useAuth();
  
  // Toggle mode: 'citizen' | 'staff'
  const [portalMode, setPortalMode] = useState('citizen');
  
  // Registration state for citizens
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (portalMode === 'citizen' && isRegistering) {
        await register({ name, email, password, phone });
      } else {
        const user = await login(email, password, portalMode);
        
        // Strict client-side verification safeguard
        if (portalMode === 'citizen' && user?.role !== 'patient') {
          logout();
          setError('Invalid email or password.');
          return;
        }

        if (portalMode === 'staff' && user?.role === 'patient') {
          logout();
          setError('Invalid email or password.');
          return;
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchPortal = (mode) => {
    setPortalMode(mode);
    setIsRegistering(false);
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0B3A63 0%, #0F4C81 50%, #0F766E 100%)',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2.5rem 1rem',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Ambient Radial Background Glow Orbs */}
      <div style={{
        position: 'absolute',
        width: '450px',
        height: '450px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(20, 184, 166, 0.22) 0%, rgba(15, 76, 129, 0.1) 50%, transparent 70%)',
        top: '-10%',
        left: '-5%',
        filter: 'blur(60px)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(15, 76, 129, 0.3) 0%, rgba(11, 58, 99, 0.15) 50%, transparent 75%)',
        bottom: '-12%',
        right: '-8%',
        filter: 'blur(70px)',
        pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 10 }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: '#FFFFFF',
            padding: '6px',
            marginBottom: '0.85rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.35), 0 0 16px rgba(20, 184, 166, 0.3)',
            transition: 'all 0.3s ease',
            overflow: 'hidden'
          }}>
            <img
              src={medLinkLogo}
              alt="MedLink Platform Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          </div>

          <h1 style={{
            fontSize: '2.1rem',
            fontWeight: 900,
            margin: '0 0 0.35rem',
            letterSpacing: '-0.025em',
            color: '#FFFFFF'
          }}>
            MedLink Access Control
          </h1>
          <p style={{ color: '#E2E8F0', fontSize: '0.92rem', maxWidth: '440px', margin: '0 auto', lineHeight: 1.45, opacity: 0.9 }}>
            Emergency Incident Coordination & Hospital Capacity Platform
          </p>
        </div>

        {/* Dual Portal Interactive Toggle Bar */}
        <div style={{
          display: 'flex',
          background: 'rgba(11, 58, 99, 0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: '0.35rem',
          borderRadius: '14px',
          border: '1px solid rgba(226, 232, 240, 0.15)',
          marginBottom: '1.25rem',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)'
        }}>
          <button
            type="button"
            onClick={() => handleSwitchPortal('citizen')}
            style={{
              flex: 1,
              padding: '0.75rem 0.6rem',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              background: portalMode === 'citizen' 
                ? 'linear-gradient(135deg, #0F4C81 0%, #0B3A63 100%)' 
                : 'transparent',
              color: portalMode === 'citizen' ? '#FFFFFF' : '#CBD5E1',
              boxShadow: portalMode === 'citizen' 
                ? '0 4px 14px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.25)' 
                : 'none'
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>👤</span>
            <span>Citizen</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchPortal('staff')}
            style={{
              flex: 1,
              padding: '0.75rem 0.6rem',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              background: portalMode === 'staff' 
                ? 'linear-gradient(135deg, #0F4C81 0%, #0B3A63 100%)' 
                : 'transparent',
              color: portalMode === 'staff' ? '#FFFFFF' : '#CBD5E1',
              boxShadow: portalMode === 'staff' 
                ? '0 4px 14px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.25)' 
                : 'none'
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>🛡️</span>
            <span>Staff</span>
          </button>
        </div>

        {/* Credentials Authentication Card */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '18px',
          border: '1px solid #E2E8F0',
          padding: '2.25rem 2rem',
          boxShadow: '0 20px 50px rgba(11, 58, 99, 0.35)',
          transition: 'all 0.3s ease'
        }}>

          {/* Mode Title & Registration Switcher */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{
              fontSize: '1.35rem',
              margin: 0,
              fontWeight: 800,
              color: '#0F172A',
              letterSpacing: '-0.015em'
            }}>
              {portalMode === 'staff'
                ? 'Staff Sign In'
                : isRegistering
                ? 'Register Patient Account'
                : 'Citizen Sign In'}
            </h2>

            {/* In Citizen mode only: offer registration toggle */}
            {portalMode === 'citizen' && (
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError('');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#0F766E',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px'
                }}
              >
                {isRegistering ? '← Back to Sign In' : '+ Create Account'}
              </button>
            )}
          </div>

          {error && (
            <div style={{
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              color: '#DC2626',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              fontSize: '0.86rem',
              fontWeight: 600,
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              lineHeight: 1.45
            }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {portalMode === 'citizen' && isRegistering && (
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.72rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    fontSize: '0.92rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'all 0.15s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#14B8A6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(20, 184, 166, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#CBD5E1';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', color: '#475569', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                {portalMode === 'staff' ? 'Staff Email Address' : 'Email Address'}
              </label>
              <input
                type="email"
                required
                placeholder={portalMode === 'staff' ? 'staff@medlink.org' : 'citizen@example.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.72rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '0.92rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'all 0.15s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#14B8A6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(20, 184, 166, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#CBD5E1';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {portalMode === 'citizen' && isRegistering && (
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="+91-9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.72rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    fontSize: '0.92rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'all 0.15s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#14B8A6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(20, 184, 166, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#CBD5E1';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', color: '#475569', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.72rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '0.92rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'all 0.15s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#14B8A6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(20, 184, 166, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#CBD5E1';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.65rem',
                background: 'linear-gradient(135deg, #0F4C81 0%, #0B3A63 100%)',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.82rem',
                borderRadius: '10px',
                fontSize: '0.98rem',
                fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(15, 76, 129, 0.3)',
                letterSpacing: '0.01em'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(15, 76, 129, 0.45)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(15, 76, 129, 0.3)';
              }}
            >
              <span>{loading ? 'Authenticating…' : portalMode === 'staff' ? 'Sign In as Staff' : isRegistering ? 'Register as Patient' : 'Sign In as Citizen'}</span>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
