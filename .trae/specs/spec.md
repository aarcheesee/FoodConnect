# FoodConnect - Food Donation Platform Product Requirements Document

## Overview
- **Summary**: A React-based web platform that connects Restaurants (with leftover food), Delivery Agents, and Beneficiary NGOs/Shelters to reduce food waste and deliver surplus food to those in need. The platform features registration/login for all three user roles, real-time food posting, location-based matching via OpenStreetMap, and donation acceptance/rejection workflow.
- **Purpose**: Reduce food wastage from restaurants by facilitating structured donation to nearby NGOs through verified delivery agents, with transparent tracking on a free open-source map.
- **Target Users**:
  1. Restaurant Owners/Managers - who have leftover food to donate
  2. Delivery Agents - who volunteer/are assigned to pick up and deliver food
  3. NGO/Shelter Representatives - who receive food donations

## Goals
- Provide simple registration and login for 3 user roles (Restaurant, Delivery Agent, NGO)
- Enable Restaurants to post real-time leftover food updates with type, quantity, pickup time, and expiry
- Allow Restaurants to mark food as donated or unavailable after collection
- Enforce food safety guidelines confirmation before posting food
- Match Delivery Agents with nearby Restaurants based on location proximity
- Enable Agents to accept pickup requests and confirm pickup & delivery
- Enable NGOs to receive nearby food notifications and Accept / Reject donations
- Integrate OpenStreetMap (free) to show restaurant/NGO/agent locations with distance
- Maintain clean, basic Create React App syntax suitable for a student explanation
- use sqlite3 database 

## Non-Goals

- No real payment or financial transactions
- No SMS/email OTP verification (mock verification only)
- No multi-language support (English only)
- No mobile app (responsive web only)
- No Google Maps / paid map APIs (OpenStreetMap + Leaflet only)
- No production authentication (mock auth via localStorage only)

## Background & Context
This is a student project that needs to be fully explainable with basic React concepts (useState, useEffect, useContext, React Router, simple components). The code must be readable and each module should have clear separation of concerns so the student can present it to a teacher.

## Functional Requirements

### User Account (Common to all roles)
- **FR-1**: Role selection on landing page (Restaurant / Delivery Agent / NGO)
- **FR-2**: Registration form per role with: Full Name, Address, Contact Number, Email (optional), Role-specific fields, Set Password
- **FR-3**: Login form with Contact Number + Password + Role selection; credentials validated against registered users
- **FR-4**: Basic profile view showing registered details
- **FR-5**: Logout functionality clearing session

### Restaurant Module
- **FR-6**: Restaurant dashboard showing all posted food donations with status (Available / Picked Up / Donated / Unavailable)
- **FR-7**: Post new food form with: Food Type, Quantity (servings/kg), Pickup Start Time, Pickup End Time, Expiry Date/Time, Food Image (optional), Description
- **FR-8**: Mandatory Food Safety Guidelines checklist before posting (handled, temperature, packaging, expiry checked) with compliance confirmation checkbox
- **FR-9**: Mark food as "Donated" after handover to agent
- **FR-10**: Mark food as "Unavailable" if food is no longer available
- **FR-11**: View list of nearby NGOs who accepted the donation request, and delivery agent assigned

### Delivery Agent Module
- **FR-12**: Agent dashboard showing list of Available restaurant pickup requests sorted by proximity (nearest first)
- **FR-13**: Display approximate distance between Agent's registered address and Restaurant's address (geocoded via Nominatim for OpenStreetMap)
- **FR-14**: Agent can "Accept" a pickup request (only one agent per request)
- **FR-15**: After accepting, agent has buttons to "Confirm Pickup" (at restaurant) and "Confirm Delivery" (at NGO)
- **FR-16**: Track pickup status flow: Available -> Accepted by Agent -> Picked Up -> Delivered

### NGO / Beneficiary Module
- **FR-17**: NGO dashboard showing list of nearby available food donation posts (within a set radius, food should still be fresh based on pickup time/expiry)
- **FR-18**: For each new notification, show Accept / Reject buttons
- **FR-19**: If NGO Rejects, the food post remains open for other NGOs
- **FR-20**: If NGO Accepts, system locks NGO for that food post and notifies restaurant + triggers agent matching
- **FR-21**: View accepted donations with delivery status

### OpenStreetMap Integration (Free)
- **FR-22**: Use Leaflet.js with OpenStreetMap tiles (no API key required)
- **FR-23**: Show map markers for Restaurant and NGO locations with popup info (name, address, food posted / needed)
- **FR-24**: Show connecting polyline (route visual) between matched Restaurant and NGO
- **FR-25**: Display approximate distance in km between matched locations using Haversine formula on coordinates
- **FR-26**: Allow user to click map marker to see details
- **FR-27**: Use Nominatim free geocoding service to convert user-typed addresses to lat/lng coordinates

