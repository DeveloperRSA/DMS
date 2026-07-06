'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

interface User { id: string; name: string; email: string; role: string; }

const NAV = [
  { href: '/documents', icon: '📄', label: 'Documents' },
  { href: '/upload', icon: '⬆', label: 'Upload' },
  { href: '/reports', icon: '📊', label: 'Reports & Insights' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.user) setUser(d.user); else router.push('/'); })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /><span>Loading…</span></div>;
  if (!user) return null;

  const initials = user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">D</div>
          <div>
            <div className="logo-text">DocVault</div>
            <div className="logo-sub">DMS Platform</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Workspace</div>
          {NAV.map(item => (
            <Link key={item.href} href={item.href} className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.role}</div>
            </div>
          </div>
          <button className="nav-item" onClick={logout} style={{ color: 'var(--red)', width: '100%' }}>
            <span style={{ fontSize: 15 }}>↩</span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
