/*
  Register Page
  --------------
  - Takes the role from URL: /register/restaurant, /register/agent, /register/ngo
  - COMPULSORY structured address fields:
      * Restaurant Name (if restaurant) / NGO Name (if NGO)
      * Street
      * Area
      * Landmark
      * 6-digit Pincode
    These ensure Delhi and Mumbai users never connect cross-city.
  - Combined address is built automatically for backward compatibility (map, old cards)
  - On submit:
      1. Validate form (required fields, password match, 10-digit contact, 6-digit pincode)
      2. Call Nominatim to geocode the combined address → lat/lng
      3. Call backend POST /api/users via registerUser() in AppContext
      4. On success redirect to /login/:role with a success message
*/
import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { geocodeAddress } from '../utils/geocode.js';

const ROLE_TITLES = {
  restaurant: 'Restaurant Owner / Manager',
  agent: 'Delivery Agent',
  ngo: 'NGO / Shelter / Volunteer',
};

export default function Register() {
  const { role } = useParams();
  const navigate = useNavigate();
  const { registerUser } = useAppContext();

  const [form, setForm] = useState({
    full_name: '', contact: '', email: '',
    street: '', area: '', landmark: '', pincode: '',
    password: '', confirm_password: '',
    restaurant_name: '', fssai_license: '',
    vehicle_type: '',
    ngo_name: '', ngo_type: 'Shelter',
  });
  const [errors, setErrors] = useState({});
  const [working, setWorking] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!['restaurant', 'agent', 'ngo'].includes(role)) {
    return <div className="form-container"><h2>Invalid role</h2><Link className="btn btn-primary" to="/">Go Home</Link></div>;
  }

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Build a combined, human-readable address string from the structured fields.
  // Used for geocoding + stored in `address` column for backward compatibility.
  function buildCombinedAddress() {
    const parts = [];
    try {
      if (role === 'restaurant' && form.restaurant_name && String(form.restaurant_name).trim()) parts.push(String(form.restaurant_name).trim());
      if (role === 'ngo' && form.ngo_name && String(form.ngo_name).trim()) parts.push(String(form.ngo_name).trim());
      if (form.street && String(form.street).trim()) parts.push(String(form.street).trim());
      if (form.landmark && String(form.landmark).trim()) parts.push('near ' + String(form.landmark).trim());
      if (form.area && String(form.area).trim()) parts.push(String(form.area).trim());
      if (form.pincode && String(form.pincode).trim()) parts.push(' - ' + String(form.pincode).trim());
    } catch (e) { /* swallow, fall back to empty join below */ }
    return (Array.isArray(parts) ? parts : []).join(', ');
  }

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Full name required';
    const contactClean = String(form.contact || '').replace(/\D/g, '').trim();
    if (!/^\d{10}$/.test(contactClean)) e.contact = 'Contact must be exactly 10 digits (numbers only)';
    if (!form.street.trim()) e.street = 'Street address required (e.g. Main Road, 2nd Lane)';
    if (!form.area.trim()) e.area = 'Area / Locality required (e.g. Andheri West)';
    if (!form.landmark.trim()) e.landmark = 'Landmark required (e.g. Near Station / Opp Hospital)';
    if (!/^\d{6}$/.test(form.pincode.trim())) e.pincode = 'Valid 6-digit Pincode required (e.g. 400058)';
    if (!form.password || form.password.length < 6) e.password = 'Password min 6 chars';
    if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match';
    if (role === 'restaurant' && !form.restaurant_name.trim()) e.restaurant_name = 'Restaurant name required';
    if (role === 'restaurant' && !String(form.fssai_license || '').trim()) e.fssai_license = 'FSSAI License Number is compulsory for restaurants';
    if (role === 'ngo' && !form.ngo_name.trim()) e.ngo_name = 'NGO name required';
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = validate();
    setErrors(err);
    if (Object.keys(err).length) return;
    setWorking(true);
    try {
      const combinedAddress = buildCombinedAddress();
      const coords = await geocodeAddress(combinedAddress);
      const contactClean = String(form.contact || '').replace(/\D/g, '').trim();
      const payload = {
        role,
        full_name: form.full_name.trim(),
        address: combinedAddress,
        street: form.street.trim(),
        area: form.area.trim(),
        landmark: form.landmark.trim(),
        pincode: form.pincode.trim(),
        contact: contactClean,
        email: form.email.trim() || null,
        password: form.password,
        latitude: coords.latitude || 0,
        longitude: coords.longitude || 0,
      };
      if (role === 'restaurant') {
        payload.restaurant_name = form.restaurant_name.trim();
        payload.fssai_license = String(form.fssai_license || '').trim();
      }
      if (role === 'agent') {
        payload.vehicle_type = form.vehicle_type.trim() || null;
      }
      if (role === 'ngo') {
        payload.ngo_name = form.ngo_name.trim();
        payload.ngo_type = form.ngo_type;
      }
      await registerUser(payload);
      setSuccessMsg('Registration successful! Please login.');
      setTimeout(() => navigate('/login/' + role), 1200);
    } catch (ex) {
      setErrors({ _submit: ex.message });
    } finally {
      setWorking(false);
    }
  };

  const input = (key, label, type = 'text', required = true, placeholder = '') => (
    <div className="form-group">
      <label className={required ? 'required' : ''}>{label}</label>
      <input type={type} value={form[key]} onChange={(e) => update(key, e.target.value)} placeholder={placeholder} />
      {errors[key] && <div className="form-error">{errors[key]}</div>}
    </div>
  );

  return (
    <div className="form-container">
      <h2>Register as {ROLE_TITLES[role]}</h2>
      {successMsg && <div className="form-success">{successMsg}</div>}
      {errors._submit && <div className="form-error" style={{marginBottom:12,padding:10,background:'#fdecea',borderRadius:8}}>{errors._submit}</div>}

      <div style={{background:'#eaf6ff', padding:12, borderRadius:10, marginBottom:16, borderLeft:'4px solid #3498db', fontSize:13, color:'#1f4e79'}}>
        <strong>💡 Why structured address?</strong> Street, Area, Landmark, and a valid 6-digit Pincode help us connect ONLY nearby restaurants, NGOs, and agents. For example, a Mumbai (400xxx) restaurant will never be matched with a Delhi (110xxx) NGO — keeps deliveries local and fast.
      </div>

      <form onSubmit={submit}>
        {input('full_name', 'Full Name')}
        <div className="form-group">
          <label className="required">Contact Number (10 digits)</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={form.contact}
            onChange={(e) => update('contact', e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="98xxxxxxxx"
          />
          {errors.contact && <div className="form-error">{errors.contact}</div>}
        </div>
        {input('email', 'Email (optional)', 'email', false)}

        {role === 'restaurant' && (
          <>
            {input('restaurant_name', 'Restaurant / Hotel Name', 'text', true, 'e.g. Swayam Restaurant')}
            <div className="form-group">
              <label className="required">FSSAI License Number (compulsory)</label>
              <input
                type="text"
                value={form.fssai_license}
                onChange={(e) => update('fssai_license', e.target.value)}
                placeholder="e.g. 12345678901234 (14-digit)"
              />
              {errors.fssai_license && <div className="form-error">{errors.fssai_license}</div>}
            </div>
          </>
        )}
        {role === 'ngo' && (
          <>
            {input('ngo_name', 'NGO / Shelter Name', 'text', true, 'e.g. Annapurna Shelter')}
            <div className="form-group">
              <label className="required">NGO Type</label>
              <select value={form.ngo_type} onChange={(e) => update('ngo_type', e.target.value)}>
                <option>Shelter</option>
                <option>Orphanage</option>
                <option>Old Age Home</option>
                <option>Community Kitchen</option>
                <option>Other</option>
              </select>
            </div>
          </>
        )}
        {role === 'agent' && input('vehicle_type', 'Vehicle Type (recommended, e.g. Bike / Scooter / Car)', 'text', false, 'Bike')}

        <h4 style={{margin:'20px 0 10px 0', color:'#2c3e50', borderBottom:'2px solid #ecf0f1', paddingBottom:6}}>📍 Address (All fields compulsory)</h4>
        {input('street', 'Street / Building / Plot No.', 'text', true, 'e.g. Main Road, Shop No. 5, Ground Floor')}
        {input('area', 'Area / Locality / Sector', 'text', true, 'e.g. Andheri West, Bandra East')}
        {input('landmark', 'Nearby Landmark', 'text', true, 'e.g. Near Railway Station, Opposite City Mall')}
        {input('pincode', '6-digit Pincode', 'text', true, 'e.g. 400058')}

        {input('password', 'Password (min 6 chars)', 'password')}
        {input('confirm_password', 'Confirm Password', 'password')}

        <button type="submit" className={`btn btn-${role}`} disabled={working}>
          {working ? 'Registering…' : 'Create Account'}
        </button>{' '}
        <Link className="btn btn-outline" to={'/login/' + role}>Already have account? Login</Link>
      </form>
    </div>
  );
}
