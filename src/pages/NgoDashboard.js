/*
  NGO Dashboard
  --------------
  Two tabs:
    A) Nearby Available Food
       - Shows food posts where:
           status = available
           AND distance(restaurant, this NGO) <= NEARBY_RADIUS_KM
           AND NGO has NOT already rejected this post
           AND pincode matches (same city/zone — cross-city like Delhi↔Mumbai filtered OUT)
       - Distance calculated via Haversine on the fly
       - Each card has ACCEPT and REJECT buttons
    B) My Accepted Donations
       - Food posts where ngo_id = this NGO's id
       - Shows live status (NGO Accepted -> Agent Assigned -> Journey Started -> Picked Up -> OTP Pending -> Delivered)
       - For OTP_PENDING: shows the 6-digit OTP (extracted from notifications) so NGO can share with agent
  + Notifications banner at top (unread journey / OTP / success messages).
*/
import { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { FOOD_STATUS, NEARBY_RADIUS_KM, PINCODE_PREFIX_MATCH } from '../utils/constants';
import { haversineDistance, pincodesNearby } from '../utils/distance';
import FoodCard from '../components/FoodCard';

export default function NgoDashboard() {
  const ctx = useAppContext();
  const currentUser = ctx?.currentUser || null;
  const users = Array.isArray(ctx?.users) ? ctx.users : [];
  const foodPosts = Array.isArray(ctx?.foodPosts) ? ctx.foodPosts : [];
  const ngoResponses = Array.isArray(ctx?.ngoResponses) ? ctx.ngoResponses : [];
  const notifications = Array.isArray(ctx?.notifications) ? ctx.notifications : [];
  const acceptByNgo = ctx?.acceptByNgo;
  const rejectByNgo = ctx?.rejectByNgo;
  const loading = !!ctx?.loading;
  const markNotificationRead = ctx?.markNotificationRead;
  const [tab, setTab] = useState('nearby');
  const [working, setWorking] = useState(null);

  const _users = users;
  const _foodPosts = foodPosts;
  const _ngoResponses = ngoResponses;
  const _notifs = notifications;

  const restById = (id) => _users.find((u) => u.id === id) || null;
  const unreadNotifs = (_notifs.filter((n) => n && !n.read)) || [];

  const myRejectedIds = new Set();
  (_ngoResponses.filter((r) => r && r.ngo_id === currentUser?.id && r.response === 'rejected') || [])
    .forEach((r) => { if (r?.post_id != null) myRejectedIds.add(r.post_id); });

  const myAcceptedIds = new Set();
  (_ngoResponses.filter((r) => r && r.ngo_id === currentUser?.id && r.response === 'accepted') || [])
    .forEach((r) => { if (r?.post_id != null) myAcceptedIds.add(r.post_id); });

  // -------- Lookup the OTP for a post from the NGO's own notifications --------
  // We never leak OTP in the food_post row back to non-agent APIs, so the NGO
  // retrieves it from the "otp" type notification the server sent them.
  const otpByPostId = useMemo(() => {
    const map = {};
    (_notifs || []).forEach((n) => {
      if (n && n.type === 'otp' && n.user_id === currentUser?.id && n.post_id && n.message) {
        const m = n.message.match(/\*\*\s*(\d{6})\s*\*\*/);
        if (m) map[n.post_id] = m[1];
      }
    });
    return map;
  }, [_notifs, currentUser?.id]);

  // ---- Tab A: Nearby available food (pincode + haversine double filter) ----
  const _available = (_foodPosts.filter((p) => p && p.status === FOOD_STATUS.AVAILABLE)) || [];
  const withDistance = (_available
    .map((p) => {
      const rest = restById(p.restaurant_id);
      return {
        post: p,
        rest,
        dist: haversineDistance(
          currentUser?.latitude, currentUser?.longitude,
          p.restaurant_lat, p.restaurant_lng
        ),
        pincode_ok: pincodesNearby(currentUser?.pincode, rest?.pincode, PINCODE_PREFIX_MATCH),
      };
    })
    .filter((x) => x.pincode_ok)
    .filter((x) => x.dist != null && x.dist <= NEARBY_RADIUS_KM)
    .filter((x) => !myRejectedIds.has(x.post.id))
    .filter((x) => !myAcceptedIds.has(x.post.id))
    .sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9))) || [];

  const myAcceptedPosts = (_foodPosts.filter((p) => p && p.ngo_id === currentUser?.id)) || [];

  const doAccept = async (post) => {
    setWorking(post.id);
    try { await acceptByNgo(post.id, currentUser); } finally { setWorking(null); }
  };
  const doReject = async (post) => {
    setWorking(post.id);
    try { await rejectByNgo(post.id, currentUser.id); } finally { setWorking(null); }
  };

  return (
    <div>
      {/* -------- Notifications Banner -------- */}
      {unreadNotifs.length > 0 && (
        <div style={{
          background:'#e8f8f0', border:'1px solid #abebc6', borderRadius:12, padding:'12px 16px',
          marginBottom:16, boxShadow:'0 2px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap'}}>
            <div>
              <strong>🔔 You have {unreadNotifs.length} new notification{unreadNotifs.length>1?'s':''}</strong>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => markNotificationRead(currentUser.id)}>
              Mark all as read
            </button>
          </div>
          <ul style={{margin:'10px 0 0 20px', padding:0, fontSize:14, color:'#1e5b37'}}>
            {unreadNotifs.slice(0, 5).map((n) => (
              <li key={n.id} style={{marginBottom:4}}>
                <strong>{n.title}</strong> — {n.message.split('\n').join(' ')}
                <span style={{color:'#27ae60', fontSize:12, marginLeft:6}}>
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </li>
            ))}
            {unreadNotifs.length > 5 && <li style={{color:'#1e5b37'}}>+{unreadNotifs.length - 5} more…</li>}
          </ul>
        </div>
      )}

      <div className="dashboard-header">
        <h2>Welcome, {currentUser?.ngo_name || currentUser?.full_name} 🏠</h2>
        <div style={{ color: '#566573' }}>
          Accept or reject nearby food donations, and track delivery status.
          Only restaurants in your city/zone (pincode prefix <strong>{currentUser?.pincode ? String(currentUser.pincode).slice(0, PINCODE_PREFIX_MATCH) + 'xxx' : 'matched'}</strong>) are shown.
          Radius: {NEARBY_RADIUS_KM} km.
        </div>
        <div className="stats-grid" style={{ marginTop: 14 }}>
          <div className="stat-card"><div className="stat-value">{withDistance.length}</div><div className="stat-label">Nearby Available</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: 'var(--color-primary)' }}>{(myAcceptedPosts.filter(p => p && p.status === FOOD_STATUS.DELIVERED) || []).length}</div><div className="stat-label">Received (Delivered)</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: 'var(--status-picked-up)' }}>{(myAcceptedPosts.filter(p => p && [FOOD_STATUS.NGO_ACCEPTED, FOOD_STATUS.AGENT_ASSIGNED, FOOD_STATUS.JOURNEY_STARTED, FOOD_STATUS.PICKED_UP, FOOD_STATUS.OTP_PENDING].includes(p.status)) || []).length}</div><div className="stat-label">In Transit</div></div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'nearby' ? 'active' : ''}`} onClick={() => setTab('nearby')}>
          🔔 Nearby Available Food ({withDistance.length})
        </button>
        <button className={`tab-btn ${tab === 'accepted' ? 'active' : ''}`} onClick={() => setTab('accepted')}>
          ✅ My Accepted Donations ({myAcceptedPosts.length})
        </button>
      </div>

      {tab === 'nearby' && (
        <>
          {loading ? <em>Loading…</em> : null}
          {withDistance.length === 0 ? (
            <div style={{ padding: 24, background: 'white', borderRadius: 12, textAlign: 'center', color: '#566573' }}>
              No nearby food donations right now (same city, within {NEARBY_RADIUS_KM} km). Please check again later.
            </div>
          ) : (
            <div className="food-grid">
              {withDistance.map(({ post, dist }) => (
                <FoodCard key={post.id} post={post} distanceKm={dist}>
                  <button className="btn btn-ngo btn-sm" disabled={working === post.id} onClick={() => doAccept(post)}>
                    {working === post.id ? '…' : 'Yes, Accept'}
                  </button>
                  <button className="btn btn-outline btn-sm" disabled={working === post.id} onClick={() => doReject(post)}>
                    No, Reject
                  </button>
                </FoodCard>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'accepted' && (
        myAcceptedPosts.length === 0 ? (
          <div style={{ padding: 24, background: 'white', borderRadius: 12, textAlign: 'center', color: '#566573' }}>
            You haven't accepted any donations yet. Accept food from the Nearby tab.
          </div>
        ) : (
          <div className="food-grid">
            {myAcceptedPosts.map((p) => {
              const otp = otpByPostId[p.id];
              return (
                <FoodCard key={p.id} post={p}>
                  {/* ETA for in-transit */}
                  {p.status === FOOD_STATUS.JOURNEY_STARTED && p.estimated_minutes > 0 && (
                    <div style={{background:'#e8f4fd', borderLeft:'4px solid #3498db', padding:'6px 10px', borderRadius:6, marginBottom:8, fontSize:13, color:'#1f4e79'}}>
                      <strong>🕒 Agent on the way</strong> · Est. arrival in ~{p.estimated_minutes} min
                      {p.estimated_delivery_at && <> · by {new Date(p.estimated_delivery_at).toLocaleTimeString()}</>}
                    </div>
                  )}

                  {/* OTP display when agent has reached NGO and generated OTP */}
                  {(p.status === FOOD_STATUS.OTP_PENDING || otp) && (
                    <div style={{
                      background:'#fff3cd', border:'2px dashed #f39c12', padding:12,
                      borderRadius:10, marginBottom:8,
                    }}>
                      <div style={{fontSize:13, color:'#856404', marginBottom:6}}>
                        <strong>🔐 Delivery Agent is here — share this OTP to confirm receipt:</strong>
                      </div>
                      {otp ? (
                        <div style={{
                          fontSize:28, fontWeight:'bold', letterSpacing:8, color:'#b7950b',
                          textAlign:'center', background:'white', padding:8, borderRadius:8,
                          border:'1px solid #ffe08a',
                        }}>
                          {otp}
                        </div>
                      ) : (
                        <div style={{fontSize:13, color:'#856404'}}>
                          ⏳ OTP being generated… Refresh notifications panel in a moment, or check the 🔔 notifications above.
                        </div>
                      )}
                      <div style={{fontSize:12, color:'#8d6e63', marginTop:6}}>
                        Read this 6-digit code aloud to the delivery agent. The agent will enter it on their device to confirm successful delivery. You and the restaurant will both receive a success message.
                      </div>
                    </div>
                  )}

                  {p.status === FOOD_STATUS.DELIVERED && p.otp_verified_at && (
                    <div style={{fontSize:12, color:'#27ae60'}}>
                      ✅ OTP verified & delivery received at {new Date(p.otp_verified_at).toLocaleString()}
                    </div>
                  )}
                </FoodCard>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
