import { prisma } from '../prisma';
import { BusinessError } from '../common/BusinessError';

async function assertClient(clientId: string): Promise<string> {
  const client = await prisma.user.findUnique({ where: { id: clientId }, select: { role: true, tenantId: true } });
  if (!client || client.role !== 'CLIENT') {
    throw new BusinessError('CLIENT_NOT_FOUND', 'Cliente não encontrado.', 404);
  }
  return client.tenantId!; // CLIENT sempre tem tenant (CHECK no banco)
}

export async function createNote(authorId: string, clientId: string, noteText: string) {
  const tenantId = await assertClient(clientId);
  const text = noteText.trim();
  if (!text) throw new BusinessError('EMPTY_NOTE', 'A anotação não pode ser vazia.', 422);
  return prisma.clientNote.create({ data: { clientId, authorId, tenantId, noteText: text } });
}

// RN05: qualquer barbeiro/staff lê o histórico de notas do cliente; cada nota identifica o autor.
export async function listNotes(clientId: string) {
  await assertClient(clientId);
  const notes = await prisma.clientNote.findMany({
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

function assertAuthorOrStaff(noteAuthorId: string, userId: string, userRole: string) {
  const isAuthor = noteAuthorId === userId;
  const isAdmin = userRole === 'ADMIN' || userRole === 'DEV';
  if (!isAuthor && !isAdmin) {
    throw new BusinessError('FORBIDDEN', 'Apenas o autor da nota pode alterá-la.', 403);
  }
}

export async function updateNote(noteId: string, userId: string, userRole: string, noteText: string) {
  const note = await prisma.clientNote.findUnique({ where: { id: noteId } });
  if (!note) throw new BusinessError('NOTE_NOT_FOUND', 'Nota não encontrada.', 404);
  assertAuthorOrStaff(note.authorId, userId, userRole);
  const text = noteText.trim();
  if (!text) throw new BusinessError('EMPTY_NOTE', 'A anotação não pode ser vazia.', 422);
  return prisma.clientNote.update({ where: { id: noteId }, data: { noteText: text } });
}

export async function deleteNote(noteId: string, userId: string, userRole: string) {
  const note = await prisma.clientNote.findUnique({ where: { id: noteId } });
  if (!note) throw new BusinessError('NOTE_NOT_FOUND', 'Nota não encontrada.', 404);
  assertAuthorOrStaff(note.authorId, userId, userRole);
  await prisma.clientNote.delete({ where: { id: noteId } });
}
