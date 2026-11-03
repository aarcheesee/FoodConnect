# FoodConnect - Implementation Plan

## Task 1: Scaffold Create React App project with base dependencies
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Run `npx create-react-app .` in project root
  - Install additional npm packages: `react-router-dom`, `leaflet`, `react-leaflet`, `uuid`
  - Clean default CRA files (logo, default css content)
  - Verify `npm start` launches app on localhost:3000 without errors
- **Acceptance Criteria Addressed**: AC-12 (base code structure)
- **Test Requirements**:
  - `rule` TR-1.1: `npm start` runs, browser opens, console has no errors
  - `rule` TR-1.2: package.json contains react-router-dom, leaflet, react-leaflet, uuid
- **Notes**: If node_modules present, skip scaffolding; verify dependencies only

## Task 2: Create project folder structure, App router, and shared layout
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Create folder structure:
    - `src/components/` (Navbar, Footer, ProtectedRoute, RoleCard, FoodCard, MapView)
    - `src/pages/` (Home, Register, Login, RestaurantDashboard, AgentDashboard, NgoDashboard, MapPage, PostFood, Profile)
    - `src/context/` (AppContext.js — global state)
    - `src/utils/` (storage.js, distance.js, geocode.js, constants.js)
    - `src/data/` (seed.js — demo seed data)
  - Set up React Router with routes: /, /register/:role, /login/:role, /dashboard, /post-food, /map, /profile
  - Create Navbar component with conditional links based on role
  - Create ProtectedRoute wrapper redirecting unauthenticated users
- **Acceptance Criteria Addressed**: AC-1, AC-12
- **Test Requirements**:
  - `rule` TR-2.1: All routes render correct page components; unknown routes show Home
  - `rule` TR-2.2: Protected route redirects to / when not logged in; allows when currentUser in localStorage
  - `rule` TR-2.3: Navbar shows role-appropriate links (e.g., Post Food only for Restaurant)
- **Notes**: Use BrowserRouter from react-router-dom

## Task 3: Implement AppContext + localStorage utilities + seed demo data
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - `src/utils/storage.js`: getUsers, setUsers, getCurrentUser, setCurrentUser, clearCurrentUser, getFoodPosts, setFoodPosts, getAgentAssignments, setAgentAssignments, getNgoResponses, setNgoResponses
  - `src/utils/distance.js`: haversineDistance(lat1, lon1, lat2, lon2) returning km rounded to 1 decimal
  - `src/utils/constants.js`: ROLES = { RESTAURANT, AGENT, NGO }, FOOD_STATUS = { AVAILABLE, NGO_ACCEPTED, AGENT_ASSIGNED, PICKED_UP, DELIVERED, UNAVAILABLE }, NEARBY_RADIUS_KM = 10
  - `src/data/seed.js`: demo users (1 restaurant in Mumbai, 1 agent nearby, 1 NGO nearby) + 1 sample food post; seed() function only runs on first launch (check localStorage `seeded_v1` flag)
  - `src/context/AppContext.js`: Provider wrapping children, state contains currentUser, users, foodPosts, agentAssignments, ngoResponses; exposes actions: registerUser, loginUser, logout, addFoodPost, updateFoodStatus, acceptByNgo, rejectByNgo, acceptByAgent, confirmPickup, confirmDelivery
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-10, AC-11
- **Test Requirements**:
  - `rule` TR-3.1: First run calls seed(); localStorage contains demo users; subsequent runs don't duplicate
  - `rule` TR-3.2: haversineDistance returns ~1.0 km for two points 1 km apart; ~1150 km for Mumbai(19.076,72.8777) to Delhi(28.7041,77.1025) within +/- 50
  - `rule` TR-3.3: Context actions mutate state and persist to localStorage correctly
  - `rule` TR-3.4: After reload, AppContext initializes from localStorage (seed not overwritten)

