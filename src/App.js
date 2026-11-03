import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppContext } from './context/AppContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import RestaurantDashboard from './pages/RestaurantDashboard';
import AgentDashboard from './pages/AgentDashboard';
import NgoDashboard from './pages/NgoDashboard';
import PostFood from './pages/PostFood';
import MapPage from './pages/MapPage';
import Profile from './pages/Profile';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

/*
  Full workflow for student viva (run these steps to demo end-to-end):
  1. Open Home -> Click "Register" under Restaurant (or use seeded: 9800000001 / password123)
  2. Login as Restaurant -> Go to "Post Food" -> fill fields, tick all 4 safety boxes + confirm -> Submit
  3. Logout -> Register / Login as NGO (seeded: 9800000003 / password123)
  4. NGO Dashboard -> Nearby Available Food -> click Accept (food moves to "NGO Accepted")
  5. Logout -> Register / Login as Delivery Agent (seeded: 9800000002 / password123)
  6. Agent Dashboard -> Available Pickup Requests (nearest first) -> Accept Pickup
  7. Agent clicks "Confirm Pickup" (at restaurant) -> status = Picked Up
  8. Agent clicks "Confirm Delivery" (at NGO) -> status = Delivered / Donated
  9. Open Map page -> See markers for Restaurant (red), NGO (green), Agent (blue) + colored route
  10. Refresh any page -> all data is preserved (stored in SQLite via backend API + local cache)
*/

function DashboardRouter() {
  const { currentUser, loading } = useAppContext();
  if (loading) return <div className="form-container"><h2>Loading…</h2></div>;
  if (!currentUser) return <Navigate to="/" replace />;
  if (currentUser.role === 'restaurant') return <RestaurantDashboard />;
  if (currentUser.role === 'agent') return <AgentDashboard />;
  if (currentUser.role === 'ngo') return <NgoDashboard />;
  return <Navigate to="/" replace />;
}

function Protected({ children }) {
  const { currentUser, loading } = useAppContext();
  if (loading) return <div className="form-container"><h2>Loading…</h2></div>;
  if (!currentUser) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <div className="app">
      <ErrorBoundary>
        <Navbar />
        <div className="content">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login/:role" element={<Login />} />
              <Route path="/register/:role" element={<Register />} />
              <Route path="/dashboard" element={<ErrorBoundary><DashboardRouter /></ErrorBoundary>} />
              <Route
                path="/post-food"
                element={
                  <Protected>
                    <ErrorBoundary><PostFood /></ErrorBoundary>
                  </Protected>
                }
              />
              <Route path="/map" element={<ErrorBoundary><MapPage /></ErrorBoundary>} />
              <Route
                path="/profile"
                element={
                  <Protected>
                    <ErrorBoundary><Profile /></ErrorBoundary>
                  </Protected>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </ErrorBoundary>
    </div>
  );
}

export default App;
