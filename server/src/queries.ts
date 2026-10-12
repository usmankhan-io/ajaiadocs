import db from './db';

export interface DocRow {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  owner_name: string;
  created_at: number;
  updated_at: number;
}

export interface ShareRow {
  id: string;
  permission: 'view' | 'edit';
  user_id: string;
  name: string;
  email: string;
}

export interface AttachmentRow {
  id: string;
  original_name: string;
  mime_type: string;
  size: number;
  created_at: number;
}

const docWithOwner = db.prepare<[string], DocRow>(`
  SELECT d.id, d.title, d.content, d.owner_id, d.created_at, d.updated_at,
         u.name AS owner_name
  FROM documents d
  JOIN users u ON u.id = d.owner_id
  WHERE d.id = ?
`);

const docShares = db.prepare<[string], ShareRow>(`
  SELECT ds.id, ds.permission, u.id AS user_id, u.name, u.email
  FROM document_shares ds
  JOIN users u ON u.id = ds.shared_with_id
  WHERE ds.document_id = ?
`);

const docAttachments = db.prepare<[string], AttachmentRow>(`
  SELECT id, original_name, mime_type, size, created_at
  FROM attachments
  WHERE document_id = ?
  ORDER BY created_at DESC
`);

export const queries = {
  getDoc: (id: string) => docWithOwner.get(id),
  getShares: (docId: string) => docShares.all(docId),
  getAttachments: (docId: string) => docAttachments.all(docId),
};
