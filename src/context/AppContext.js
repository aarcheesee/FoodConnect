/*
  FoodConnect - AppContext (Global State)
  ----------------------------------------
  Why we use Context:
    - We want ALL pages to see the same users list, food posts list, and logged-in user.
    - We could pass props through every component ("prop drilling") but Context is cleaner.
    - When any function (e.g. acceptByNgo) changes state, ALL components using useAppContext
      automatically re-render with the new data.

  What's stored here:
    - currentUser: the currently logged-in user (or null), also persisted in localStorage
    - users: all registered users
    - foodPosts: all food donations from restaurants
    - agentAssignments: records of which agent accepted which post
    - ngoResponses: records of which NGO accepted/rejected which post

  How data is persisted:
    - Backend SQLite stores the truth (via server.js API)
    - We cache everything in Context state so the UI is fast
    - On app startup, we fetch everything from /api/... endpoints and hydrate state
*/

import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE, FOOD_STATUS } from '../utils/constants';
import { hasValidCoords, coordsForPincode } from '../utils/distance';

const AppContext = createContext(null);

const LS_CURRENT_USER = 'fc_current_user';

// Small helper: fetch JSON with error handling
async function fetchJson(url, options) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || ('Request failed: ' + res.status));
  return body;
}

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [foodPosts, setFoodPosts] = useState([]);
  const [agentAssignments, setAgentAssignments] = useState([]);
  const [ngoResponses, setNgoResponses] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    const raw = localStorage.getItem(LS_CURRENT_USER);
    let savedUser = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Only accept as valid if it has the shape of a real user: must have id + role + full_name.
        // This cleans up any broken / undefined entries written by bugs earlier.
        if (parsed && parsed.id && parsed.role && parsed.full_name) {
          savedUser = parsed;
          setCurrentUser(parsed);
        } else {
          localStorage.removeItem(LS_CURRENT_USER);
        }
      } catch {
        localStorage.removeItem(LS_CURRENT_USER);
      }
    }
    const [u, p, a, n] = await Promise.all([
      fetchJson(API_BASE + '/users'),
      fetchJson(API_BASE + '/food-posts'),
      fetchJson(API_BASE + '/agent-assignments'),
      fetchJson(API_BASE + '/ngo-responses'),
    ]);

    const usersArr = Array.isArray(u) ? u : [];
    const postsArr = Array.isArray(p) ? p : [];

    function patchUserCoords(user) {
      if (!user) return user;
      if (!hasValidCoords(user.latitude, user.longitude)) {
        const pc = coordsForPincode(user.pincode);
        if (pc) {
          return { ...user, latitude: pc.latitude, longitude: pc.longitude };
        }
      }
      return user;
    }

    const patchedUsers = usersArr.map(patchUserCoords);
    const userById = new Map(patchedUsers.filter((x) => x && x.id).map((x) => [x.id, x]));

    const patchedPosts = postsArr.map((post) => {
      if (!post) return post;
      let np = post;
      if (!hasValidCoords(np.restaurant_lat, np.restaurant_lng)) {
        const rest = userById.get(np.restaurant_id);
        if (rest && hasValidCoords(rest.latitude, rest.longitude)) {
          np = { ...np, restaurant_lat: rest.latitude, restaurant_lng: rest.longitude };
        } else if (np.restaurant_lat == null || np.restaurant_lng == null || (np.restaurant_lat === 0 && np.restaurant_lng === 0)) {
          const restUser = usersArr.find((x) => x && x.id === np.restaurant_id);
          const pc = coordsForPincode(restUser?.pincode);
          if (pc) np = { ...np, restaurant_lat: pc.latitude, restaurant_lng: pc.longitude };
        }
      }
      if (np.ngo_id && !hasValidCoords(np.ngo_lat, np.ngo_lng)) {
        const ngo = userById.get(np.ngo_id);
        if (ngo && hasValidCoords(ngo.latitude, ngo.longitude)) {
          np = { ...np, ngo_lat: ngo.latitude, ngo_lng: ngo.longitude };
        } else if (np.ngo_lat == null || np.ngo_lng == null || (np.ngo_lat === 0 && np.ngo_lng === 0)) {
          const ngoUser = usersArr.find((x) => x && x.id === np.ngo_id);
          const pc = coordsForPincode(ngoUser?.pincode);
          if (pc) np = { ...np, ngo_lat: pc.latitude, ngo_lng: pc.longitude };
        }
      }
      return np;
    });

    setUsers(patchedUsers);
    setFoodPosts(patchedPosts);
    setAgentAssignments(Array.isArray(a) ? a : []);
    setNgoResponses(Array.isArray(n) ? n : []);

    // Extra validation: if savedUser doesn't exist in the users list anymore
    // (e.g. database was reset) then log them out silently instead of redirect-looping.
    if (savedUser?.id) {
      const stillExists = patchedUsers.find((x) => x.id === savedUser.id);
      if (!stillExists) {
        setCurrentUser(null);
        localStorage.removeItem(LS_CURRENT_USER);
        savedUser = null;
      } else {
        // Re-sync saved user with DB (so structured address fields added after
        // old registration are reflected immediately — no stale localStorage).
        // Also ensure coordinates are always patched (use patched version from users list).
        if (
          savedUser.street !== stillExists.street ||
          savedUser.area !== stillExists.area ||
          savedUser.landmark !== stillExists.landmark ||
          savedUser.pincode !== stillExists.pincode ||
          savedUser.restaurant_name !== stillExists.restaurant_name ||
          savedUser.ngo_name !== stillExists.ngo_name ||
          savedUser.latitude !== stillExists.latitude ||
          savedUser.longitude !== stillExists.longitude
        ) {
          setCurrentUser(stillExists);
          localStorage.setItem(LS_CURRENT_USER, JSON.stringify(stillExists));
          savedUser = stillExists;
        }
      }
      if (savedUser?.id) {
        try {
          const notifs = await fetchJson(API_BASE + '/notifications/' + encodeURIComponent(savedUser.id));
          setNotifications(Array.isArray(notifs) ? notifs : []);
        } catch { /* notifications optional */ }
      }
    }
  }

  // Initial fetch on app mount: restore currentUser from localStorage + fetch all from backend
  useEffect(() => {
    (async () => {
      try {
        await loadAll();
      } catch (e) {
        console.error('Init fetch failed (backend not running?):', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function refreshNotifications(userId) {
    if (!userId) return;
    try {
      const notifs = await fetchJson(API_BASE + '/notifications/' + encodeURIComponent(userId));
      setNotifications(Array.isArray(notifs) ? notifs : []);
    } catch (e) {
      console.warn('refreshNotifications failed:', e.message);
    }
  }

  async function markNotificationRead(userId, notifId) {
    try {
      await fetchJson(API_BASE + '/notifications/' + encodeURIComponent(userId) + '/mark-read', {
        method: 'PATCH',
        body: JSON.stringify(notifId ? { id: notifId } : {}),
      });
      await refreshNotifications(userId);
    } catch {}
  }

  /* ----------------- Auth actions ----------------- */

  async function registerUser(userData) {
    const created = await fetchJson(API_BASE + '/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    let patched = created;
    if (!hasValidCoords(patched?.latitude, patched?.longitude)) {
      const pc = coordsForPincode(patched?.pincode);
      if (pc) patched = { ...patched, latitude: pc.latitude, longitude: pc.longitude };
    }
    setUsers((prev) => [...prev, patched]);
    return patched;
  }

  async function loginUser(contact, password, role) {
    /* Server returns the user object directly (not wrapped in {user:...}).
       We also do a shape-check to guard against malformed responses from
       leaving currentUser in a broken "redirect-to-home" state. */
    let user = await fetchJson(API_BASE + '/login', {
      method: 'POST',
      body: JSON.stringify({ contact: String(contact || '').trim(), password, role }),
    });
    if (!user || !user.id || !user.role || !user.full_name) {
      throw new Error('Login succeeded but server returned invalid user data. Please re-enter credentials.');
    }
    // Patch coordinates on fresh login (in case DB has 0,0 from offline geocoding)
    if (!hasValidCoords(user.latitude, user.longitude)) {
      const pc = coordsForPincode(user.pincode);
      if (pc) user = { ...user, latitude: pc.latitude, longitude: pc.longitude };
    }
    setCurrentUser(user);
    localStorage.setItem(LS_CURRENT_USER, JSON.stringify(user));
    try {
      const notifs = await fetchJson(API_BASE + '/notifications/' + encodeURIComponent(user.id));
      setNotifications(Array.isArray(notifs) ? notifs : []);
    } catch { /* notifications optional */ }
    return user;
  }

  function logout() {
    setCurrentUser(null);
    localStorage.removeItem(LS_CURRENT_USER);
  }

  /* ----------------- Food Post actions ----------------- */

  async function addFoodPost(postData) {
    const created = await fetchJson(API_BASE + '/food-posts', {
      method: 'POST',
      body: JSON.stringify(postData),
    });
    setFoodPosts((prev) => [created, ...prev]);
    return created;
  }

  async function patchPost(postId, patch) {
    const updated = await fetchJson(API_BASE + '/food-posts/' + postId, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    setFoodPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    return updated;
  }

  /* ----------------- NGO Accept / Reject ----------------- */

  async function acceptByNgo(postId, ngo) {
    // 1) record the response in ngo_responses table
    await fetchJson(API_BASE + '/ngo-responses', {
      method: 'POST',
      body: JSON.stringify({ post_id: postId, ngo_id: ngo.id, response: 'accepted' }),
    });
    setNgoResponses((prev) => [
      ...prev,
      { post_id: postId, ngo_id: ngo.id, response: 'accepted', responded_at: new Date().toISOString() },
    ]);
    // 2) update food post status and attach ngo coords so the map can draw the line
    const acceptedAt = new Date().toISOString();
    const updated = await patchPost(postId, {
      status: FOOD_STATUS.NGO_ACCEPTED,
      ngo_id: ngo.id,
      ngo_lat: ngo.latitude,
      ngo_lng: ngo.longitude,
      accepted_at: acceptedAt,
    });
    return updated;
  }

  async function rejectByNgo(postId, ngoId) {
    const res = await fetchJson(API_BASE + '/ngo-responses', {
      method: 'POST',
      body: JSON.stringify({ post_id: postId, ngo_id: ngoId, response: 'rejected' }),
    });
    setNgoResponses((prev) => [...prev, res]);
    return res;
  }

  /* ----------------- Agent Accept Pickup / Confirm ----------------- */

  async function acceptByAgent(postId, agentId) {
    const assignment = await fetchJson(API_BASE + '/agent-assignments', {
      method: 'POST',
      body: JSON.stringify({ post_id: postId, agent_id: agentId }),
    });
    setAgentAssignments((prev) => [...prev, assignment]);
    const updated = await patchPost(postId, {
      status: FOOD_STATUS.AGENT_ASSIGNED,
      agent_id: agentId,
    });
    return updated;
  }

  async function confirmPickup(postId) {
    return patchPost(postId, {
      status: FOOD_STATUS.PICKED_UP,
      picked_up_at: new Date().toISOString(),
    });
  }

  async function confirmDelivery(postId) {
    return patchPost(postId, {
      status: FOOD_STATUS.DELIVERED,
      delivered_at: new Date().toISOString(),
    });
  }

  /* -------- Delivery Journey + OTP flow (new actions) -------- */

  async function startJourney(postId, extra) {
    const res = await fetchJson(API_BASE + '/food-posts/' + encodeURIComponent(postId) + '/start-journey', {
      method: 'POST',
      body: JSON.stringify(extra || {}),
    });
    setFoodPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...res } : p)));
    if (currentUser?.id) await refreshNotifications(currentUser.id);
    return res;
  }

  async function generateDeliveryOTP(postId) {
    const res = await fetchJson(API_BASE + '/food-posts/' + encodeURIComponent(postId) + '/generate-delivery-otp', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    setFoodPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...res } : p)));
    if (currentUser?.id) await refreshNotifications(currentUser.id);
    return res;
  }

  async function verifyDeliveryOTP(postId, otp) {
    const res = await fetchJson(API_BASE + '/food-posts/' + encodeURIComponent(postId) + '/verify-delivery-otp', {
      method: 'POST',
      body: JSON.stringify({ otp }),
    });
    if (res?.post) {
      setFoodPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...res.post } : p)));
    }
    if (currentUser?.id) await refreshNotifications(currentUser.id);
    return res;
  }

  async function markUnavailable(postId) {
    return patchPost(postId, { status: FOOD_STATUS.UNAVAILABLE });
  }

  async function markDonated(postId) {
    return patchPost(postId, {
      status: FOOD_STATUS.DELIVERED,
      delivered_at: new Date().toISOString(),
    });
  }

  /* ----------------- Helpers ----------------- */

  // Look up a user by id
  function getUserById(id) {
    if (!Array.isArray(users)) return null;
    return users.find((u) => u && u.id === id) || null;
  }

  const value = {
    loading,
    currentUser,
    users,
    foodPosts,
    agentAssignments,
    ngoResponses,
    notifications,
    registerUser,
    loginUser,
    logout,
    addFoodPost,
    patchPost,
    acceptByNgo,
    rejectByNgo,
    acceptByAgent,
    confirmPickup,
    startJourney,
    generateDeliveryOTP,
    verifyDeliveryOTP,
    confirmDelivery,
    markUnavailable,
    markDonated,
    getUserById,
    refreshNotifications,
    markNotificationRead,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

const SAFE_CTX = {
  loading: true,
  currentUser: null,
  users: [],
  foodPosts: [],
  agentAssignments: [],
  ngoResponses: [],
  notifications: [],
  registerUser: async () => { throw new Error('AppContext not ready'); },
  loginUser: async () => { throw new Error('AppContext not ready'); },
  logout: () => {},
  addFoodPost: async () => { throw new Error('AppContext not ready'); },
  patchPost: async () => { throw new Error('AppContext not ready'); },
  acceptByNgo: async () => { throw new Error('AppContext not ready'); },
  rejectByNgo: async () => { throw new Error('AppContext not ready'); },
  acceptByAgent: async () => { throw new Error('AppContext not ready'); },
  confirmPickup: async () => { throw new Error('AppContext not ready'); },
  startJourney: async () => { throw new Error('AppContext not ready'); },
  generateDeliveryOTP: async () => { throw new Error('AppContext not ready'); },
  verifyDeliveryOTP: async () => { throw new Error('AppContext not ready'); },
  confirmDelivery: async () => { throw new Error('AppContext not ready'); },
  markUnavailable: async () => { throw new Error('AppContext not ready'); },
  markDonated: async () => { throw new Error('AppContext not ready'); },
  getUserById: () => null,
  refreshNotifications: async () => {},
  markNotificationRead: async () => {},
};

export function useAppContext() {
  const ctx = useContext(AppContext);
  return ctx || SAFE_CTX;
}
