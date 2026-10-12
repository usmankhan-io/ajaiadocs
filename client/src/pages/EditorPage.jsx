import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { docsApi, uploadApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import ShareModal from '../components/ShareModal';
import './EditorPage.css';

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth(); // currently logged-in user

  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [attachUploading, setAttachUploading] = useState(false);
  const attachRef = useRef(null);
  const titleSaveTimer = useRef(null);
  const contentSaveTimer = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: '',
    onUpdate: () => setSaveStatus('unsaved'),
    editable: true,
  });

  // Load document
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    docsApi.get(id)
      .then(res => {
        const d = res.data;
        setDoc(d);
        setTitle(d.title);
        editor?.commands.setContent(d.content || '');
        setSaveStatus('saved');
        editor?.setEditable(d.role !== 'view');
      })
      .catch(() => setError('Document not found or you do not have access.'))
      .finally(() => setLoading(false));
  }, [id, editor]);

  // Auto-save content with debounce
  const saveContent = useCallback(async () => {
    if (!id || !editor) return;
    setSaveStatus('saving');
    try {
      await docsApi.update(id, { content: editor.getHTML() });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('unsaved');
    }
  }, [id, editor]);

  useEffect(() => {
    if (saveStatus !== 'unsaved') return;
    clearTimeout(contentSaveTimer.current);
    contentSaveTimer.current = setTimeout(saveContent, 1500);
    return () => clearTimeout(contentSaveTimer.current);
  }, [saveStatus, saveContent]);

  // Save title with debounce
  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = setTimeout(async () => {
      if (!id || !newTitle.trim()) return;
      try {
        await docsApi.update(id, { title: newTitle.trim() });
      } catch { /* title save failures are silent */ }
    }, 1200);
  };

  const handleAttach = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setAttachUploading(true);
    try {
      await uploadApi.attachFile(id, file);
      const res = await docsApi.get(id);
      setDoc(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Attach failed. Only .txt and .md files are supported.');
    } finally {
      setAttachUploading(false);
      if (attachRef.current) attachRef.current.value = '';
    }
  };

  const handleShareUpdate = async () => {
    if (!id) return;
    const res = await docsApi.get(id);
    setDoc(res.data);
  };

  if (loading) return <div className="editor-loading">Loading…</div>;
  if (error) return (
    <div className="editor-error">
      <p>{error}</p>
      <button onClick={() => navigate('/')}>← Back to documents</button>
    </div>
  );

  const canEdit = doc?.role !== 'view';
  const isOwner = doc?.role === 'owner';

  return (
    <div className="editor-page">
      {/* Top bar */}
      <header className="editor-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Docs</button>
        <div className="title-area">
          <input
            className="title-input"
            value={title}
            onChange={handleTitleChange}
            disabled={!canEdit}
            placeholder="Untitled Document"
            aria-label="Document title"
          />
          <span className={`save-status ${saveStatus}`}>
            {saveStatus === 'saving' ? '● Saving…' : saveStatus === 'saved' ? '✓ Saved' : '● Unsaved'}
          </span>
        </div>
        <div className="editor-actions">
          {/* Logged-in user shown on the right */}
          <div className="current-user-info" title={`Signed in as ${user?.name}`}>
            <span className="avatar-sm">{user?.name[0]}</span>
            <span className="current-user-name">{user?.name}</span>
          </div>
          {/* Document owner (if different from current user) */}
          {doc && doc.owner_id !== user?.id && (
            <div className="doc-owner-info" title="Document owner">
              <span className="owner-label">Owner:</span>
              <span>{doc.owner_name}</span>
            </div>
          )}
          {isOwner && (
            <button className="btn-share" onClick={() => setShowShare(true)}>Share</button>
          )}
        </div>
      </header>

      {/* Formatting toolbar */}
      {canEdit && editor && (
        <div className="editor-toolbar">
          <div className="toolbar-group">
            <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
              <b>B</b>
            </ToolbarButton>
            <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
              <i>I</i>
            </ToolbarButton>
            <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
              <u>U</u>
            </ToolbarButton>
          </div>
          <div className="toolbar-sep" />
          <div className="toolbar-group">
            <select
              className="heading-select"
              value={
                editor.isActive('heading', { level: 1 }) ? '1' :
                editor.isActive('heading', { level: 2 }) ? '2' :
                editor.isActive('heading', { level: 3 }) ? '3' : '0'
              }
              onChange={e => {
                const v = e.target.value;
                if (v === '0') editor.chain().focus().setParagraph().run();
                else editor.chain().focus().toggleHeading({ level: parseInt(v) }).run();
              }}
            >
              <option value="0">Normal</option>
              <option value="1">Heading 1</option>
              <option value="2">Heading 2</option>
              <option value="3">Heading 3</option>
            </select>
          </div>
          <div className="toolbar-sep" />
          <div className="toolbar-group">
            <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">≡</ToolbarButton>
            <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">1.</ToolbarButton>
          </div>
          <div className="toolbar-sep" />
          <div className="toolbar-group">
            <ToolbarButton active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left">⇐</ToolbarButton>
            <ToolbarButton active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Center">≡</ToolbarButton>
            <ToolbarButton active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right">⇒</ToolbarButton>
          </div>
          <div className="toolbar-sep" />
          <div className="toolbar-group">
            <ToolbarButton active={false} onClick={() => editor.chain().focus().undo().run()} title="Undo">↩</ToolbarButton>
            <ToolbarButton active={false} onClick={() => editor.chain().focus().redo().run()} title="Redo">↪</ToolbarButton>
          </div>
        </div>
      )}

      {/* Editor + sidebar */}
      <div className="editor-body">
        <div className="editor-paper">
          {!canEdit && (
            <div className="view-only-banner">
              View only — you have read-only access to this document
            </div>
          )}
          <EditorContent editor={editor} className="tiptap-editor" />
        </div>

        <aside className="editor-sidebar">
          {/* Attachments */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <span>Attachments</span>
              {canEdit && (
                <label className="attach-btn" title="Attach .txt or .md file">
                  + Add
                  <input
                    ref={attachRef}
                    type="file"
                    accept=".txt,.md,.markdown"
                    style={{ display: 'none' }}
                    onChange={handleAttach}
                    disabled={attachUploading}
                  />
                </label>
              )}
            </div>
            {attachUploading && <div className="sidebar-loading">Uploading…</div>}
            {doc?.attachments?.length > 0 ? (
              <ul className="attach-list">
                {doc.attachments.map(a => (
                  <li key={a.id} className="attach-item">
                    <span className="attach-icon">📎</span>
                    <span className="attach-name" title={a.original_name}>{a.original_name}</span>
                    <span className="attach-size">{(a.size / 1024).toFixed(1)}KB</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sidebar-empty">No attachments</p>
            )}
            <p className="sidebar-hint">Supported: .txt, .md</p>
          </div>

          {/* Shares — visible to owner only */}
          {isOwner && (
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span>Shared with</span>
              </div>
              {doc?.shares?.length === 0 ? (
                <p className="sidebar-empty">Not shared yet</p>
              ) : (
                <ul className="share-list">
                  {doc?.shares?.map(s => (
                    <li key={s.id} className="share-item">
                      <span className="avatar-sm">{s.name[0]}</span>
                      <span className="share-name">{s.name}</span>
                      <span className={`share-perm ${s.permission}`}>{s.permission}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>

      {showShare && doc && (
        <ShareModal doc={doc} onClose={() => setShowShare(false)} onUpdate={handleShareUpdate} />
      )}
    </div>
  );
}

function ToolbarButton({ active, onClick, title, children }) {
  return (
    <button
      className={`toolbar-btn${active ? ' active' : ''}`}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}
