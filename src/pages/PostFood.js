/*
  Post Food Page (Restaurant only, protected route)
  --------------------------------------------------
  Restaurant user fills in leftover food details.
  Before they can submit, the 4-point Food Safety checklist must be fully ticked
  PLUS the final "I confirm" checkbox. This enforces food safety compliance as required.

  Flow:
    submit → validate fields + safety checked → addFoodPost() → redirect to dashboard
*/
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { FOOD_STATUS } from '../utils/constants';

const SAFETY_CHECKS = [
  { key: 'temp', label: 'Food is stored at safe temperature (< 5°C for cold / > 60°C for hot)' },
  { key: 'pack', label: 'Food is properly covered and packaged (sealed containers/bags)' },
  { key: 'expiry', label: 'Food is not past visual / sensory expiry (no bad smell, mould, or slime)' },
  { key: 'hygiene', label: 'All handlers followed hand hygiene (washed hands, gloves used where needed)' },
];

function dtInputDefault(offsetHours = 0) {
  const d = new Date(Date.now() + offsetHours * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PostFood() {
  const { currentUser, addFoodPost } = useAppContext();
  const navigate = useNavigate();

  const [food_type, setFoodType] = useState('Veg - ');
  const [quantity, setQuantity] = useState(20);
  const [quantity_unit, setQtyUnit] = useState('servings');
  const [description, setDescription] = useState('');
  const [pickup_start, setPickupStart] = useState(dtInputDefault(0));
  const [pickup_end, setPickupEnd] = useState(dtInputDefault(3));
  const [expiry, setExpiry] = useState(dtInputDefault(8));

  const [checks, setChecks] = useState({ temp: false, pack: false, expiry: false, hygiene: false });
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  const [working, setWorking] = useState(false);

  const allSafetyChecked = SAFETY_CHECKS.every((c) => checks[c.key]);
  const canSubmit = allSafetyChecked && confirm && !working;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!currentUser) { setErr('You must be logged in as Restaurant'); return; }
    if (!canSubmit) { setErr('Please tick ALL food safety guidelines and confirm.'); return; }
    if (quantity < 1) { setErr('Quantity must be at least 1'); return; }
    if (new Date(pickup_end) <= new Date(pickup_start)) { setErr('Pickup end must be after start'); return; }
    if (new Date(expiry) <= new Date()) { setErr('Expiry must be in the future'); return; }

    setWorking(true);
    try {
      await addFoodPost({
        restaurant_id: currentUser.id,
        food_type: food_type.trim(),
        quantity: Number(quantity),
        quantity_unit,
        description: description.trim() || null,
        pickup_start,
        pickup_end,
        expiry,
        status: FOOD_STATUS.AVAILABLE,
        restaurant_lat: currentUser.latitude,
        restaurant_lng: currentUser.longitude,
      });
      navigate('/dashboard');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="form-container" style={{ maxWidth: 720 }}>
      <h2>Post Leftover Food</h2>
      {err && <div className="form-error" style={{marginBottom:12,padding:10,background:'#fdecea',borderRadius:8}}>{err}</div>}

      <form onSubmit={submit}>
        <h3 style={{marginTop:0}}>Food Details</h3>

        <div className="form-group">
          <label className="required">Food Type / Category</label>
          <input value={food_type} onChange={(e) => setFoodType(e.target.value)} placeholder="e.g. Veg - Rice & Curry, Non-Veg - Chicken Biryani" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="required">Quantity</label>
            <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="required">Unit</label>
            <select value={quantity_unit} onChange={(e) => setQtyUnit(e.target.value)}>
              <option value="servings">servings</option>
              <option value="kg">kg</option>
              <option value="plates">plates</option>
              <option value="boxes">boxes</option>
              <option value="packets">packets</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Short Description (optional)</label>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Home-style Punjabi thali. Still warm, packed in disposable boxes." />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="required">Pickup Available From</label>
            <input type="datetime-local" value={pickup_start} onChange={(e) => setPickupStart(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="required">Pickup Available Until</label>
            <input type="datetime-local" value={pickup_end} onChange={(e) => setPickupEnd(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="required">Food Expiry Date/Time</label>
          <input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </div>

        <div className="safety-section">
          <h4>⚠️ Food Safety Guidelines — all boxes MUST be ticked before posting:</h4>
          {SAFETY_CHECKS.map((c) => (
            <div key={c.key} className="checkbox-group">
              <input
                type="checkbox"
                id={c.key}
                checked={!!checks[c.key]}
                onChange={(e) => setChecks((p) => ({ ...p, [c.key]: e.target.checked }))}
              />
              <label htmlFor={c.key}>{c.label}</label>
            </div>
          ))}
          <div className="checkbox-group" style={{ marginTop: 14 }}>
            <input
              type="checkbox"
              id="confirm"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            <label htmlFor="confirm" style={{ fontWeight: 600 }}>
              I confirm that all the above food safety guidelines have been followed and the food is safe for human consumption.
            </label>
          </div>
        </div>

        <button type="submit" className="btn btn-restaurant" disabled={!canSubmit}>
          {working ? 'Posting…' : 'Post Food Donation'}
        </button>{' '}
        <button type="button" className="btn btn-outline" onClick={() => navigate('/dashboard')}>Cancel</button>
      </form>
    </div>
  );
}
