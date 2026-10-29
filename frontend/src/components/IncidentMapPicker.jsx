/**
 * Interactive Incident Map & Location Picker (Leaflet + OpenStreetMap)
 * 
 * Provides interactive geographic mapping for incident location selection and telemetry.
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet icon paths in Vite bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom red marker for emergency incident
const incidentIcon = L.divIcon({
  className: 'custom-incident-pin',
  html: `<div style="
    background: #dc2626;
    width: 32px;
    height: 32px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 3px solid #ffffff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  "><span style="transform: rotate(45deg); font-size: 14px; color: white;">🚨</span></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// Custom blue marker for hospitals
const hospitalIcon = L.divIcon({
  className: 'custom-hospital-pin',
  html: `<div style="
    background: #0F4C81;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 13px;
    font-weight: bold;
  ">✚</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -14]
});

const JAMMU_HOTSPOTS = [
  { name: 'Gandhi Nagar', lat: 32.7090, lng: 74.8680, address: 'Gandhi Nagar, Jammu, J&K 180004' },
  { name: 'Bakshi Nagar (Near GMC)', lat: 32.7426, lng: 74.8458, address: 'Bakshi Nagar, Jammu, J&K 180001' },
  { name: 'Jewel Chowk', lat: 32.7230, lng: 74.8560, address: 'Jewel Chowk, Jammu, J&K 180001' },
  { name: 'Sidhra Bridge', lat: 32.7533, lng: 74.9122, address: 'Sidhra Bypass, Jammu, J&K 180017' },
  { name: 'Jammu Tawi Station', lat: 32.7032, lng: 74.8732, address: 'Railway Road, Jammu, J&K 180012' }
];

export default function IncidentMapPicker({
  latitude,
  longitude,
  onLocationSelect,
  hospitals = []
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const incidentMarkerRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const lat = Number(latitude) || 32.7266;
    const lng = Number(longitude) || 74.8570;

    const map = L.map(mapContainerRef.current).setView([lat, lng], 13);
    mapInstanceRef.current = map;

    // OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // Add Incident Marker (Draggable)
    const marker = L.marker([lat, lng], {
      icon: incidentIcon,
      draggable: true
    }).addTo(map);

    marker.bindPopup('<strong>🚨 Incident Location</strong><br/>Drag or click map to change location.');
    incidentMarkerRef.current = marker;

    // Click anywhere on map to move marker
    map.on('click', (e) => {
      const { lat: newLat, lng: newLng } = e.latlng;
      marker.setLatLng([newLat, newLng]);
      onLocationSelect(newLat.toFixed(5), newLng.toFixed(5));
    });

    // Drag marker event
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onLocationSelect(pos.lat.toFixed(5), pos.lng.toFixed(5));
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update marker position when props change
  useEffect(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (incidentMarkerRef.current && mapInstanceRef.current) {
      incidentMarkerRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.panTo([lat, lng]);
    }
  }, [latitude, longitude]);

  // Display Hospital Pins on the Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !hospitals.length) return;

    const hospitalLayer = L.layerGroup();

    hospitals.forEach((hosp) => {
      if (hosp.latitude && hosp.longitude) {
        const hospMarker = L.marker([hosp.latitude, hosp.longitude], {
          icon: hospitalIcon
        });
        hospMarker.bindPopup(`
          <div style="font-family: inherit;">
            <strong style="color: #0F4C81;">✚ ${hosp.name}</strong><br/>
            <small style="color: #64748b;">${hosp.address}</small><br/>
            <span style="font-size: 11px; color: ${hosp.operational_status === 'operational' ? '#16a34a' : '#d97706'}; font-weight: 600;">
              ● ${hosp.operational_status.toUpperCase()}
            </span>
          </div>
        `);
        hospitalLayer.addLayer(hospMarker);
      }
    });

    hospitalLayer.addTo(map);

    return () => {
      map.removeLayer(hospitalLayer);
    };
  }, [hospitals]);

  return (
    <div style={{ marginTop: '0.75rem' }}>
      {/* Quick Location Pills */}
      <div style={{ marginBottom: '0.6rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginRight: '0.5rem' }}>
          Quick Jammu Landmarks:
        </span>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
          {JAMMU_HOTSPOTS.map((spot, i) => (
            <button
              key={i}
              type="button"
              className="hosp-btn"
              style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem', cursor: 'pointer' }}
              onClick={() => onLocationSelect(spot.lat, spot.lng, spot.address)}
            >
              📍 {spot.name}
            </button>
          ))}
        </div>
      </div>

      {/* Map Canvas */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '280px',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)'
        }}
      />
      <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
        💡 <strong>Tip:</strong> Click anywhere on the map or drag the red emergency pin 🚨 to set the exact incident GPS coordinates. Blue pins ✚ show nearby hospitals.
      </p>
    </div>
  );
}
