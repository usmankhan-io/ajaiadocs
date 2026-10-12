import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

const DEMO_ACCOUNTS = [
  { email: 'alice@example.com', name: 'Alice Johnson' },
  { email: 'bob@example.com',   name: 'Bob Smith' },
  { email: 'carol@example.com', name: 'Carol Williams' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('alice@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      login(res.data.user);
      navigate('/');
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="8" fill="#2563EB"/>
            <path d="M12 28V12h10a6 6 0 0 1 0 12H12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>AjaiaDocs</span>
        </div>
        <h1>Sign in</h1>
        <p className="login-subtitle">Use a demo account to get started</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="demo-accounts">
          <p>Demo accounts (password: <code>password123</code>)</p>
          <div className="demo-list">
            {DEMO_ACCOUNTS.map(a => (
              <button
                key={a.email}
                className="demo-account-btn"
                type="button"
                onClick={() => { setEmail(a.email); setPassword('password123'); }}
              >
                <span className="avatar">{a.name[0]}</span>
                <span>
                  <strong>{a.name}</strong>
                  <small>{a.email}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
