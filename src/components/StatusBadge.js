/*
  StatusBadge component
  ----------------------
  Reusable colored pill for food post status.
  CSS class names match the FOOD_STATUS strings so the badge is auto-colored.
*/
import { FOOD_STATUS, STATUS_LABELS } from '../utils/constants';

export default function StatusBadge({ status }) {
  const cls =
    {
      [FOOD_STATUS.AVAILABLE]: 'available',
      [FOOD_STATUS.NGO_ACCEPTED]: 'ngo-accepted',
      [FOOD_STATUS.AGENT_ASSIGNED]: 'agent-assigned',
      [FOOD_STATUS.JOURNEY_STARTED]: 'journey-started',
      [FOOD_STATUS.PICKED_UP]: 'picked-up',
      [FOOD_STATUS.OTP_PENDING]: 'otp-pending',
      [FOOD_STATUS.DELIVERED]: 'delivered',
      [FOOD_STATUS.UNAVAILABLE]: 'unavailable',
    }[status] || 'unavailable';
  return <span className={`badge ${cls}`}>{STATUS_LABELS[status] || status}</span>;
}