## Task 4: Implement registration and login pages
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - `Register.js`: Takes role from URL param (/register/restaurant | agent | ngo); form fields: Full Name, Address, Contact Number (required, 10 digit), Email (optional), Restaurant-specific: Restaurant Name, FSSAI License (optional); Agent-specific: Vehicle Type (optional); NGO-specific: NGO Name, Type (Shelter/Orphanage/Community Kitchen); Password (min 6 chars), Confirm Password; Submit calls context.registerUser
  - `Login.js`: Takes role from URL param; fields: Contact Number, Password; Submit calls context.loginUser with role; on success redirect to /dashboard
  - Form validation: required fields, password match, contact number length; show inline errors
- **Acceptance Criteria Addressed**: AC-2, AC-3
- **Test Requirements**:
  - `rule` TR-4.1: Submit of valid registration stores user in localStorage with role, lat, lng; redirects to login
  - `rule` TR-4.2: Duplicate contact number shows error "Contact number already registered"
  - `rule` TR-4.3: Valid login stores currentUser in localStorage; navigates to dashboard; invalid login shows "Invalid credentials"

## Task 5: Build landing Home page with role cards + Navbar + Profile/Logout
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 4
- **Description**:
  - Home page hero with platform name "FoodConnect — Donate Surplus Food, Feed the Needy"
  - Three role cards (Restaurant, Delivery Agent, NGO), each with icon, description, Login and Register buttons linking to /login/:role and /register/:role
  - Big button: "View Live Map" linking to /map
  - Navbar links when not logged in: Home, Map; when logged in: Dashboard, (Post Food if restaurant), Map, Profile, Logout
  - Profile page shows user details (name, address, contact, email, role-specific fields), edit NOT required
  - Logout: clears currentUser from localStorage and redirects home
- **Acceptance Criteria Addressed**: AC-1, AC-3
- **Test Requirements**:
  - `rule` TR-5.1: Home shows 3 role cards only when no user logged in; redirects to dashboard if user is already logged in
  - `rule` TR-5.2: Navbar links change correctly between logged-in / logged-out and roles
  - `rule` TR-5.3: Logout button clears currentUser and lands on Home; Profile page renders stored user fields

## Task 6: Restaurant Dashboard + Post Food page with safety checklist
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 5
- **Description**:
  - PostFood.js form:
    - Fields: Food Type (Veg/Non-Veg/Vegan dropdown + text Other), Quantity (number + unit servings/kg), Description, Pickup Start DateTime, Pickup End DateTime, Expiry DateTime
    - Food Safety Checklist (checkboxes, ALL required):
      1. Food is stored at safe temperature (< 5°C for cold / > 60°C for hot)
      2. Food is properly covered and packaged
      3. Food is not past visual / sensory expiry
      4. All handlers followed hand hygiene
    - Final compliance confirmation checkbox: "I confirm the above safety guidelines were followed"
    - Submit: calls context.addFoodPost with status AVAILABLE and timestamps
  - RestaurantDashboard.js:
    - Header: Welcome [Restaurant Name] + quick stats (Total Posted, Available, Delivered, Unavailable)
    - List of FoodCard components for the restaurant own posts, each showing details, status badge, and action buttons:
      - If AVAILABLE -> Mark Unavailable
      - If AGENT_ASSIGNED -> Mark as Donated (after handover)
    - For NGO_ACCEPTED / AGENT_ASSIGNED status, show which NGO accepted and which agent assigned with contact info
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `rule` TR-6.1: Post Food submit disabled until ALL safety checkboxes ticked; valid submit adds food post; appears on dashboard with Available badge
  - `rule` TR-6.2: Clicking "Mark Unavailable" changes status; "Mark Donated" changes to DELIVERED (alternative path)
  - `rule` TR-6.3: Restaurant dashboard stats update when post added/status changed

