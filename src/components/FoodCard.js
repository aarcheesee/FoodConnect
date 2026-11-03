/*
  FoodCard component
  -------------------
  A reusable card used by Restaurant Dashboard, NGO Dashboard, Agent Dashboard.
  Takes the food post + optional action buttons (children) and optional distance chip.
  Also shows info about the linked NGO/Agent if the post has reached that stage.
*/
import StatusBadge from './StatusBadge';
import { useAppContext } from '../context/AppContext';

function formatDT(s) {
  if (!s) return '—';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleString();
}

export default function FoodCard({ post, distanceKm, children }) {
  const ctx = useAppContext();
  const getUserById = ctx?.getUserById || (() => null);
  const restaurant = post && getUserById(post.restaurant_id);
  const ngo = post && post.ngo_id ? getUserById(post.ngo_id) : null;
  const agent = post && post.agent_id ? getUserById(post.agent_id) : null;

  return (
    <div className="food-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <h4>{post.food_type}</h4>
        <StatusBadge status={post.status} />
      </div>

      {distanceKm != null && (
        <div>
          <span className="distance-chip">📍 ~{distanceKm} km</span>
        </div>
      )}

      <div className="food-meta">
        <div><span className="label">Quantity:</span> {post.quantity} {post.quantity_unit}</div>
        {post.description && <div><span className="label">Description:</span> {post.description}</div>}
        <div><span className="label">Pickup Window:</span> {formatDT(post.pickup_start)} → {formatDT(post.pickup_end)}</div>
        <div><span className="label">Expiry:</span> {formatDT(post.expiry)}</div>
      </div>

      {restaurant && (
        <div className="food-meta" style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <div><span className="label">Restaurant:</span> {restaurant.restaurant_name || restaurant.full_name}</div>
          {restaurant.area && restaurant.pincode && (
            <div><span className="label">Area / Pin:</span> {restaurant.area} - {restaurant.pincode}</div>
          )}
          <div><span className="label">Address:</span> {restaurant.address}</div>
          <div><span className="label">Contact:</span> {restaurant.contact}</div>
        </div>
      )}

      {ngo && (
        <div className="food-meta" style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <div><span className="label">NGO:</span> {ngo.ngo_name || ngo.full_name}</div>
          {ngo.area && ngo.pincode && (
            <div><span className="label">Area / Pin:</span> {ngo.area} - {ngo.pincode}</div>
          )}
          <div><span className="label">NGO Address:</span> {ngo.address}</div>
          <div><span className="label">NGO Contact:</span> {ngo.contact}</div>
        </div>
      )}

      {agent && (
        <div className="food-meta" style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <div><span className="label">Delivery Agent:</span> {agent.full_name}</div>
          {agent.area && agent.pincode && (
            <div><span className="label">Agent Area / Pin:</span> {agent.area} - {agent.pincode}</div>
          )}
          <div><span className="label">Agent Contact:</span> {agent.contact} {agent.vehicle_type ? `(${agent.vehicle_type})` : ''}</div>
        </div>
      )}

      {/* ETA line for any in-transit post */}
      {post.estimated_minutes > 0 && post.status !== 'delivered' && (
        <div className="food-meta" style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <div>
            <span className="label">🕒 Est. Delivery:</span> ~{post.estimated_minutes} min
            {post.estimated_delivery_at && <> · by {formatDT(post.estimated_delivery_at)}</>}
          </div>
          {post.journey_started_at && (
            <div style={{fontSize:12, color:'#566573'}}>
              Journey started: {formatDT(post.journey_started_at)}
            </div>
          )}
        </div>
      )}

      {children && <div className="card-actions">{children}</div>}
    </div>
  );
}
