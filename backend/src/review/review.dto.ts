interface ReviewRow {
  id: string;
  barberId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  client?: { name: string };
}

interface Viewer {
  id?: string;
  role?: string;
}

// RN02 / V03: nota e contagem são públicas; o comentário só é revelado ao próprio
// barbeiro avaliado ou a ADMIN/DEV. Para CLIENT/anônimo o texto vira "***".
function canSeeComment(barberId: string, viewer: Viewer): boolean {
  if (!viewer.role) return false;
  if (viewer.role === 'ADMIN' || viewer.role === 'DEV') return true;
  if (viewer.role === 'BARBER' && viewer.id === barberId) return true;
  return false;
}

export function toReviewDto(review: ReviewRow, viewer: Viewer) {
  const reveal = canSeeComment(review.barberId, viewer);
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment === null ? null : reveal ? review.comment : '***',
    clientName: review.client?.name,
    createdAt: review.createdAt,
  };
}
