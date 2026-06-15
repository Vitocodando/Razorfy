"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNote = createNote;
exports.listNotes = listNotes;
exports.updateNote = updateNote;
exports.deleteNote = deleteNote;
const prisma_1 = require("../prisma");
const BusinessError_1 = require("../common/BusinessError");
async function assertClient(clientId) {
    const client = await prisma_1.prisma.user.findUnique({ where: { id: clientId }, select: { role: true } });
    if (!client || client.role !== 'CLIENT') {
        throw new BusinessError_1.BusinessError('CLIENT_NOT_FOUND', 'Cliente não encontrado.', 404);
    }
}
async function createNote(authorId, clientId, noteText) {
    await assertClient(clientId);
    const text = noteText.trim();
    if (!text)
        throw new BusinessError_1.BusinessError('EMPTY_NOTE', 'A anotação não pode ser vazia.', 422);
    return prisma_1.prisma.clientNote.create({ data: { clientId, authorId, noteText: text } });
}
// RN05: qualquer barbeiro/staff lê o histórico de notas do cliente; cada nota identifica o autor.
async function listNotes(clientId) {
    await assertClient(clientId);
    const notes = await prisma_1.prisma.clientNote.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { id: true, name: true } } },
    });
    return notes.map(n => ({
        id: n.id,
        noteText: n.noteText,
        authorId: n.authorId,
        authorName: n.author.name,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
    }));
}
function assertAuthorOrStaff(noteAuthorId, userId, userRole) {
    const isAuthor = noteAuthorId === userId;
    const isAdmin = userRole === 'ADMIN' || userRole === 'DEV';
    if (!isAuthor && !isAdmin) {
        throw new BusinessError_1.BusinessError('FORBIDDEN', 'Apenas o autor da nota pode alterá-la.', 403);
    }
}
async function updateNote(noteId, userId, userRole, noteText) {
    const note = await prisma_1.prisma.clientNote.findUnique({ where: { id: noteId } });
    if (!note)
        throw new BusinessError_1.BusinessError('NOTE_NOT_FOUND', 'Nota não encontrada.', 404);
    assertAuthorOrStaff(note.authorId, userId, userRole);
    const text = noteText.trim();
    if (!text)
        throw new BusinessError_1.BusinessError('EMPTY_NOTE', 'A anotação não pode ser vazia.', 422);
    return prisma_1.prisma.clientNote.update({ where: { id: noteId }, data: { noteText: text } });
}
async function deleteNote(noteId, userId, userRole) {
    const note = await prisma_1.prisma.clientNote.findUnique({ where: { id: noteId } });
    if (!note)
        throw new BusinessError_1.BusinessError('NOTE_NOT_FOUND', 'Nota não encontrada.', 404);
    assertAuthorOrStaff(note.authorId, userId, userRole);
    await prisma_1.prisma.clientNote.delete({ where: { id: noteId } });
}