## Task 7: NGO Dashboard (nearby food list with Accept / Reject)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 6
- **Description**:
  - NgoDashboard.js:
    - Tabs / sections: Nearby Available Food, My Accepted Donations
    - Nearby Available: iterate context foodPosts where status=AVAILABLE and distance(post.restaurantLat,post.restaurantLng, ngo.lat, ngo.lng) <= NEARBY_RADIUS_KM AND current ngo has NOT already rejected
    - Each food card shows: Restaurant Name, Food Type, Quantity, Pickup Window, Expiry, Approx Distance (km), and two buttons: Accept / Reject
    - On Accept: call context.acceptByNgo -> sets post status to NGO_ACCEPTED, records ngoResponses entry (postId, ngoId, response=accepted)
    - On Reject: call context.rejectByNgo -> records ngoResponses entry (postId, ngoId, response=rejected); post remains available for others
    - My Accepted Donations: list posts where this NGO is the accepted NGO, show current status (NGO_ACCEPTED / AGENT_ASSIGNED / PICKED_UP / DELIVERED)
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `rule` TR-7.1: AVAILABLE food posts within radius appear in Nearby list; posts farther than radius hidden
  - `rule` TR-7.2: Accept button moves status to NGO_ACCEPTED, Reject removes card from current NGO list but remains for other NGOs
  - `rule` TR-7.3: Accepted section shows the post with status; status updates as agent picks up / delivers

## Task 8: Delivery Agent Dashboard (nearby accepted requests + pickup/delivery flow)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 7
- **Description**:
  - AgentDashboard.js:
    - Tabs: Available Pickup Requests, My Active Deliveries, My Completed
    - Available Pickup Requests: foodPosts with status=NGO_ACCEPTED AND no agent already assigned; SORTED ASCENDING by distance(agent, restaurant)
    - Each card: Restaurant Name, Address, Food, NGO Name (destination), Pickup Window, Approx Distance (Agent -> Restaurant) in km, and Accept Pickup button
    - Accept Pickup: context.acceptByAgent -> sets status to AGENT_ASSIGNED, creates agentAssignments entry (postId, agentId, acceptedAt)
    - My Active Deliveries: list of agent's own assigned posts (status AGENT_ASSIGNED or PICKED_UP); show buttons:
      - AGENT_ASSIGNED -> "Confirm Pickup" (context.confirmPickup -> status PICKED_UP, pickedUpAt timestamp)
      - PICKED_UP -> "Confirm Delivery" (context.confirmDelivery -> status DELIVERED, deliveredAt timestamp, restaurant side sees as donated)
    - My Completed: DELIVERED status posts with completion timestamp
- **Acceptance Criteria Addressed**: AC-7, AC-8
- **Test Requirements**:
  - `rule` TR-8.1: Available list contains only NGO_ACCEPTED unassigned posts; sorted nearest first
  - `rule` TR-8.2: Accept Pickup assigns the agent; no other agent can accept (assignment lock)
  - `rule` TR-8.3: Confirm Pickup and Confirm Delivery transitions status step by step; all 3 role dashboards reflect updated status

## Task 9: Map page using Leaflet + OpenStreetMap (markers + route polyline + distance)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 8
- **Description**:
  - Install Leaflet CSS: include in index.html or via `import 'leaflet/dist/leaflet.css'` in index.js
  - MapPage.js: Load react-leaflet MapContainer, TileLayer (URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png, attribution), Marker, Popup, Polyline
  - Fix default Leaflet marker icon broken in CRA: reference L.Icon.Default image paths via leaflet/dist/images (or set custom divIcon for simplicity)
  - Markers:
    - Red icon for Restaurants, popup with Restaurant Name, Address, list of currently active food posts
    - Green icon for NGOs, popup with NGO Name, Address, accepted count
    - Blue icon for Delivery Agents, popup with Agent Name, Vehicle
  - Polylines: For each food post that reached NGO_ACCEPTED or later, draw polyline between restaurant and NGO, colored by status (yellow=NGO_ACCEPTED, orange=AGENT_ASSIGNED, green=DELIVERED)
  - Side panel: List of all active posts with Restaurant->NGO distance in km (using haversine)
  - MapView.js: reusable map component that can also be embedded on dashboards as small map preview (optional)