### Common / Workflow
- **FR-28**: State persistence across page reloads using localStorage (users, food posts, delivery assignments, acceptances)
- **FR-29**: Centralized React Context for global state (auth user, all users, food posts, assignments)
- **FR-30**: Responsive navigation bar with role-specific menu items
- **FR-31**: Real-time status updates reflected across dashboards (since same browser, via context re-renders)

## Non-Functional Requirements
- **NFR-1**: Student-explainable code with clear component names, simple state, and no advanced patterns beyond basic CRA
- **NFR-2**: All libraries must be free, open-source, and installable via npm (leaflet, react-leaflet, react-router-dom, uuid)
- **NFR-3**: No backend required — data persistence via browser localStorage
- **NFR-4**: Responsive layout that works on both desktop and mobile browser widths
- **NFR-5**: Pages load with no runtime errors in browser console
- **NFR-6**: Map must load without any paid API key; uses only public OSM endpoints

## Constraints
- **Technical**:
  - Must use Create React App structure (npx create-react-app)
  - React Router DOM for page navigation
  - Leaflet + react-leaflet for OpenStreetMap rendering
  - Nominatim (free) for geocoding addresses
  - localStorage for persistence
  - No TypeScript (plain JavaScript only for easier student explanation)
  - No Redux / Zustand (React Context only)
- **Business**:
  - All data is mock/demo data; no real identity verification
  - Distance shown is straight-line (Haversine), not driving distance
- **Dependencies**:
  - Node.js and npm installed on student's machine
  - Browser must allow third-party tile loading (OSM tiles)
  - Internet access required for map tiles and Nominatim lookups

## Assumptions
- The student will run the app locally with `npm start`
- Multiple users (Restaurant, Agent, NGO) can be simulated by registering accounts in the same browser
- All users share the same browser storage, so the "real-time" effect works within one browser
- Location addresses will be real enough that Nominatim can resolve them (e.g., "Mumbai Central, Mumbai, India")
- A food post goes through this lifecycle:
  1. Restaurant posts food (status: Available)
  2. NGOs see it nearby, can Accept/Reject
  3. If NGO Accepts (status: NGO Accepted)
  4. Agents see accepted posts near them, can Accept pickup
  5. Agent accepts (status: Agent Assigned / Pickup Scheduled)
  6. Agent confirms Pickup (status: Picked Up)
  7. Agent confirms Delivery (status: Delivered / Donated)

## Acceptance Criteria

### AC-1: Landing page with role selection
- **Type**: `rule`
- **Given**: A user opens the app URL
- **When**: No user is logged in
- **Then**: The landing page shows 3 cards: Restaurant, Delivery Agent, NGO, each with Login / Register buttons, plus a "Live Map Overview" link
- **Pass Condition**: Landing page renders with 3 role cards and Login/Register links; clicking any navigates to appropriate form
- **Evidence**: Browser screenshot and manual navigation test

### AC-2: User registration per role
- **Type**: `rule`
- **Given**: User is on registration page with a role selected
- **When**: User fills required fields (Name, Address, Contact, Password) and clicks Register
- **Then**: A new user is saved to localStorage with the correct role; user is redirected to login page with success message
- **Pass Condition**: Registered user appears in localStorage; form validates required fields; duplicate contact number rejected
- **Evidence**: localStorage snapshot + registration success alert

### AC-3: User login / session
- **Type**: `rule`
- **Given**: A user has already registered
- **When**: User enters correct Contact, Password, and Role on login page
- **Then**: Session is created (user stored in localStorage under `currentUser`); redirected to role dashboard; navbar shows user name + logout
- **Pass Condition**: Invalid credentials show error; valid credentials redirect to dashboard; page refresh keeps user logged in
- **Evidence**: Dashboard renders and localStorage contains currentUser

### AC-4: Restaurant can post food with safety confirmation
- **Type**: `rule`
- **Given**: A Restaurant user is logged in
- **When**: They navigate to "Post Food", fill all fields (type, quantity, pickup, expiry), check all food safety boxes and confirm, then submit
- **Then**: A food post is saved to localStorage with status "Available"; appears on Restaurant's dashboard list
- **Pass Condition**: Food post visible in localStorage and dashboard; safety checklist prevents submission until all checked
- **Evidence**: Dashboard list renders new food post with correct details and status

### AC-5: Restaurant can mark food Donated / Unavailable
- **Type**: `rule`
- **Given**: Restaurant has a posted food item
- **When**: Restaurant clicks "Mark Unavailable" or "Mark Donated"
- **Then**: The food post status updates; dashboard reflects the new status; NGOs/Agents no longer see it as available
- **Pass Condition**: Status changes correctly and persists after refresh
- **Evidence**: Status badge on dashboard card updates; persistence check via refresh

