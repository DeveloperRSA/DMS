'use client';

import { useEffect, useState, useCallback } from 'react';

interface Document {
  id: string;
  type: string;
  vendorName: string;
  invoiceNumber?: string;
  fileName: string;
  amountInclVat: number;
  currency: string;
  status: string;
  currentStep: string;
  documentDate: string;
  createdAt: string;
  approvals: any[];
}

interface WorkflowModalState {
  doc: Document | null;
  action: 'APPROVE' | 'REJECT' | null;
}

const STEPS = ['REVIEWER', 'MANAGER', 'FINANCE_ADMIN', 'COMPLETED'];
const STEP_LABELS: Record<string, string> = {
  REVIEWER: 'Reviewer',
  MANAGER: 'Manager',
  FINANCE_ADMIN: 'Finance Admin',
  COMPLETED: 'Completed',
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState<WorkflowModalState>({ doc: null, action: null });
  const [comments, setComments] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [user, setUser] = useState<any>(null);
  const [detailDoc, setDetailDoc] = useState<any>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.user));
  }, []);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('type', typeFilter);
    const res = await fetch(`/api/documents/upload?${params}`);
    const data = await res.json();
    if (res.ok) { setDocuments(data.documents); setTotal(data.total); }
    setLoading(false);
  }, [statusFilter, typeFilter]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  async function openDetail(id: string) {
    const res = await fetch(`/api/documents/${id}`);
    const data = await res.json();
    if (res.ok) setDetailDoc(data.document);
  }

  async function submitWorkflow() {
    if (!modal.doc || !modal.action) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/documents/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: modal.doc.id, action: modal.action, comments }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(`Error: ${data.error}`); return; }
      showToast(`Document ${modal.action === 'APPROVE' ? 'approved' : 'rejected'} successfully`);
      setModal({ doc: null, action: null });
      setComments('');
      fetchDocs();
    } finally {
      setActionLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  const canAction = (doc: Document) =>
    doc.status === 'PENDING' &&
    user && (user.role === 'ADMIN' || (user.role === 'APPROVER' && doc.currentStep !== 'FINANCE_ADMIN'));

  const statusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  documents.forEach(d => { if (statusCounts[d.status as keyof typeof statusCounts] !== undefined) statusCounts[d.status as keyof typeof statusCounts]++; });

  return (
    <div>
      <div className="topbar">
        <span className="topbar-title">Documents</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total} total</span>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid">
          {[
            { label: 'Total', value: total, color: 'var(--text-primary)' },
            { label: 'Pending', value: statusCounts.PENDING, color: 'var(--amber)' },
            { label: 'Approved', value: statusCounts.APPROVED, color: 'var(--green)' },
            { label: 'Rejected', value: statusCounts.REJECTED, color: 'var(--red)' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <select className="input" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select className="input" style={{ width: 160 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="INVOICE">Invoice</option>
            <option value="CREDIT_NOTE">Credit Note</option>
          </select>
          <button className="btn btn-secondary" onClick={fetchDocs}>↻ Refresh</button>
        </div>

        {/* Table */}
        <div className="card">
          <div className="table-wrap">
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <div className="spinner" /> Loading documents…
              </div>
            ) : documents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📂</div>
                <div className="empty-state-title">No documents found</div>
                <div className="empty-state-text">Upload your first document to get started</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Vendor / Invoice</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Amount (incl. VAT)</th>
                    <th>Workflow Step</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id}>
                      <td>
                        <div className="td-primary">{doc.vendorName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{doc.invoiceNumber || doc.fileName}</div>
                      </td>
                      <td>
                        <span className={`badge ${doc.type === 'INVOICE' ? 'badge-invoice' : 'badge-credit'}`}>
                          {doc.type === 'INVOICE' ? 'Invoice' : 'Credit Note'}
                        </span>
                      </td>
                      <td className="td-mono">{new Date(doc.documentDate).toLocaleDateString()}</td>
                      <td className="td-mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {doc.currency} {Number(doc.amountInclVat).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{STEP_LABELS[doc.currentStep] || doc.currentStep}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${doc.status.toLowerCase()}`}>{doc.status}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openDetail(doc.id)}>View</button>
                          {canAction(doc) && (
                            <>
                              <button className="btn btn-green btn-sm" onClick={() => { setModal({ doc, action: 'APPROVE' }); setComments(''); }}>✓</button>
                              <button className="btn btn-red btn-sm" onClick={() => { setModal({ doc, action: 'REJECT' }); setComments(''); }}>✗</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Workflow Modal */}
      {modal.doc && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setModal({ doc: null, action: null }); }}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">
                {modal.action === 'APPROVE' ? '✓ Approve Document' : '✗ Reject Document'}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setModal({ doc: null, action: null })}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{modal.doc.vendorName}</strong> — {modal.doc.invoiceNumber || modal.doc.fileName}
              </p>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Current step</div>
                <div className="workflow-steps">
                  {STEPS.slice(0, 3).map((step, i) => {
                    const stepIndex = STEPS.indexOf(modal.doc!.currentStep);
                    const isDone = i < stepIndex;
                    const isActive = i === stepIndex;
                    return (
                      <div key={step} className="workflow-step">
                        <div className={`step-dot ${isDone ? 'done' : isActive ? 'active' : ''}`}>{isDone ? '✓' : i + 1}</div>
                        {i < 2 && <div className={`step-line ${isDone ? 'done' : ''}`} />}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  <span>Reviewer</span><span>Manager</span><span>Finance Admin</span>
                </div>
              </div>
              <div className="form-group">
                <label className="label">Comments {modal.action === 'REJECT' && <span style={{ color: 'var(--red)' }}>*</span>}</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder={modal.action === 'APPROVE' ? 'Optional note…' : 'Reason for rejection (required)'}
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal({ doc: null, action: null })}>Cancel</button>
              <button
                className={`btn ${modal.action === 'APPROVE' ? 'btn-green' : 'btn-red'}`}
                onClick={submitWorkflow}
                disabled={actionLoading || (modal.action === 'REJECT' && !comments.trim())}
              >
                {actionLoading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Processing…</> : modal.action === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailDoc && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setDetailDoc(null); }}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <div className="modal-title">Document Detail</div>
              <button className="btn btn-secondary btn-sm" onClick={() => setDetailDoc(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  ['Vendor', detailDoc.vendorName],
                  ['Type', detailDoc.type],
                  ['Invoice #', detailDoc.invoiceNumber || '—'],
                  ['Date', new Date(detailDoc.documentDate).toLocaleDateString()],
                  ['Excl. VAT', `${detailDoc.currency} ${Number(detailDoc.amountExclVat).toFixed(2)}`],
                  ['VAT', `${detailDoc.currency} ${Number(detailDoc.vatAmount).toFixed(2)}`],
                  ['Incl. VAT', `${detailDoc.currency} ${Number(detailDoc.amountInclVat).toFixed(2)}`],
                  ['Status', detailDoc.status],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
              </div>

              {detailDoc.approvals?.length > 0 && (
                <>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--text-secondary)' }}>APPROVAL HISTORY</div>
                  {detailDoc.approvals.map((a: any) => (
                    <div key={a.id} className="audit-item">
                      <div className={`audit-dot`} style={{ background: a.status === 'APPROVED' ? 'var(--green)' : 'var(--red)' }} />
                      <div>
                        <div className="audit-action">{STEP_LABELS[a.step]} — {a.status}</div>
                        <div className="audit-details">{a.user.name} — {a.comments || 'No comment'}</div>
                        <div className="audit-meta">{new Date(a.actionedAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {detailDoc.auditLogs?.length > 0 && (
                <>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, marginTop: 16, color: 'var(--text-secondary)' }}>AUDIT TRAIL</div>
                  {detailDoc.auditLogs.slice(0, 8).map((l: any) => (
                    <div key={l.id} className="audit-item">
                      <div className="audit-dot" />
                      <div>
                        <div className="audit-action">{l.action}</div>
                        <div className="audit-details">{l.details}</div>
                        <div className="audit-meta">{l.user?.name || 'System'} · {new Date(l.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)',
          borderRadius: 8, padding: '12px 18px', fontSize: 13, color: 'var(--text-primary)', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