- **Acceptance Criteria Addressed**: AC-9, AC-10
- **Test Requirements**:
  - `rule` TR-9.1: Map loads tiles without API key; no CORS / console errors; markers visible
  - `rule` TR-9.2: Clicking a marker opens popup with correct name/details
  - `rule` TR-9.3: At least one polyline drawn when a post is NGO_ACCEPTED+; side panel shows Restaurant->NGO distance value
  - `rule` TR-9.4: Nominatim fallback; if Nominatim unavailable, use approximate demo coordinates during seed (don't crash app)

## Task 10: Geocoding utility (Nominatim) for addresses + seed coordinates
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 3, Task 4
- **Description**:
  - `src/utils/geocode.js`: async geocodeAddress(address) -> returns {latitude, longitude} using `https://nominatim.openstreetmap.org/search?format=json&q=${address}&limit=1`
  - Register form: on submit, attempt geocode; if it fails or returns empty, fall back to 0,0 (or prompt user; for demo, fallback acceptable with warning)
  - Seed file: hard-code approximate lat/lng for demo addresses (e.g., Mumbai Central, Bandra, Andheri locations) so map works immediately even without Nominatim call success
  - User-Agent header on Nominatim fetch set to "FoodConnectStudentProject/v1" (Nominatim requirement)
- **Acceptance Criteria Addressed**: AC-10
- **Test Requirements**:
  - `rule` TR-10.1: Seed demo users have plausible lat/lng values within Mumbai area (lat ~19.0-19.1, lng ~72.8-72.9)
  - `rule` TR-10.2: Registering "Gateway of India, Mumbai" resolves to ~(18.922, 72.8347) within +/- 0.02 lat/lng (or falls back gracefully if offline)

## Task 11: Styling, responsive layout, status badges, role-specific colors
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 5, Task 6, Task 7, Task 8, Task 9
- **Description**:
  - Use plain CSS or simple inline styles (no heavy CSS-in-JS libs to keep it student-friendly)
  - App.css: define color scheme: Restaurant=#e74c3c, Agent=#3498db, NGO=#27ae60, status colors for badges
  - Status badge styles for AVAILABLE(green), NGO_ACCEPTED(teal), AGENT_ASSIGNED(blue), PICKED_UP(orange), DELIVERED(dark green), UNAVAILABLE(gray)
  - Role cards on Home: colored borders, hover effects
  - Forms: padded inputs, error text in red, submit button in role color
  - Navbar: sticky top, responsive (stack on mobile via media queries)
  - Dashboards: card grid with flex-wrap, mobile 1 col, tablet 2 col, desktop 3 col
  - Map page: map height 70vh, sidebar on right (30% width), on mobile sidebar below map
- **Acceptance Criteria Addressed**: AC-13, AC-12
- **Test Requirements**:
  - `rubric` TR-11.1: Layout; scale 1-5; anchors 1=breaks, 3=usable on one size, 5=both desktop(1440px) and mobile(375px) work; threshold >= 4; evidence=two screenshots
  - `rule` TR-11.2: Each food card shows status badge with correct color matching status
  - `rule` TR-11.3: No horizontal scrollbar at 375px width; all buttons clickable

## Task 12: Final build verification — lint, build, smoke run full workflow
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1..Task 11
- **Description**:
  - Run `npm run build` — should complete without errors
  - Run app with `npm start`, manually walk through full workflow:
    1. Land on home -> register restaurant -> login -> post food (verify safety checks required)
    2. Logout -> register NGO -> login -> find food in Nearby -> Accept
    3. Logout -> register agent -> login -> see sorted list -> accept pickup -> confirm pickup -> confirm delivery
    4. Logout -> open Map page -> verify markers and polyline
    5. Refresh page -> confirm data still present
  - Open browser console: ensure no runtime errors at any step
  - Document workflow steps in a small run-log for student to follow during viva (but no extra files unless requested — include as inline comment at top of App.js)
- **Acceptance Criteria Addressed**: AC-1..AC-13 (smoke test coverage)
- **Test Requirements**:
  - `rule` TR-12.1: `npm run build` exits 0, build/ folder produced
  - `rule` TR-12.2: End-to-end smoke workflow completes with all status transitions
  - `rule` TR-12.3: Browser console remains clean (no red fatal errors)
- **Notes**: Fix any small bugs discovered during smoke run in this task
