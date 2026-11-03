/*
  Navbar Component
  ----------------
  - Always visible at the top of every page
  - Links change depending on:
    (a) whether anyone is logged in, and
    (b) which role the logged-in user is
  - Logout button clears the session via AppContext
*/
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { ROLES } from '../utils/constants';

export default function Navbar() {
  const ctx = useAppContext();
  const currentUser = ctx?.currentUser || null;
  const logout = ctx?.logout || (() => {});
  const navigate = useNavigate();

  const roleLabel = {
    [ROLES.RESTAURANT]: 'Restaurant',
    [ROLES.AGENT]: 'Delivery Agent',
    [ROLES.NGO]: 'NGO / Beneficiary',
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">🍽️ FoodConnect</Link>
      <div className="navbar-links">
        {!currentUser && (
          <>
            <Link to="/">Home</Link>
            <Link to="/map">Live Map</Link>
          </>
        )}
        {currentUser && (
          <>
            <Link to="/dashboard">Dashboard</Link>
            {currentUser?.role === ROLES.RESTAURANT && (
              <Link to="/post-food">Post Food</Link>
            )}
            <Link to="/map">Live Map</Link>
            <Link to="/profile">Profile ({roleLabel[currentUser?.role] || currentUser?.role || ''})</Link>
            <button onClick={handleLogout}>Logout</button>
          </>
        )}
      </div>
    </nav>
  );
}
