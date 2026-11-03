/*
  Home Page
  ----------
  - If user is already logged in, redirect to their dashboard immediately.
  - Otherwise show hero + 3 role cards (Restaurant / Agent / NGO), each with Login/Register buttons.
  - A big "View Live Map" button opens the MapPage, which shows markers even for anonymous visitors.
*/
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useEffect } from 'react';

export default function Home() {
  const ctx = useAppContext();
  const currentUser = ctx?.currentUser || null;
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) navigate('/dashboard', { replace: true });
  }, [currentUser, navigate]);

  const roles = [
    {
      key: 'restaurant',
      title: 'Restaurant',
      icon: '🍴',
      desc: 'You own or manage a restaurant and want to donate leftover food to the needy instead of throwing it away.',
      color: 'restaurant',
    },
    {
      key: 'agent',
      title: 'Delivery Agent',
      icon: '🛵',
      desc: 'You can pick up packed surplus food from restaurants and safely deliver it to nearby NGOs / shelters.',
      color: 'agent',
    },
    {
      key: 'ngo',
      title: 'NGO / Beneficiary',
      icon: '🏠',
      desc: 'You run an NGO, shelter, orphanage or community kitchen and need food donations for people you support.',
      color: 'ngo',
    },
  ];

  return (
    <div>
      <div className="hero">
        <h1>🍽️ FoodConnect</h1>
        <p>Donate Surplus Food · Feed the Needy · Reduce Wastage — a real-time platform for Restaurants · Delivery Agents · NGOs</p>
      </div>

      <div className="roles-grid">
        {(roles || []).map((r) => (
          r && <div key={r.key} className={`role-card ${r.color}`}>
            <div className="role-icon">{r.icon}</div>
            <h3>I am a {r.title}</h3>
            <p className="food-meta">{r.desc}</p>
            <div className="card-actions">
              <Link className={`btn btn-${r.color}`} to={`/register/${r.key}`}>Register</Link>
              <Link className="btn btn-outline" to={`/login/${r.key}`}>Login</Link>
            </div>
          </div>
        ))}
      </div>

      <div className="map-btn-wrap">
        <Link to="/map">
          <button className="big-map-btn">🗺️ View Live Food Donation Map</button>
        </Link>
      </div>
    </div>
  );
}
