/*
  Restaurant Dashboard
  ---------------------
  Shows:
    1. Welcome banner with 4 quick stats (Total Posts, Available, Delivered/Donated, Unavailable)
    2. Notifications banner for unread messages (journey started, OTP generated, delivery success)
    3. Grid of FoodCard for every post that THIS restaurant created.
    4. Action buttons:
       - If status = Available → "Mark Unavailable"
       - If status = NGO_ACCEPTED / AGENT_ASSIGNED / JOURNEY_STARTED / PICKED_UP / OTP_PENDING → "Mark as Donated (handed over to agent)"
       - For JOURNEY_STARTED: show ETA
       - For OTP_PENDING: show the OTP (so Restaurant can verify independently if needed)
*/
import { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { FOOD_STATUS } from '../utils/constants';
import FoodCard from '../components/FoodCard';
import { Link } from 'react-router-dom';

export default function RestaurantDashboard() {
  const ctx = useAppContext();
  const currentUser = ctx?.currentUser || null;
  const users = Array.isArray(ctx?.users) ? ctx.users : [];
  const foodPosts = Array.isArray(ctx?.foodPosts) ? ctx.foodPosts : [];
  const notifications = Array.isArray(ctx?.notifications) ? ctx.notifications : [];
  const markUnavailable = ctx?.markUnavailable;
  const markDonated = ctx?.markDonated;
  const markNotificationRead = ctx?.markNotificationRead;
  const [filter, setFilter] = useState('all');

  const _users = users;
  const _foodPosts = foodPosts;
  const _notifs = notifications;

  const myPosts = (_foodPosts.filter((p) => p && p.restaurant_id === currentUser?.id)) || [];
  const unreadNotifs = (_notifs.filter((n) => n && !n.read)) || [];

  const total = myPosts.length;
  const available = myPosts.filter((p) => p.status === FOOD_STATUS.AVAILABLE).length;
  const delivered = myPosts.filter((p) => p.status === FOOD_STATUS.DELIVERED).length;
  const unavailable = myPosts.filter((p) => p.status === FOOD_STATUS.UNAVAILABLE).length;

  // ------ OTP lookup per post (Restaurant's own notification copy) ------
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

  const visible = (myPosts.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'available') return p.status === FOOD_STATUS.AVAILABLE;
    if (filter === 'active')
      return [
        FOOD_STATUS.NGO_ACCEPTED, FOOD_STATUS.AGENT_ASSIGNED,
        FOOD_STATUS.JOURNEY_STARTED, FOOD_STATUS.PICKED_UP, FOOD_STATUS.OTP_PENDING,
      ].includes(p.status);
    if (filter === 'done')
      return p.status === FOOD_STATUS.DELIVERED || p.status === FOOD_STATUS.UNAVAILABLE;
    return true;
  })) || [];

  return (
    <div>
      {/* -------- Notifications Banner -------- */}
      {unreadNotifs.length > 0 && (
        <div style={{
          background:'#fdecea', border:'1px solid #f5c6cb', borderRadius:12, padding:'12px 16px',
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
          <ul style={{margin:'10px 0 0 20px', padding:0, fontSize:14, color:'#7b241c'}}>
            {unreadNotifs.slice(0, 5).map((n) => (
              <li key={n.id} style={{marginBottom:4}}>
                <strong>{n.title}</strong> — {n.message.split('\n').join(' ')}
                <span style={{color:'#a93226', fontSize:12, marginLeft:6}}>
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </li>
            ))}
            {unreadNotifs.length > 5 && <li style={{color:'#a93226'}}>+{unreadNotifs.length - 5} more…</li>}
          </ul>
        </div>
      )}

      <div className="dashboard-header">
        <h2>Welcome, {currentUser?.restaurant_name || currentUser?.full_name} 🍴</h2>
        <div style={{ color: '#566573' }}>Post leftover food, track handover to agents and delivery to NGOs.
          When delivery is verified by OTP, both you and the NGO receive a confirmation.
        </div>

        <div className="stats-grid">
          <div className="stat-card"><div className="stat-value">{total}</div><div className="stat-label">Total Posts</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: 'var(--color-primary)' }}>{available}</div><div className="stat-label">Available</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: 'var(--status-delivered)' }}>{delivered}</div><div className="stat-label">Delivered / Donated</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: 'var(--status-unavailable)' }}>{unavailable}</div><div className="stat-label">Unavailable</div></div>
        </div>

        <div style={{ marginTop: 16 }}>
          <Link className="btn btn-restaurant" to="/post-food">+ Post New Food</Link>
        </div>
      </div>

      <div className="tabs">
        {([
          ['all', `All (${total})`],
          ['available', `Available (${available})`],
          ['active', 'NGO/Agent Active'],
          ['done', 'Completed'],
        ] || []).map((item, i) => {
          const [k, l] = Array.isArray(item) ? item : ['tab-' + i, ''];
          return (
            <button key={k} className={`tab-btn ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div style={{ padding: 24, background: 'white', borderRadius: 12, textAlign: 'center', color: '#566573' }}>
          No posts in this category yet. <Link to="/post-food">Create your first food post</Link>.
        </div>
      ) : (
        <div className="food-grid">
          {visible.map((post) => {
            const otp = otpByPostId[post.id];
            const agentUser = post.agent_id ? _users.find((u) => u.id === post.agent_id) : null;
            return (
              <FoodCard key={post.id} post={post}>
                {/* ETA banner for in-transit */}
                {post.status === FOOD_STATUS.JOURNEY_STARTED && post.estimated_minutes > 0 && (
                  <div style={{background:'#e8f4fd', borderLeft:'4px solid #3498db', padding:'6px 10px', borderRadius:6, marginBottom:8, fontSize:13, color:'#1f4e79'}}>
                    <strong>🕒 {agentUser?.full_name || 'Agent'} is on the way</strong><br/>
                    Est. delivery to NGO in ~{post.estimated_minutes} min
                    {post.estimated_delivery_at && <> · by {new Date(post.estimated_delivery_at).toLocaleString()}</>}
                  </div>
                )}

                {/* OTP banner (Restaurant sees their copy for verification) */}
                {(post.status === FOOD_STATUS.OTP_PENDING || otp) && (
                  <div style={{
                    background:'#fff3cd', border:'2px dashed #f39c12', padding:12,
                    borderRadius:10, marginBottom:8,
                  }}>
                    <div style={{fontSize:13, color:'#856404', marginBottom:6}}>
                      <strong>🔐 Delivery Verification OTP</strong> (for your records — you can call the NGO and ask for this code to confirm independently):
                    </div>
                    {otp ? (
                      <div style={{
                        fontSize:24, fontWeight:'bold', letterSpacing:6, color:'#b7950b',
                        textAlign:'center', background:'white', padding:8, borderRadius:8,
                        border:'1px solid #ffe08a',
                      }}>
                        {otp}
                      </div>
                    ) : (
                      <div style={{fontSize:13, color:'#856404'}}>
                        ⏳ Check the 🔔 notifications above for the OTP — it arrives when the agent reaches the NGO.
                      </div>
                    )}
                  </div>
                )}

                {post.status === FOOD_STATUS.AVAILABLE && (
                  <button className="btn btn-danger btn-sm" onClick={() => markUnavailable(post.id)}>Mark Unavailable</button>
                )}
                {[
                  FOOD_STATUS.NGO_ACCEPTED, FOOD_STATUS.AGENT_ASSIGNED,
                  FOOD_STATUS.JOURNEY_STARTED, FOOD_STATUS.PICKED_UP, FOOD_STATUS.OTP_PENDING,
                ].includes(post.status) && (
                  <button className="btn btn-ngo btn-sm" onClick={() => markDonated(post.id)}>Mark as Donated (Handed Over)</button>
                )}

                {post.status === FOOD_STATUS.DELIVERED && post.otp_verified_at && (
                  <div style={{fontSize:12, color:'#27ae60'}}>
                    ✅ Delivered & OTP verified on {new Date(post.otp_verified_at).toLocaleString()}
                  </div>
                )}
              </FoodCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
