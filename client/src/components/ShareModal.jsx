import React, { useState, useEffect } from 'react';
import { docsApi, authApi } from '../api';
import './ShareModal.css';

export default function ShareModal({ doc, onClose, onUpdate }) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('edit');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sharing, setSharing] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    authApi.listUsers()
      .then(r => setAllUsers(r.data))
      .catch(() => {}); // non-critical
  }, []);

  const handleShare = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setSuccess('');
    setSharing(true);
    try {
      await docsApi.share(doc.id, email.trim(), permission);
      setSuccess(`Shared with ${email}`);
      setEmail('');
      onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  const handleRevoke = async (shareId) => {
    setRevoking(shareId);
    try {
      await docsApi.revokeShare(doc.id, shareId);
      onUpdate();
    } catch {
      setError('Failed to revoke access');
    } finally {
      setRevoking(null);
    }
  };

  // Users not yet shared with (excluding the owner)
  const unsharedUsers = allUsers.filter(u =>
    u.id !== doc.owner_id &&
    !doc.shares?.some(s => s.user_id === u.id)
  );

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <h2>Share "{doc.title}"</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleShare} className="share-form">
          <div className="share-inputs">
            <div className="share-email-wrap">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter email address"
                list="user-emails"
                required
              />
              <datalist id="user-emails">
                {unsharedUsers.map(u => (
                  <option key={u.id} value={u.email} label={u.name} />
                ))}
              </datalist>
            </div>
            <select value={permission} onChange={e => setPermission(e.target.value)}>
              <option value="edit">Can edit</option>
              <option value="view">Can view</option>
            </select>
            <button type="submit" className="btn-share-send" disabled={sharing}>
              {sharing ? 'Sharing…' : 'Share'}
            </button>
          </div>
          {error && <div className="share-error">{error}</div>}
          {success && <div className="share-success">{success}</div>}
        </form>

        <div className="share-current">
          <h3>People with access</h3>

          {/* Owner row */}
          <div className="share-person owner-row">
            <span className="avatar-sm">{doc.owner_name[0]}</span>
            <div className="share-person-info">
              <span className="share-person-name">{doc.owner_name}</span>
              <span className="share-person-role">Owner</span>
            </div>
          </div>

          {doc.shares?.length > 0 ? (
            doc.shares.map(s => (
              <div key={s.id} className="share-person">
                <span className="avatar-sm">{s.name[0]}</span>
                <div className="share-person-info">
                  <span className="share-person-name">{s.name}</span>
                  <span className="share-person-email">{s.email}</span>
                </div>
                <span className={`share-badge ${s.permission}`}>{s.permission}</span>
                <button
                  className="revoke-btn"
                  onClick={() => handleRevoke(s.id)}
                  disabled={revoking === s.id}
                >
                  {revoking === s.id ? '…' : 'Remove'}
                </button>
              </div>
            ))
          ) : (
            <p className="no-shares">Not shared with anyone yet.</p>
          )}
        </div>

        {unsharedUsers.length > 0 && (
          <div className="quick-share">
            <p className="quick-share-label">Quick add</p>
            <div className="quick-share-list">
              {unsharedUsers.map(u => (
                <button
                  key={u.id}
                  type="button"
                  className="quick-share-btn"
                  onClick={() => setEmail(u.email)}
                >
                  <span className="avatar-sm">{u.name[0]}</span>
                  <span>{u.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
