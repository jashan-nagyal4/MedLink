import { useState } from 'react';
import { createHospital } from '../api';

const REGIONAL_PRESETS = [
  { name: 'Bakshi Nagar (GMC Area)', lat: 32.7355, lng: 74.8582 },
  { name: 'Gandhi Nagar / Shastri Nagar', lat: 32.7052, lng: 74.8691 },
  { name: 'Bahu Plaza / Rail Head', lat: 32.7085, lng: 74.8724 },
  { name: 'Channi Himmat', lat: 32.6852, lng: 74.8854 },
  { name: 'Katra (Mata Vaishno Devi Base)', lat: 32.9925, lng: 74.9318 },
  { name: 'Udhampur Highway Junction', lat: 32.9254, lng: 75.1423 }
];

export default function AddHospitalModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('32.7350');
  const [longitude, setLongitude] = useState('74.8580');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [operationalStatus, setOperationalStatus] = useState('operational');
  const [initDefaultResources, setInitDefaultResources] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
      },
      (err) => {
        alert('Could not determine current location: ' + err.message);
      }
    );
  };

  const handleApplyPreset = (preset) => {
    setLatitude(preset.lat.toFixed(6));
    setLongitude(preset.lng.toFixed(6));
    if (!address) {
      setAddress(preset.name + ', Jammu, J&K');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      setError('Hospital name and full address are required.');
      return;
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(latNum) || isNaN(lngNum)) {
      setError('Please provide valid decimal GPS coordinates.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createHospital({
        name: name.trim(),
        address: address.trim(),
        latitude: latNum,
        longitude: lngNum,
        phone: phone.trim() || null,
        email: email.trim().toLowerCase() || null,
        operationalStatus,
        initDefaultResources
      });

      if (onCreated) {
        onCreated(res.hospital);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add hospital.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '600px', width: '90%' }}
      >
        <div className="modal-header">
          <div>
            <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', marginBottom: '0.35rem' }}>
              ADMIN FACILITY PROVISIONING
            </span>
            <h2 className="modal-title">🏥 Add Regional Hospital Facility</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Register a new healthcare facility in the MedLink regional dispatch network.
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Hospital Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
              Hospital / Medical Center Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Super Specialty Hospital & Trauma Center"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Full Address */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
              Physical Address & Landmark *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Resham Ghar Colony, Bakshi Nagar, Jammu, J&K 180001"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* GPS Coordinates */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                📍 Geolocation Coordinates (PostGIS Point) *
              </span>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="hosp-btn"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#F0FDFA', color: '#0F766E' }}
              >
                📍 Use Device GPS
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem' }}>
                  Latitude (North)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="32.7350"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem' }}>
                  Longitude (East)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="74.8580"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Quick Regional Presets */}
            <div style={{ marginTop: '0.65rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.3rem', fontWeight: 600 }}>
                Quick Jammu Region Presets:
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {REGIONAL_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.2rem 0.45rem',
                      borderRadius: '4px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                      color: '#334155'
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Contact Details & Operational Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                Emergency Desk Phone
              </label>
              <input
                type="tel"
                placeholder="+91-191-2580100"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                Desk Email
              </label>
              <input
                type="email"
                placeholder="triage@hospital.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
              Operational Status
            </label>
            <select
              value={operationalStatus}
              onChange={(e) => setOperationalStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                background: '#ffffff',
                boxSizing: 'border-box'
              }}
            >
              <option value="operational">🟢 Operational (Accepting Emergency Inbound)</option>
              <option value="diverting">🟡 Diverting (High Triage Load / Emergency Priority Only)</option>
              <option value="at_capacity">🔴 At Full Capacity (Critical Surges Only)</option>
              <option value="closed">⚪ Closed / Offline Maintenance</option>
            </select>
          </div>

          {/* Starter Resources Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#ecfdf5', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
            <input
              type="checkbox"
              id="initResources"
              checked={initDefaultResources}
              onChange={(e) => setInitDefaultResources(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="initResources" style={{ fontSize: '0.82rem', color: '#065f46', fontWeight: 600, cursor: 'pointer' }}>
              Initialize with baseline capacity (8 ICU beds, 25 Ward beds, 4 Resuscitation bays, 6 Ventilators)
            </label>
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="hosp-btn"
              onClick={onClose}
              disabled={loading}
              style={{ padding: '0.6rem 1.25rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ padding: '0.6rem 1.4rem', background: '#0f766e', fontWeight: 700 }}
            >
              {loading ? 'Adding Facility...' : '✚ Add Hospital to Network'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
