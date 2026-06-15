import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../common/asyncHandler';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { createNote, listNotes, updateNote, deleteNote } from './crm.service';

export const crmRouter = Router();

const NoteBodySchema = z.object({ noteText: z.string().min(1).max(4000) });

// Todas as rotas: somente staff (barbeiro/admin/dev). Clientes não acessam o CRM.
const staffOnly = [authenticate, requireRole('BARBER', 'ADMIN', 'DEV')];

// POST /clients/:clientId/notes
crmRouter.post('/clients/:clientId/notes', ...staffOnly, asyncHandler(async (req, res) => {
  const { noteText } = NoteBodySchema.parse(req.body);
  const note = await createNote(req.user!.id, req.params.clientId, noteText);
  res.status(201).json({ id: note.id, noteText: note.noteText, authorId: note.authorId, createdAt: note.createdAt });
}));

// GET /clients/:clientId/notes — RN05: qualquer barbeiro lê.
crmRouter.get('/clients/:clientId/notes', ...staffOnly, asyncHandler(async (req, res) => {
  res.json(await listNotes(req.params.clientId));
}));

// PUT /clients/:clientId/notes/:noteId — somente autor ou admin.
crmRouter.put('/clients/:clientId/notes/:noteId', ...staffOnly, asyncHandler(async (req, res) => {
  const { noteText } = NoteBodySchema.parse(req.body);
  const note = await updateNote(req.params.noteId, req.user!.id, req.user!.role, noteText);
  res.json({ id: note.id, noteText: note.noteText, authorId: note.authorId, updatedAt: note.updatedAt });
}));

// DELETE /clients/:clientId/notes/:noteId — somente autor ou admin.
crmRouter.delete('/clients/:clientId/notes/:noteId', ...staffOnly, asyncHandler(async (req, res) => {
  await deleteNote(req.params.noteId, req.user!.id, req.user!.role);
  res.status(204).end();
}));
