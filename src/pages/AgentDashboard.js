/*
  Delivery Agent Dashboard
  -------------------------
  4-stage delivery flow per post now:
    1) Agent Assigned     -> Start Journey (button) + ETA shown
    2) Journey Started    -> Confirm Pickup (at Restaurant)
    3) Picked Up          -> Reached NGO → Generate OTP (sent to NGO + Restaurant)
    4) OTP Pending        -> Agent enters 6-digit OTP (shared verbally by NGO)
                             If valid → Delivery successful, notifies all parties

  Tabs:
    1) Available Pickups   - NGO Accepted + unassigned (nearest first, pincode-matched)
    2) My Active Deliveries - in-progress (agent-assigned / journey-started / picked-up / otp-pending)
    3) Completed           - delivered
  Also shows a notification banner for unread journey / OTP / success messages.
*/
import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { FOOD_STATUS, PINCODE_PREFIX_MATCH } from '../utils/constants';
import { haversineDistance, pincodesNearby } from '../utils/distance';
import FoodCard from '../components/FoodCard';

export default function AgentDashboard() {
  const ctx = useAppContext();
  const currentUser = ctx?.currentUser || null;
  const users = Array.isArray(ctx?.users) ? ctx.users : [];
  const foodPosts = Array.isArray(ctx?.foodPosts) ? ctx.foodPosts : [];
  const agentAssignments = Array.isArray(ctx?.agentAssignments) ? ctx.agentAssignments : [];
  const notifications = Array.isArray(ctx?.notifications) ? ctx.notifications : [];
  const acceptByAgent = ctx?.acceptByAgent;
  const startJourney = ctx?.startJourney;
  const confirmPickup = ctx?.confirmPickup;
  const generateDeliveryOTP = ctx?.generateDeliveryOTP;
  const verifyDeliveryOTP = ctx?.verifyDeliveryOTP;
  const markNotificationRead = ctx?.markNotificationRead;
  const [tab, setTab] = useState('available');
  const [working, setWorking] = useState(null);
  const [otpInputs, setOtpInputs] = useState({}); // { [postId]: '123456' }
  const [otpErrors, setOtpErrors] = useState({}); // { [postId]: 'msg' }
  const [successMsg, setSuccessMsg] = useState(null); // { postId, title, msg }

  const _users = users;
  const _foodPosts = foodPosts;
  const _agentAssignments = agentAssignments;
  const _notifs = notifications;

  const postHasAgent = (postId) => _agentAssignments.some((a) => a && a.post_id === postId);
  const myAssignmentPostIds = new Set();
  (_agentAssignments.filter((a) => a && a.agent_id === currentUser?.id) || [])
    .forEach((a) => { if (a?.post_id != null) myAssignmentPostIds.add(a.post_id); });

  const restById = (id) => _users.find((u) => u.id === id) || null;
  const ngoById = (id) => _users.find((u) => u.id === id) || null;

  // -------- Unread notifications banner (top of page) --------
  const unreadNotifs = (_notifs.filter((n) => n && !n.read)) || [];

  // ---- Tab 1: Available pickups (NGO accepted, no agent, pincode-match + nearest) ----
  const available = _foodPosts
    .filter((p) => p && p.status === FOOD_STATUS.NGO_ACCEPTED && !postHasAgent(p.id))
    .map((p) => {
      const rest = restById(p.restaurant_id);
      const ngo = ngoById(p.ngo_id);
      const pinMatchAgent = pincodesNearby(currentUser?.pincode, rest?.pincode, PINCODE_PREFIX_MATCH);
      const pinMatchAgentNgo = pincodesNearby(currentUser?.pincode, ngo?.pincode, PINCODE_PREFIX_MATCH);
      return {
        post: p,
        rest,
        ngo,
        pincode_ok: pinMatchAgent && pinMatchAgentNgo,
        dist_rest: haversineDistance(
          currentUser?.latitude, currentUser?.longitude,
          p.restaurant_lat, p.restaurant_lng
        ),
        dist_total: haversineDistance(
          p.restaurant_lat, p.restaurant_lng,
          p.ngo_lat, p.ngo_lng
        ),
      };
    })
    .sort((a, b) => {
      if (a.pincode_ok !== b.pincode_ok) return a.pincode_ok ? -1 : 1;
      return (a.dist_rest ?? 1e9) - (b.dist_rest ?? 1e9);
    });

  // ---- Tab 2: My Active (anything not delivered) ----
  const myActive = _foodPosts.filter(
    (p) =>
      p &&
      myAssignmentPostIds.has(p.id) &&
      [
        FOOD_STATUS.AGENT_ASSIGNED,
        FOOD_STATUS.JOURNEY_STARTED,
        FOOD_STATUS.PICKED_UP,
        FOOD_STATUS.OTP_PENDING,
      ].includes(p.status)
  );

  // ---- Tab 3: Completed ----
  const myDone = _foodPosts.filter(
    (p) => p && myAssignmentPostIds.has(p.id) && p.status === FOOD_STATUS.DELIVERED
  );

  return (
    <div>
      {/* -------- Notifications Banner -------- */}
      {unreadNotifs.length > 0 && (
        <div style={{
          background:'#fff8e1', border:'1px solid #ffdf7e', borderRadius:12, padding:'12px 16px',
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
          <ul style={{margin:'10px 0 0 20px', padding:0, fontSize:14, color:'#5d4037'}}>
            {unreadNotifs.slice(0, 4).map((n) => (
              <li key={n.id} style={{marginBottom:4}}>
                <strong>{n.title}</strong> — {n.message.split('\n').join(' ')}
                <span style={{color:'#8d6e63', fontSize:12, marginLeft:6}}>
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </li>
            ))}
            {unreadNotifs.length > 4 && <li style={{color:'#8d6e63'}}>+{unreadNotifs.length - 4} more…</li>}
          </ul>
        </div>
      )}

      {/* -------- Success flash (after OTP verifies) -------- */}
      {successMsg && (
        <div style={{background:'#e8f8f0', border:'1px solid #27ae60', borderRadius:12, padding:12, marginBottom:16}}>
          <strong>{successMsg.title}</strong>
          <div>{successMsg.msg}</div>
        </div>
      )}

      <div className="dashboard-header">
        <h2>Welcome, {currentUser?.full_name} 🛵</h2>
        <div style={{ color: '#566573' }}>
          Accept pickup requests (nearest first), <strong>Start Journey</strong> to see ETA, confirm pickup at restaurant, generate OTP when you reach the NGO, then enter the 6-digit code shared by the NGO to confirm delivery.
        </div>
        <div className="stats-grid" style={{ marginTop: 14 }}>
          <div className="stat-card"><div className="stat-value">{available.length}</div><div className="stat-label">Open Pickups Nearby</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: 'var(--color-agent)' }}>{myActive.length}</div><div className="stat-label">Active Deliveries</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: 'var(--color-primary)' }}>{myDone.length}</div><div className="stat-label">Completed</div></div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'available' ? 'active' : ''}`} onClick={() => setTab('available')}>
          📦 Available Pickups ({available.length})
        </button>
        <button className={`tab-btn ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
          🚚 My Active ({myActive.length})
        </button>
        <button className={`tab-btn ${tab === 'done' ? 'active' : ''}`} onClick={() => setTab('done')}>
          ✅ Completed ({myDone.length})
        </button>
      </div>

      {tab === 'available' && (
        available.length === 0 ? (
          <div style={{ padding: 24, background: 'white', borderRadius: 12, textAlign: 'center', color: '#566573' }}>
            No NGO-accepted pickup requests right now. Please check again later.
          </div>
        ) : (
          <div className="food-grid">
            {available.map(({ post, dist_rest, dist_total, pincode_ok, rest, ngo }) => {
              return (
                <FoodCard key={post.id} post={post} distanceKm={dist_rest}>
                  {!pincode_ok && (
                    <div style={{
                      background:'#fff3cd', color:'#856404', padding:'6px 8px',
                      borderRadius:8, fontSize:12, marginBottom:8, border:'1px solid #ffe08a',
                    }}>
                      ⚠️ Out of your city/zone: Restaurant ({rest?.pincode ?? '?'}) / NGO ({ngo?.pincode ?? '?'}) vs yours ({currentUser?.pincode ?? '?'})
                    </div>
                  )}

                  {/* RESTAURANT LOCATION — agent needs to know WHERE to go PICK UP the food */}
                  <div style={{
                    background:'#fef9e7', borderLeft:'4px solid #f1c40f',
                    padding:'8px 10px', borderRadius:6, marginBottom:8, fontSize:13, color:'#7d6608',
                  }}>
                    <div style={{fontWeight:600, marginBottom:4}}>🏬 PICKUP — Restaurant:</div>
                    <div><strong>{rest?.restaurant_name || rest?.full_name || 'Restaurant'}</strong></div>
                    <div>
                      📍 {rest?.street || ''}{rest?.area ? `, ${rest.area}` : ''}{rest?.landmark ? ` (${rest.landmark})` : ''}
                      {rest?.pincode ? ` - ${rest.pincode}` : ''}
                    </div>
                    <div>📞 {rest?.contact || '—'} · From you: <strong>~{dist_rest ?? '?'} km</strong></div>
                  </div>

                  {/* NGO LOCATION — drop-off destination, shown so agent knows full route */}
                  <div style={{
                    background:'#e8f8f5', borderLeft:'4px solid #27ae60',
                    padding:'8px 10px', borderRadius:6, marginBottom:8, fontSize:13, color:'#1e5b37',
                  }}>
                    <div style={{fontWeight:600, marginBottom:4}}>🏠 DROP-OFF — NGO:</div>
                    <div><strong>{ngo?.ngo_name || ngo?.full_name || 'NGO'}</strong></div>
                    <div>
                      📍 {ngo?.street || ''}{ngo?.area ? `, ${ngo.area}` : ''}{ngo?.landmark ? ` (${ngo.landmark})` : ''}
                      {ngo?.pincode ? ` - ${ngo.pincode}` : ''}
                    </div>
                    <div>📞 {ngo?.contact || '—'} · 🏬→🏠: <strong>~{dist_total ?? '?'} km</strong></div>
                  </div>

                  <button
                    className="btn btn-agent btn-sm"
                    disabled={working === post.id}
                    onClick={async () => {
                      setWorking(post.id);
                      try { await acceptByAgent(post.id, currentUser.id); }
                      finally { setWorking(null); }
                    }}
                  >
                    {working === post.id ? '…' : '✅ Accept this Pickup'}
                  </button>
                </FoodCard>
              );
            })}
          </div>
        )
      )}

      {tab === 'active' && (
        myActive.length === 0 ? (
          <div style={{ padding: 24, background: 'white', borderRadius: 12, textAlign: 'center', color: '#566573' }}>
            No active deliveries. Accept a pickup from the Available tab.
          </div>
        ) : (
          <div className="food-grid">
            {myActive.map((post) => {
              const rest = restById(post.restaurant_id);
              const ngo = ngoById(post.ngo_id);
              const distAR = haversineDistance(currentUser?.latitude, currentUser?.longitude, post.restaurant_lat, post.restaurant_lng);
              const distRN = haversineDistance(post.restaurant_lat, post.restaurant_lng, post.ngo_lat, post.ngo_lng);

              return (
                <FoodCard key={post.id} post={post}>
                  {/* -------- Stage 1: AGENT_ASSIGNED -> Start Journey -------- */}
                  {post.status === FOOD_STATUS.AGENT_ASSIGNED && (
                    <>
                      {/* ALWAYS show restaurant address — WHERE to go first! */}
                      <div style={{
                        background:'#fef9e7', borderLeft:'4px solid #f1c40f',
                        padding:'8px 10px', borderRadius:6, marginBottom:8, fontSize:13, color:'#7d6608',
                      }}>
                        <div style={{fontWeight:600, marginBottom:4}}>🏬 GO HERE FIRST — PICKUP FROM RESTAURANT:</div>
                        <div><strong>{rest?.restaurant_name || rest?.full_name || 'Restaurant'}</strong></div>
                        <div>
                          📍 {rest?.street || ''}{rest?.area ? `, ${rest.area}` : ''}{rest?.landmark ? ` (Landmark: ${rest.landmark})` : ''}
                          {rest?.pincode ? ` - ${rest.pincode}` : ''}
                        </div>
                        <div>📞 Call restaurant: <strong>{rest?.contact || '—'}</strong></div>
                        <div style={{marginTop:4, color:'#6e510b'}}>From your current location: ~{distAR ?? '?'} km</div>
                      </div>

                      <div style={{
                        background:'#e8f8f5', borderLeft:'4px solid #27ae60',
                        padding:'8px 10px', borderRadius:6, marginBottom:12, fontSize:13, color:'#1e5b37',
                      }}>
                        <div style={{fontWeight:600, marginBottom:4}}>🏠 THEN DROP-OFF TO NGO (AFTER PICKUP):</div>
                        <div><strong>{ngo?.ngo_name || ngo?.full_name || 'NGO'}</strong></div>
                        <div>
                          📍 {ngo?.street || ''}{ngo?.area ? `, ${ngo.area}` : ''}{ngo?.landmark ? ` (Landmark: ${ngo.landmark})` : ''}
                          {ngo?.pincode ? ` - ${ngo.pincode}` : ''}
                        </div>
                        <div>📞 Call NGO: <strong>{ngo?.contact || '—'}</strong> · 🏬→🏠 ~{distRN ?? '?'} km</div>
                      </div>

                      <div style={{fontSize:12, color:'#34495e', marginBottom:8, padding:8, background:'#eaf2f8', borderRadius:6}}>
                        💡 When you are ready to leave for the restaurant, click <strong>Start Journey</strong> below. You will then be asked to confirm pickup once you reach the restaurant.
                      </div>

                      <button
                        className="btn btn-primary btn-sm"
                        disabled={working === post.id}
                        onClick={async () => {
                          setWorking(post.id);
                          try {
                            const res = await startJourney(post.id, {
                              agent_id: currentUser.id,
                              dist_agent_rest_km: distAR,
                              dist_rest_ngo_km: distRN,
                              vehicle_type: currentUser?.vehicle_type,
                            });
                            setSuccessMsg({
                              title: '🛵 Journey Started!',
                              msg: `ETA: ~${res?.estimated_minutes || '?'} minutes · Expected around ${res?.estimated_delivery_at ? new Date(res.estimated_delivery_at).toLocaleTimeString() : '—'}. Restaurant and NGO have been notified.`,
                            });
                            setTimeout(() => setSuccessMsg(null), 5000);
                          } finally { setWorking(null); }
                        }}
                      >
                        {working === post.id ? '…' : '🚀 Start Journey to Restaurant'}
                      </button>
                    </>
                  )}

                  {/* -------- Stage 2: JOURNEY_STARTED -> Confirm Pickup -------- */}
                  {post.status === FOOD_STATUS.JOURNEY_STARTED && (
                    <>
                      <div style={{
                        background:'#e8f4fd', borderLeft:'4px solid #3498db', padding:'8px 10px',
                        borderRadius:6, marginBottom:8, fontSize:13, color:'#1f4e79',
                      }}>
                        <div style={{fontWeight:600}}>🛵 Journey in progress</div>
                        <div><strong>🕒 Total ETA:</strong> {post.estimated_minutes} minutes</div>
                        {post.estimated_delivery_at && (
                          <div>Expected delivery by: <strong>{new Date(post.estimated_delivery_at).toLocaleString()}</strong></div>
                        )}
                        {post.journey_started_at && (
                          <div style={{fontSize:12, color:'#566573', marginTop:4}}>
                            Journey started: {new Date(post.journey_started_at).toLocaleTimeString()}
                          </div>
                        )}
                      </div>

                      {/* Restaurant pickup info still visible so agent can find it */}
                      <div style={{
                        background:'#fef9e7', borderLeft:'4px solid #f1c40f',
                        padding:'8px 10px', borderRadius:6, marginBottom:8, fontSize:13, color:'#7d6608',
                      }}>
                        <div style={{fontWeight:600, marginBottom:4}}>🏬 PICKUP LOCATION — RESTAURANT:</div>
                        <div><strong>{rest?.restaurant_name || rest?.full_name || 'Restaurant'}</strong></div>
                        <div>
                          📍 {rest?.street || ''}{rest?.area ? `, ${rest.area}` : ''}{rest?.landmark ? ` (Landmark: ${rest.landmark})` : ''}
                          {rest?.pincode ? ` - ${rest.pincode}` : ''}
                        </div>
                        <div>📞 {rest?.contact || '—'}</div>
                      </div>

                      <div style={{fontSize:12, color:'#34495e', marginBottom:8, padding:8, background:'#fdebd0', borderRadius:6}}>
                        💡 Once you reach the restaurant and load the food, click <strong>Confirm Pickup</strong> below.
                      </div>

                      <button
                        className="btn btn-warning btn-sm"
                        disabled={working === post.id}
                        onClick={async () => { setWorking(post.id); try { await confirmPickup(post.id); } finally { setWorking(null); } }}
                      >
                        {working === post.id ? '…' : '✅ Confirm Pickup (Food Loaded)'}
                      </button>
                    </>
                  )}

                  {/* -------- Stage 3: PICKED_UP -> Reached NGO / Generate OTP -------- */}
                  {post.status === FOOD_STATUS.PICKED_UP && (
                    <>
                      <div style={{
                        background:'#fef5e7', borderLeft:'4px solid #f39c12', padding:'8px 10px',
                        borderRadius:6, marginBottom:8, fontSize:13, color:'#7d6608',
                      }}>
                        Food is picked up. Drive carefully to the NGO:
                        <div style={{marginTop:4}}>
                          <strong>{ngo?.ngo_name || ngo?.full_name || 'NGO'}</strong><br/>
                          📍 {ngo?.street || ''}{ngo?.area ? `, ${ngo.area}` : ''}{ngo?.landmark ? ` (${ngo.landmark})` : ''}{ngo?.pincode ? ` - ${ngo.pincode}` : ''}<br/>
                          📞 {ngo?.contact || '—'} · 🏬 → 🏠 ~{distRN ?? '?'} km
                        </div>
                      </div>
                      <button
                        className="btn btn-ngo btn-sm"
                        disabled={working === post.id}
                        onClick={async () => {
                          setWorking(post.id);
                          try {
                            await generateDeliveryOTP(post.id);
                            setSuccessMsg({
                              title: '🔐 OTP Sent to NGO & Restaurant',
                              msg: `OTP has been generated and sent via notifications. Please ask the NGO to share the 6-digit code with you, then enter it below.`,
                            });
                            setTimeout(() => setSuccessMsg(null), 6000);
                          } catch (e) {
                            setOtpErrors((prev) => ({ ...prev, [post.id]: e.message }));
                          } finally { setWorking(null); }
                        }}
                      >
                        {working === post.id ? '…' : '📍 Reached NGO - Generate OTP'}
                      </button>
                    </>
                  )}

                  {/* -------- Stage 4: OTP_PENDING -> Enter & Verify -------- */}
                  {post.status === FOOD_STATUS.OTP_PENDING && (
                    <>
                      <div style={{
                        background:'#eafaf1', borderLeft:'4px solid #27ae60', padding:'8px 10px',
                        borderRadius:6, marginBottom:8, fontSize:13, color:'#1e5b37',
                      }}>
                        <strong>🔐 OTP Verification</strong><br/>
                        Ask the NGO to read the 6-digit OTP from their notifications panel, then enter it here to finalize delivery.
                        <div style={{fontSize:12, color:'#566573', marginTop:4}}>
                          {post.otp_generated_at && <>OTP generated: {new Date(post.otp_generated_at).toLocaleTimeString()}</>}
                        </div>
                      </div>
                      <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap'}}>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Enter 6-digit OTP"
                          value={otpInputs[post.id] || ''}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setOtpInputs((p) => ({ ...p, [post.id]: v }));
                            if (otpErrors[post.id]) setOtpErrors((p) => { const n = {...p}; delete n[post.id]; return n; });
                          }}
                          style={{
                            padding:'8px 10px', border:'1px solid #bdc3c7', borderRadius:8,
                            fontSize:16, letterSpacing:4, width:180, fontWeight:'bold', textAlign:'center',
                          }}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={working === post.id || (otpInputs[post.id] || '').length !== 6}
                          onClick={async () => {
                            setWorking(post.id);
                            setOtpErrors((p) => { const n = {...p}; delete n[post.id]; return n; });
                            try {
                              await verifyDeliveryOTP(post.id, otpInputs[post.id]);
                              setSuccessMsg({
                                title: '✅ Delivery Successful!',
                                msg: `OTP verified. Delivery #${post.id.slice(0,8)} marked complete. Success notifications sent to Restaurant and NGO. Thank you! 👏`,
                              });
                              setOtpInputs((p) => { const n = {...p}; delete n[post.id]; return n; });
                              setTimeout(() => setSuccessMsg(null), 8000);
                            } catch (e) {
                              setOtpErrors((p) => ({ ...p, [post.id]: e.message }));
                            } finally { setWorking(null); }
                          }}
                        >
                          {working === post.id ? '…' : '✅ Verify OTP & Complete'}
                        </button>
                      </div>
                      {otpErrors[post.id] && (
                        <div style={{color:'#c0392b', fontSize:13, background:'#fdecea', padding:8, borderRadius:6}}>
                          ❌ {otpErrors[post.id]}
                        </div>
                      )}
                    </>
                  )}
                </FoodCard>
              );
            })}
          </div>
        )
      )}

      {tab === 'done' && (
        myDone.length === 0 ? (
          <div style={{ padding: 24, background: 'white', borderRadius: 12, textAlign: 'center', color: '#566573' }}>
            No completed deliveries yet.
          </div>
        ) : (
          <div className="food-grid">
            {myDone.map((p) => (
              <FoodCard key={p.id} post={p}>
                {p.otp_verified_at && (
                  <div style={{fontSize:12, color:'#27ae60'}}>
                    ✅ OTP verified at {new Date(p.otp_verified_at).toLocaleString()}
                  </div>
                )}
              </FoodCard>
            ))}
          </div>
        )
      )}
    </div>
  );
}
