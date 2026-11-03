/*
  Map Page (Leaflet + OpenStreetMap)
  ------------------------------------
  - Free map tiles from OpenStreetMap (NO API KEY NEEDED)
  - react-leaflet provides MapContainer, TileLayer, Marker, Popup, Polyline components
  - Custom colored markers using L.divIcon (avoids broken default marker icons in CRA)
  - Markers:
      RED = Restaurant (popup: name, address, active food posts count)
      BLUE = Delivery Agent (popup: name, contact, vehicle)
      GREEN = NGO (popup: name, address, accepted count)
  - Polylines (lines): drawn for each food post where NGO accepted:
      YELLOW = NGO Accepted, no agent yet
      ORANGE = Agent Assigned / Picked Up
      GREEN = Delivered / Donated
  - Right-side panel: legend + list of active deliveries with distance (restaurant -> NGO)

  Student explanation:
    The TileLayer URL https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png fetches
    256x256 tile images from OSM. {z} is zoom level, {x}/{y} are tile coordinates.
    This is exactly how free maps work — no API key needed.
*/

import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useAppContext } from '../context/AppContext';
import { haversineDistance } from '../utils/distance';
import { FOOD_STATUS, STATUS_LABELS } from '../utils/constants';

// Custom colored divIcon markers (no external images needed, works perfectly in CRA)
function makeIcon(bg, size = 32) {
  return L.divIcon({
    className: 'fc-marker',
    html: `<div style="background:${bg};width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;border:3px solid white;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:white;font-size:14px;font-weight:700;">●</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}
const ICON_RESTAURANT = makeIcon('#e74c3c');
const ICON_AGENT = makeIcon('#3498db');
const ICON_NGO = makeIcon('#27ae60');

// Route line colors per food post status
function routeColor(status) {
  if (status === FOOD_STATUS.NGO_ACCEPTED) return '#f1c40f'; // yellow
  if (status === FOOD_STATUS.AGENT_ASSIGNED || status === FOOD_STATUS.PICKED_UP) return '#e67e22'; // orange
  if (status === FOOD_STATUS.DELIVERED) return '#27ae60'; // green
  return null;
}

export default function MapPage() {
  const ctx = useAppContext();
  const users = Array.isArray(ctx?.users) ? ctx.users : [];
  const foodPosts = Array.isArray(ctx?.foodPosts) ? ctx.foodPosts : [];

  const restaurants = (users.filter((u) => u && u.role === 'restaurant' && u.latitude && u.longitude)) || [];
  const agents = (users.filter((u) => u && u.role === 'agent' && u.latitude && u.longitude)) || [];
  const ngos = (users.filter((u) => u && u.role === 'ngo' && u.latitude && u.longitude)) || [];

  // Compute center of all valid markers, or default to Mumbai (19.076, 72.8777)
  const center = useMemo(() => {
    const all = [
      ...(Array.isArray(restaurants) ? restaurants : []),
      ...(Array.isArray(agents) ? agents : []),
      ...(Array.isArray(ngos) ? ngos : []),
    ];
    if (!all || !all.length) return [19.076, 72.8777];
    const latSum = all.reduce((s, u) => s + (u?.latitude || 0), 0);
    const lngSum = all.reduce((s, u) => s + (u?.longitude || 0), 0);
    return [latSum / all.length, lngSum / all.length];
  }, [restaurants, agents, ngos]);

  // Lines: for posts with ngo_id and lat/lng coords, draw restaurant -> NGO
  const lines = useMemo(() => {
    return (foodPosts
      .filter((p) => p && p.ngo_id && p.restaurant_lat && p.ngo_lat)
      .map((p) => {
        const r = (Array.isArray(restaurants) ? restaurants : []).find((u) => u && u.id === p.restaurant_id);
        const n = (Array.isArray(ngos) ? ngos : []).find((u) => u && u.id === p.ngo_id);
        const positions = [
          [p.restaurant_lat, p.restaurant_lng],
          [p.ngo_lat, p.ngo_lng],
        ];
        return {
          post: p,
          positions,
          color: routeColor(p.status),
          distanceKm: haversineDistance(p.restaurant_lat, p.restaurant_lng, p.ngo_lat, p.ngo_lng),
          rName: r?.restaurant_name || r?.full_name || 'Restaurant',
          nName: n?.ngo_name || n?.full_name || 'NGO',
        };
      })
      .filter((l) => l && l.color)) || [];
  }, [foodPosts, restaurants, ngos]);

  // Count active food posts per restaurant (for popup)
  const restFoodCount = (id) =>
    (foodPosts.filter((p) => p && p.restaurant_id === id &&
      [FOOD_STATUS.AVAILABLE, FOOD_STATUS.NGO_ACCEPTED, FOOD_STATUS.AGENT_ASSIGNED, FOOD_STATUS.PICKED_UP].includes(p.status)) || []).length;
  const ngoAcceptedCount = (id) =>
    (foodPosts.filter((p) => p && p.ngo_id === id) || []).length;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>🗺️ Live Donation Map (OpenStreetMap)</h2>
      <p style={{ color: '#566573', marginTop: -8, marginBottom: 14 }}>
        Real-time view of Restaurants (red), Delivery Agents (blue), NGOs (green), and active donation routes.
        Uses OpenStreetMap tiles &mdash; completely free, no API key needed.
      </p>

      <div className="map-page">
        <div className="map-container">
          <MapContainer center={center} zoom={12} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {(restaurants || []).map((r) => (
              r && <Marker key={'r-' + r.id} position={[r.latitude, r.longitude]} icon={ICON_RESTAURANT}>
                <Popup>
                  <strong>{r.restaurant_name || r.full_name}</strong>
                  <div style={{ fontSize: 12, color: '#555' }}>Restaurant 🍴</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>{r.address}</div>
                  <div style={{ fontSize: 12 }}>📞 {r.contact}</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    Active food posts: <strong>{restFoodCount(r.id)}</strong>
                  </div>
                </Popup>
              </Marker>
            ))}

            {(agents || []).map((a) => (
              a && <Marker key={'a-' + a.id} position={[a.latitude, a.longitude]} icon={ICON_AGENT}>
                <Popup>
                  <strong>{a.full_name}</strong>
                  <div style={{ fontSize: 12, color: '#555' }}>Delivery Agent 🛵</div>
                  <div style={{ fontSize: 12 }}>📞 {a.contact}</div>
                  <div style={{ fontSize: 12 }}>Vehicle: {a.vehicle_type || '—'}</div>
                </Popup>
              </Marker>
            ))}

            {(ngos || []).map((n) => (
              n && <Marker key={'n-' + n.id} position={[n.latitude, n.longitude]} icon={ICON_NGO}>
                <Popup>
                  <strong>{n.ngo_name || n.full_name}</strong>
                  <div style={{ fontSize: 12, color: '#555' }}>NGO / Shelter 🏠 ({n.ngo_type || 'Other'})</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>{n.address}</div>
                  <div style={{ fontSize: 12 }}>📞 {n.contact}</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    Accepted donations: <strong>{ngoAcceptedCount(n.id)}</strong>
                  </div>
                </Popup>
              </Marker>
            ))}

            {(lines || []).map((l, i) => (
              l && <Polyline
                key={'line-' + i}
                positions={l.positions}
                color={l.color}
                weight={5}
                opacity={0.85}
                dashArray={l.post && l.post.status === FOOD_STATUS.NGO_ACCEPTED ? '8 8' : undefined}
              />
            ))}
          </MapContainer>
        </div>

        <div className="map-side-panel">
          <h3>Legend</h3>
          <div className="legend">
            <div><span className="dot" style={{ background: '#e74c3c' }}></span>Restaurant (has food to donate)</div>
            <div><span className="dot" style={{ background: '#3498db' }}></span>Delivery Agent</div>
            <div><span className="dot" style={{ background: '#27ae60' }}></span>NGO / Beneficiary</div>
            <div><span className="dot" style={{ background: '#f1c40f' }}></span>Route: NGO Accepted (awaiting agent)</div>
            <div><span className="dot" style={{ background: '#e67e22' }}></span>Route: In Transit (agent on way)</div>
            <div><span className="dot" style={{ background: '#27ae60' }}></span>Route: Delivered / Donated ✓</div>
          </div>

          <h3>Active Donations ({lines.length})</h3>
          {(lines || []).length === 0 && (
            <div style={{ fontSize: 13, color: '#566573' }}>
              No active routes yet. Once an NGO accepts a donation from a restaurant,
              a line connecting them will appear here.
            </div>
          )}
          {(lines || []).map((l, i) => (
            l && <div key={'r-' + i} className="route-item">
              <div><strong>{l.rName}</strong> → <strong>{l.nName}</strong></div>
              <div style={{ color: '#566573' }}>
                📏 Distance: ~{l.distanceKm ?? '?'} km &nbsp;·&nbsp;
                Status: {(l.post && STATUS_LABELS[l.post.status]) || (l.post && l.post.status) || '—'}
              </div>
              <div style={{ fontSize: 12, color: '#333' }}>
                🍽️ {l.post && l.post.food_type} · {l.post && l.post.quantity} {l.post && l.post.quantity_unit}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
