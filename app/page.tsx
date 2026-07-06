'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      router.push('/documents');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(role: string) {
    const creds: Record<string, [string, string]> = {
      admin: ['admin@dms.local', 'Admin@123'],
      approver: ['approver@dms.local', 'Approver@123'],
      viewer: ['viewer@dms.local', 'Viewer@123'],
    };
    setEmail(creds[role][0]);
    setPassword(creds[role][1]);
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">D</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>DocVault</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>DMS Platform</div>
          </div>
        </div>

        <div className="login-title">Welcome back</div>
        <div className="login-sub">Sign in to access your document workspace</div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="label">Email address</label>
            <input
              className="input"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '10px' }}>
            {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Signing in…</> : 'Sign in'}
          </button>
        </form>

        <div className="demo-creds">
          <strong>Demo accounts — click to fill:</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['admin', 'approver', 'viewer'].map(r => (
              <button key={r} onClick={() => fillDemo(r)} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--mono)' }}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
