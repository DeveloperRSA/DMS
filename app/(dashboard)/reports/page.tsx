'use client';

import { useState, useEffect } from 'react';

interface ReportRow {
  id: string;
  type: string;
  vendorName: string;
  amountInclVat: number;
  vatAmount: number;
  amountExclVat: number;
  documentDate: string;
  status: string;
  currency: string;
  invoiceNumber?: string;
}

interface Totals {
  _sum: { amountInclVat: string | null; vatAmount: string | null };
  _count: number;
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [insights, setInsights] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fetched, setFetched] = useState(false);

  async function fetchReport(withAI = false) {
    if (withAI) setInsightsLoading(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (vendorFilter) params.set('vendor', vendorFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (withAI) params.set('analyze', 'true');
      const res = await fetch(`/api/reports/insights?${params}`);
      const result = await res.json();
      if (res.ok) {
        setData(result.data || []);
        setTotals(result.totals);
        if (result.insights) setInsights(result.insights);
        setFetched(true);
      }
    } finally {
      setLoading(false);
      setInsightsLoading(false);
    }
  }

  useEffect(() => { fetchReport(); }, []);

  const fmt = (n: number | string | null) =>
    n ? Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00';

  // Simple markdown renderer
  function renderMarkdown(text: string) {
    return text
      .replace(/^## (.+)/gm, '<h2>$1</h2>')
      .replace(/^### (.+)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^- (.+)/gm, '<li>$1</li>')
      .replace(/\n\n/g, '<br/><br/>');
  }

  return (
    <div>
      <div className="topbar">
        <span className="topbar-title">Reports & AI Insights</span>
      </div>
      <div className="page-content">

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ width: 220 }}
            placeholder="Filter by vendor name…"
            value={vendorFilter}
            onChange={e => setVendorFilter(e.target.value)}
          />
          <select className="input" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button className="btn btn-secondary" onClick={() => fetchReport(false)} disabled={loading}>
            {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Loading…</> : '↻ Run Report'}
          </button>
          <button className="btn btn-primary" onClick={() => fetchReport(true)} disabled={insightsLoading}>
            {insightsLoading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Analyzing…</> : '✦ Analyze with AI'}
          </button>
        </div>

        {/* Totals */}
        {totals && (
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-label">Total Records</div>
              <div className="stat-value">{totals._count}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Amount (incl. VAT)</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{fmt(totals._sum.amountInclVat)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total VAT</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{fmt(totals._sum.vatAmount)}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
          {/* Table */}
          <div className="card">
            <div className="card-header"><span className="card-title">Transaction Ledger</span></div>
            <div className="table-wrap">
              {!fetched ? (
                <div className="empty-state"><div className="empty-state-icon">📊</div><div className="empty-state-title">Run a report to see data</div></div>
              ) : data.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">🔍</div><div className="empty-state-title">No records match your filters</div></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Vendor</th>
                      <th>Type</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(row => (
                      <tr key={row.id}>
                        <td className="td-mono">{new Date(row.documentDate).toLocaleDateString()}</td>
                        <td>
                          <div className="td-primary">{row.vendorName}</div>
                          {row.invoiceNumber && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{row.invoiceNumber}</div>}
                        </td>
                        <td>
                          <span className={`badge ${row.type === 'INVOICE' ? 'badge-invoice' : 'badge-credit'}`}>
                            {row.type === 'INVOICE' ? 'Invoice' : 'Credit Note'}
                          </span>
                        </td>
                        <td className="td-mono" style={{ textAlign: 'right' }}>
                          {row.currency} {fmt(row.amountInclVat)}
                        </td>
                        <td>
                          <span className={`badge badge-${row.status.toLowerCase()}`}>{row.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* AI Insights */}
          <div className="insights-panel">
            <div className="insights-tag">✦ Gemini AI</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Autonomous Insights</div>
            {insightsLoading ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <div className="spinner" /> Analyzing ledger…
              </div>
            ) : insights ? (
              <div
                className="insights-content"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(insights) }}
              />
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Click <strong style={{ color: 'var(--accent)' }}>Analyze with AI</strong> to get automated anomaly detection, spending patterns, and VAT optimization insights from your ledger data.
              </div>
            )}
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #1a2540', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              Powered by Gemini 2.5 Flash · Financial Forensics Engine
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