### AC-6: NGO sees nearby food with Accept/Reject
- **Type**: `rule`
- **Given**: An NGO user is logged in and at least one "Available" food post exists from a Restaurant
- **When**: NGO opens the dashboard
- **Then**: All Available food posts are listed with Approx. Distance from NGO address; each has Accept / Reject buttons
- **Pass Condition**: Accept changes status to "NGO Accepted" with the NGO id; Reject records rejection so NGO stops seeing it
- **Evidence**: NGO dashboard list with Accept/Reject; localStorage food post status updates on click

### AC-7: Agent sees accepted requests by proximity
- **Type**: `rule`
- **Given**: A food post is in "NGO Accepted" status and Delivery Agent is logged in
- **When**: Agent dashboard loads
- **Then**: Agent sees all NGO-accepted food posts, ordered by Approx. Distance (nearest first), with distance from Agent's address to Restaurant's address shown
- **Pass Condition**: List ordered by distance ascending; only NGO-accepted posts shown; each has Accept Pickup button
- **Evidence**: Sorted agent dashboard list with km distances and Accept button

### AC-8: Agent pickup and delivery confirmation flow
- **Type**: `rule`
- **Given**: Agent has accepted a pickup request
- **When**: Agent clicks "Confirm Pickup" then later "Confirm Delivery"
- **Then**: Food status changes from "Agent Assigned" -> "Picked Up" -> "Delivered / Donated"; Restaurant and NGO dashboards reflect these updates
- **Pass Condition**: Each button click updates status correctly and all dashboards show the latest status on refresh / re-render
- **Evidence**: All 3 role dashboards show same status after each step

### AC-9: OpenStreetMap renders markers and route
- **Type**: `rule`
- **Given**: At least one Restaurant and one NGO are registered with valid addresses (coordinates resolved)
- **When**: The Map page is opened
- **Then**: Leaflet map loads using OpenStreetMap tiles; Restaurant and NGO markers appear at correct coordinates; clicking a marker shows popup with details; for a matched pair, a polyline connects them and distance in km is shown
- **Pass Condition**: Map tiles load; no console errors; markers present; popups work; polyline visible where applicable
- **Evidence**: Screenshot of map page with markers and popup

### AC-10: Geocoding and distance calculation
- **Type**: `rule`
- **Given**: User enters a valid address during registration
- **When**: Registration form is submitted
- **Then**: Nominatim geocodes the address to lat/lng, stored in user record; distance between any two users can be calculated using Haversine formula and shown in km (1 decimal place)
- **Pass Condition**: All registered users in localStorage have `latitude` and `longitude` numeric fields; distance function returns sensible values (e.g., Mumbai <-> Delhi ~1150 km +/- 50 km)
- **Evidence**: localStorage user record shows lat/lng; distance calculation function called and logged

### AC-11: Data persistence via localStorage
- **Type**: `rule`
- **Given**: Users registered, food posted, assignments made
- **When**: Browser tab is closed and reopened (app reloaded)
- **Then**: All users, food posts, and assignments reload from localStorage; dashboards show same data as before close
- **Pass Condition**: Reload preserves state of currentUser, users, foodPosts, agentAssignments, ngoResponses
- **Evidence**: Screenshot before and after refresh; localStorage keys present

### AC-12: Student-explainable code quality
- **Type**: `rubric`
- **Dimension**: Code clarity and explainability for a student viva
- **Scale**: 1-5
- **Anchors**: 1 = advanced patterns, tangled code, no separation; 3 = working code but some unclear parts; 5 = clean components, single responsibility, basic React only, comments on key logic
- **Pass Threshold**: >= 4
- **Evidence**: Source file review — check each component has clear name, uses only basic hooks (useState, useEffect, useContext), routing is simple, and context/state flow is traceable

### AC-13: Responsive layout
- **Type**: `rubric`
- **Dimension**: Mobile and desktop UI usability
- **Scale**: 1-5
- **Anchors**: 1 = breaks on small screens; 3 = usable on one of the two; 5 = both desktop and mobile widths render correctly (nav collapses, cards stack, forms fit)
- **Pass Threshold**: >= 4
- **Evidence**: Resize browser width to 375px and 1440px — screenshots show no horizontal scroll and content is accessible

## Open Questions
- [ ] What is the default radius in km for showing nearby food to NGOs? (Assuming 10 km if not specified)
- [ ] Does the student want any pre-seeded demo accounts and a sample restaurant/NGO/agent to showcase flow on first load? (Assuming yes — seed demo data)
