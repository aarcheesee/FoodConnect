/*
  Profile Page
  -------------
  Simple read-only page showing the logged-in user's details.
  Shows role-specific columns (restaurant_name / vehicle_type / ngo_name etc.)
*/
import { useAppContext } from '../context/AppContext';

export default function Profile() {
  const { currentUser } = useAppContext();
  if (!currentUser) return null;
  const u = currentUser;

  const rows = [];
  rows.push(['Role', u.role]);
  rows.push(['Full Name', u.full_name]);
  if (u.role === 'restaurant') rows.push(['Restaurant Name', u.restaurant_name || '—']);
  if (u.role === 'restaurant') rows.push(['FSSAI License', u.fssai_license || '—']);
  if (u.role === 'agent') rows.push(['Vehicle Type', u.vehicle_type || '—']);
  if (u.role === 'ngo') rows.push(['NGO Name', u.ngo_name || '—']);
  if (u.role === 'ngo') rows.push(['NGO Type', u.ngo_type || '—']);
  if (u.street || u.area || u.landmark || u.pincode) {
    rows.push(['Street / Building', u.street || '—']);
    rows.push(['Area / Locality', u.area || '—']);
    rows.push(['Landmark', u.landmark || '—']);
    rows.push(['6-Digit Pincode', u.pincode || '—']);
  }
  rows.push(['Full Address', u.address]);
  rows.push(['Contact Number', u.contact]);
  rows.push(['Email', u.email || '—']);
  rows.push(['Latitude, Longitude', `${u.latitude || 0}, ${u.longitude || 0}`]);
  rows.push(['Registered On', new Date(u.created_at).toLocaleString()]);

  return (
    <div className="profile-card">
      <h2>My Profile</h2>
      {(rows || []).map((item, i) => {
        const [k, v] = Array.isArray(item) ? item : ['', ''];
        return (
          <div key={k || ('row-' + i)} className="profile-row"><div className="k">{k}</div><div className="v">{v}</div></div>
        );
      })}
    </div>
  );
}
