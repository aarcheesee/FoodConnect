/*
  FoodConnect - Constants
  ------------------------
  All "magic strings" (role names, statuses, nearby radius) are defined here
  so the rest of the code imports them. If we want to change a status or radius,
  we just change it here once.
*/

export const ROLES = {
  RESTAURANT: 'restaurant',
  AGENT: 'agent',
  NGO: 'ngo',
};

// Food post lifecycle statuses (saved in DB, shown as colored badges)
// Extended lifecycle:
//   available -> ngo-accepted -> agent-assigned -> journey-started -> picked-up -> otp-pending -> delivered
//   (any stage can also go to "unavailable" if cancelled)
export const FOOD_STATUS = {
  AVAILABLE: 'available',
  NGO_ACCEPTED: 'ngo-accepted',
  AGENT_ASSIGNED: 'agent-assigned',
  JOURNEY_STARTED: 'journey-started',
  PICKED_UP: 'picked-up',
  OTP_PENDING: 'otp-pending',
  DELIVERED: 'delivered',
  UNAVAILABLE: 'unavailable',
};

// Human-readable status label
export const STATUS_LABELS = {
  available: 'Available',
  'ngo-accepted': 'NGO Accepted',
  'agent-assigned': 'Agent Assigned',
  'journey-started': 'Journey Started',
  'picked-up': 'Picked Up',
  'otp-pending': 'Awaiting OTP Verification',
  delivered: 'Delivered / Donated',
  unavailable: 'Unavailable',
};

// How many PINCODE prefix digits must match for users to be "nearby"
// 3 digits = same city / zone   (Mumbai: 400xxx, Delhi: 110xxx, Pune: 411xxx — never matched cross-city)
export const PINCODE_PREFIX_MATCH = 3;

export const NEARBY_RADIUS_KM = 10;

// Average speeds (km/h) used for ETA calculation, matching the server model.
// Values kept here so the frontend can also do a quick preview calc.
export const VEHICLE_SPEEDS_KMPH = {
  Bike: 20,
  Scooter: 25,
  Car: 30,
  Walk: 5,
  default: 22,
};
export const TRAFFIC_MULTIPLIER = 1.4;
export const PICKUP_BUFFER_MIN = 10;
export const HANDOVER_BUFFER_MIN = 5;

// API base: the React dev server has "proxy: http://localhost:5000" in package.json
// so we can just use "/api" and the dev server forwards to port 5000 automatically.
export const API_BASE = '/api';
