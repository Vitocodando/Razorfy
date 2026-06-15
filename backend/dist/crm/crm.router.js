"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crmRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const asyncHandler_1 = require("../common/asyncHandler");
const authenticate_1 = require("../middleware/authenticate");
const requireRole_1 = require("../middleware/requireRole");
const crm_service_1 = require("./crm.service");
exports.crmRouter = (0, express_1.Router)();
const NoteBodySchema = zod_1.z.object({ noteText: zod_1.z.string().min(1).max(4000) });
// Todas as rotas: somente staff (barbeiro/admin/dev). Clientes não acessam o CRM.
const staffOnly = [authenticate_1.authenticate, (0, requireRole_1.requireRole)('BARBER', 'ADMIN', 'DEV')];
// POST /clients/:clientId/notes
exports.crmRouter.post('/clients/:clientId/notes', ...staffOnly, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { noteText } = NoteBodySchema.parse(req.body);
    const note = await (0, crm_service_1.createNote)(req.user.id, req.params.clientId, noteText);
    res.status(201).json({ id: note.id, noteText: note.noteText, authorId: note.authorId, createdAt: note.createdAt });
}));
// GET /clients/:clientId/notes — RN05: qualquer barbeiro lê.
exports.crmRouter.get('/clients/:clientId/notes', ...staffOnly, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.json(await (0, crm_service_1.listNotes)(req.params.clientId));
}));
// PUT /clients/:clientId/notes/:noteId — somente autor ou admin.
exports.crmRouter.put('/clients/:clientId/notes/:noteId', ...staffOnly, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { noteText } = NoteBodySchema.parse(req.body);
    const note = await (0, crm_service_1.updateNote)(req.params.noteId, req.user.id, req.user.role, noteText);
    res.json({ id: note.id, noteText: note.noteText, authorId: note.authorId, updatedAt: note.updatedAt });
}));
// DELETE /clients/:clientId/notes/:noteId — somente autor ou admin.
exports.crmRouter.delete('/clients/:clientId/notes/:noteId', ...staffOnly, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await (0, crm_service_1.deleteNote)(req.params.noteId, req.user.id, req.user.role);
    res.status(204).end();
}));
