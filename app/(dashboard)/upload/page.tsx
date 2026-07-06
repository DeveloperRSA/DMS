'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface ExtractedData {
  type: string;
  invoiceNumber?: string;
  vendorName: string;
  documentDate: string;
  amountExclVat: number;
  vatAmount: number;
  amountInclVat: number;
  currency: string;
}

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<'idle' | 'extracting' | 'review' | 'uploading' | 'done' | 'error'>('idle');
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [error, setError] = useState('');
  const [docId, setDocId] = useState('');

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setStage('idle');
    setExtracted(null);
    setError('');
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  async function extractAndPreview() {
    if (!file) return;
    setStage('extracting');
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.status === 409) {
        setError(`Duplicate detected: ${data.reason?.replace('_', ' ')} — existing document ID: ${data.existingDocumentId}`);
        setStage('error');
        return;
      }
      if (!res.ok) { setError(data.error || 'Extraction failed'); setStage('error'); return; }
      setExtracted(data.extractedData);
      setDocId(data.document.id);
      setStage('done');
    } catch {
      setError('Network error during upload');
      setStage('error');
    }
  }

  const fmt = (n: number) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div>
      <div className="topbar">
        <span className="topbar-title">Upload Document</span>
      </div>
      <div className="page-content" style={{ maxWidth: 720 }}>

        {/* Drop zone */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Select File</span></div>
          <div className="card-body">
            <div
              className={`upload-zone ${dragging ? 'dragging' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <div className="upload-icon">📎</div>
              {file ? (
                <>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB — click to change</div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Drop a file here or click to browse</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>PDF, JPEG, PNG, WebP — max 10MB</div>
                </>
              )}
            </div>

            {file && stage === 'idle' && (
              <button className="btn btn-primary" style={{ marginTop: 16, width: '100%' }} onClick={extractAndPreview}>
                ✦ Extract & Upload with AI
              </button>
            )}

            {stage === 'extracting' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
                <div className="spinner" />
                Gemini AI is extracting document data…
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Success */}
        {stage === 'done' && extracted && (
          <div>
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              Document uploaded and queued for approval (ID: <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{docId}</code>)
            </div>
            <div className="card">
              <div className="card-header">
                <span className="card-title">✦ AI-Extracted Data</span>
                <span className={`badge ${extracted.type === 'INVOICE' ? 'badge-invoice' : 'badge-credit'}`}>{extracted.type}</span>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {[
                    ['Vendor', extracted.vendorName],
                    ['Invoice #', extracted.invoiceNumber || '—'],
                    ['Document Date', extracted.documentDate],
                    ['Currency', extracted.currency],
                    ['Amount (excl. VAT)', `${extracted.currency} ${fmt(extracted.amountExclVat)}`],
                    ['VAT Amount', `${extracted.currency} ${fmt(extracted.vatAmount)}`],
                    ['Amount (incl. VAT)', `${extracted.currency} ${fmt(extracted.amountInclVat)}`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{k}</div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={() => router.push('/documents')}>View All Documents →</button>
                  <button className="btn btn-secondary" onClick={() => { setFile(null); setStage('idle'); setExtracted(null); }}>Upload Another</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
