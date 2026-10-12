import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, Undo2, Redo2,
  AlignLeft, AlignCenter, AlignRight,
  FileDown, Printer,
} from 'lucide-react';
import { docsApi, uploadApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import ShareModal from '../components/ShareModal';
import './EditorPage.css';

function htmlToMarkdown(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const convert = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    const inner = Array.from(node.childNodes).map(convert).join('');
    if (tag === 'h1') return `# ${inner}\n\n`;
    if (tag === 'h2') return `## ${inner}\n\n`;
    if (tag === 'h3') return `### ${inner}\n\n`;
    if (tag === 'p') return `${inner}\n\n`;
    if (tag === 'strong' || tag === 'b') return `**${inner}**`;
    if (tag === 'em' || tag === 'i') return `_${inner}_`;
    if (tag === 'u') return inner;
    if (tag === 'ul') return Array.from(node.children).map(li => `- ${Array.from(li.childNodes).map(convert).join('')}\n`).join('') + '\n';
    if (tag === 'ol') return Array.from(node.children).map((li, i) => `${i + 1}. ${Array.from(li.childNodes).map(convert).join('')}\n`).join('') + '\n';
    if (tag === 'li') return inner;
    if (tag === 'br') return '\n';
    return inner;
  };
  return Array.from(div.childNodes).map(convert).join('').replace(/\n{3,}/g, '\n\n').trim();
}

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth(); // currently logged-in user

  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [attachUploading, setAttachUploading] = useState(false);
  const [wordCount, setWordCount] = useState(0);
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
    onUpdate: ({ editor: e }) => {
      setSaveStatus('unsaved');
      const text = e.getText().trim();
      setWordCount(text ? text.split(/\s+/).length : 0);
    },
    editable: true,
  });

  const exportMarkdown = useCallback(() => {
    if (!editor) return;
    const md = htmlToMarkdown(editor.getHTML());
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'document'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [editor, title]);

  const exportPDF = useCallback(async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.querySelector('.paper-card');
    if (!element) return;
    const w = element.scrollWidth;
    const h = element.scrollHeight;
    html2pdf().set({
      margin: 0,
      filename: `${title || 'document'}.pdf`,
      html2canvas: { scale: 2, useCORS: true, width: w, height: h },
      jsPDF: { unit: 'px', format: [w, h], orientation: 'portrait' },
    }).from(element).save();
  }, [title]);

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
        const text = (editor?.getText() || '').trim();
        setWordCount(text ? text.split(/\s+/).length : 0);
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
          <button className="btn-export" onClick={exportMarkdown} title="Download as Markdown">
            <FileDown size={15} /> .md
          </button>
          <button className="btn-export" onClick={exportPDF} title="Download as PDF">
            <Printer size={15} /> .pdf
          </button>
          {isOwner && (
            <button className="btn-share" onClick={() => setShowShare(true)}>Share</button>
          )}
        </div>
      </header>

      {/* Floating toolbar */}
      {editor && (
        <div className="editor-toolbar-wrap">
          <div className="editor-toolbar">
            <div className="toolbar-group">
              <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()}>
                <Undo2 size={15} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()}>
                <Redo2 size={15} />
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
                disabled={!canEdit}
              >
                <option value="0">Normal text</option>
                <option value="1">Heading 1</option>
                <option value="2">Heading 2</option>
                <option value="3">Heading 3</option>
              </select>
            </div>
            <div className="toolbar-sep" />
            <div className="toolbar-group">
              <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold" disabled={!canEdit}>
                <Bold size={14} />
              </ToolbarButton>
              <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic" disabled={!canEdit}>
                <Italic size={14} />
              </ToolbarButton>
              <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline" disabled={!canEdit}>
                <UnderlineIcon size={14} />
              </ToolbarButton>
            </div>
            <div className="toolbar-sep" />
            <div className="toolbar-group">
              <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list" disabled={!canEdit}>
                <List size={15} />
              </ToolbarButton>
              <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list" disabled={!canEdit}>
                <ListOrdered size={15} />
              </ToolbarButton>
            </div>
            <div className="toolbar-sep" />
            <div className="toolbar-group">
              <ToolbarButton active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left" disabled={!canEdit}>
                <AlignLeft size={14} />
              </ToolbarButton>
              <ToolbarButton active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Center" disabled={!canEdit}>
                <AlignCenter size={14} />
              </ToolbarButton>
              <ToolbarButton active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right" disabled={!canEdit}>
                <AlignRight size={14} />
              </ToolbarButton>
            </div>
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
          <div className="paper-card">
            <EditorContent editor={editor} />
          </div>
          <div className="word-count">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </div>
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

function ToolbarButton({ active, onClick, title, children, disabled }) {
  return (
    <button
      className={`toolbar-btn${active ? ' active' : ''}`}
      onClick={onClick}
      title={title}
      type="button"
      disabled={disabled}
    >
      {children}
    </button>
  );
}
