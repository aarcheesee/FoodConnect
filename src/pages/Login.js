/*
  Login Page
  -----------
  Takes role from URL (/login/restaurant etc.), asks for Contact + Password.
  On success, AppContext.loginUser() sets currentUser in both state + localStorage.
  Then redirects to /dashboard, which routes the user to their role-specific page.

  Demo seed accounts (if backend was able to seed):
    Restaurant:  9800000001 / password123
    Agent:       9800000002 / password123
    NGO:         9800000003 / password123
*/
import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const ROLE_TITLES = {
  restaurant: 'Restaurant',
  agent: 'Delivery Agent',
  ngo: 'NGO / Beneficiary',
};

export default function Login() {
  const { role } = useParams();
  const navigate = useNavigate();
  const { loginUser } = useAppContext();

  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [working, setWorking] = useState(false);

  if (!['restaurant', 'agent', 'ngo'].includes(role)) {
    return <div className="form-container"><h2>Invalid role</h2><Link className="btn btn-primary" to="/">Go Home</Link></div>;
  }

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!contact || !password) { setErr('Contact and password are required'); return; }
    setWorking(true);
    try {
      await loginUser(contact.trim(), password, role);
      navigate('/dashboard');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="form-container">
      <h2>{ROLE_TITLES[role]} Login</h2>
      {err && <div className="form-error" style={{marginBottom:12,padding:10,background:'#fdecea',borderRadius:8}}>{err}</div>}
      <div style={{fontSize:12,color:'#566573',marginBottom:14,background:'#eafaf1',padding:8,borderRadius:6}}>
        Demo accounts: Restaurant 9800000001 | Agent 9800000002 | NGO 9800000003 (password: <code>password123</code>)
      </div>
      <form onSubmit={submit}>
        <div className="form-group">
          <label className="required">Contact Number</label>
          <input type="tel" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="98xxxxxxxx" />
        </div>
        <div className="form-group">
          <label className="required">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" className={`btn btn-${role}`} disabled={working}>
          {working ? 'Logging in…' : 'Login'}
        </button>{' '}
        <Link className="btn btn-outline" to={'/register/' + role}>New user? Register</Link>
      </form>
    </div>
  );
}
