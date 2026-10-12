import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { docsApi, uploadApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import './DashboardPage.css';

function formatDate(ts) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [owned, setOwned] = useState([]);
  const [shared, setShared] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const importRef = useRef(null);

  const load = async () => {
    try {
      const res = await docsApi.list();
      setOwned(res.data.owned);
      setShared(res.data.shared);
    } catch {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleNew = async () => {
    try {
      const res = await docsApi.create('Untitled Document');
      navigate(`/doc/${res.data.id}`);
    } catch {
      setError('Failed to create document');
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    try {
      await docsApi.delete(id);
      setOwned(prev => prev.filter(d => d.id !== id));
    } catch {
      setError('Failed to delete document');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadApi.importFile(file);
      navigate(`/doc/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed. Only .txt and .md files are supported.');
    } finally {
      setUploading(false);
      if (importRef.current) importRef.current.value = '';
    }
  };

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-logo">
          <svg viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="#2563EB"/>
            <path d="M12 28V12h10a6 6 0 0 1 0 12H12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>AjaiaDocs</span>
        </div>
        <div className="dash-user">
          <span className="avatar">{user?.name[0]}</span>
          <span className="user-name">{user?.name}</span>
          <button className="btn-ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-toolbar">
          <h2>My Documents</h2>
          <div className="dash-actions">
            <label className="btn-secondary" title="Import .txt or .md file">
              {uploading ? 'Importing…' : '↑ Import file'}
              <input
                ref={importRef}
                type="file"
                accept=".txt,.md,.markdown"
                style={{ display: 'none' }}
                onChange={handleImport}
                disabled={uploading}
              />
            </label>
            <button className="btn-primary" onClick={handleNew}>+ New document</button>
          </div>
        </div>

        <p className="import-hint">Supported import formats: .txt, .md</p>

        {error && (
          <div className="dash-error">
            {error}
            <button onClick={() => setError('')}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="loading">Loading…</div>
        ) : (
          <>
            {owned.length === 0 && shared.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <h3>No documents yet</h3>
                <p>Create your first document or import a file to get started.</p>
                <button className="btn-primary" onClick={handleNew}>Create document</button>
              </div>
            ) : (
              <>
                {owned.length > 0 && (
                  <section className="doc-section">
                    <h3 className="section-label">Owned by me</h3>
                    <div className="doc-grid">
                      {owned.map(doc => (
                        <DocCard
                          key={doc.id}
                          doc={doc}
                          onClick={() => navigate(`/doc/${doc.id}`)}
                          onDelete={e => handleDelete(doc.id, e)}
                          showDelete
                        />
                      ))}
                    </div>
                  </section>
                )}

                {shared.length > 0 && (
                  <section className="doc-section">
                    <h3 className="section-label">Shared with me</h3>
                    <div className="doc-grid">
                      {shared.map(doc => (
                        <DocCard
                          key={doc.id}
                          doc={doc}
                          onClick={() => navigate(`/doc/${doc.id}`)}
                          showDelete={false}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function DocCard({ doc, onClick, onDelete, showDelete }) {
  const preview = doc.content.replace(/<[^>]*>/g, '').slice(0, 100);
  return (
    <div className="doc-card" onClick={onClick}>
      <div className="doc-card-header">
        <div className="doc-icon">📄</div>
        {showDelete && (
          <button className="doc-delete-btn" onClick={onDelete} title="Delete document">✕</button>
        )}
      </div>
      <div className="doc-title">{doc.title}</div>
      <div className="doc-preview">{preview || 'Empty document'}</div>
      <div className="doc-meta">
        <span className={`doc-badge ${doc.role === 'owner' ? 'badge-owner' : 'badge-shared'}`}>
          {doc.role === 'owner' ? 'Owner' : `Shared (${doc.role})`}
        </span>
        <span className="doc-date">{formatDate(doc.updated_at)}</span>
      </div>
    </div>
  );
}
