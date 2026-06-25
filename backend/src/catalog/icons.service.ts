import { prisma } from '../prisma';
import { BusinessError } from '../common/BusinessError';
import { sanitizeSvg } from '../common/svgSanitize';

const MAX_SVG_BYTES = 50 * 1024; // RN03: 50 KB

// RN01: globais (tenant_id NULL) + privados da barbearia.
export async function listIcons(tenantId: string) {
  const icons = await prisma.serviceIcon.findMany({
    where: { OR: [{ tenantId: null }, { tenantId }] },
    orderBy: [{ tenantId: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, tenantId: true, svgContent: true },
  });
  return icons.map(i => ({
    id: i.id,
    name: i.name,
    type: i.tenantId ? 'CUSTOM' : 'GLOBAL',
    svgContent: i.svgContent,
  }));
}

export async function createIcon(tenantId: string, name: string, svgContent: string) {
  // RN03 / SVG_FILE_TOO_LARGE.
  if (Buffer.byteLength(svgContent, 'utf8') > MAX_SVG_BYTES) {
    throw new BusinessError('SVG_FILE_TOO_LARGE', 'O arquivo SVG excede o limite de 50 KB.', 413);
  }
  // INVALID_SVG_FORMAT: precisa ter a estrutura básica <svg>...</svg>.
  if (!/<svg[\s\S]*<\/svg>/i.test(svgContent)) {
    throw new BusinessError('INVALID_SVG_FORMAT', 'O conteúdo enviado não é um SVG válido.', 422);
  }

  const { clean, modified } = sanitizeSvg(svgContent);
  if (!/<svg[\s\S]*<\/svg>/i.test(clean)) {
    throw new BusinessError('INVALID_SVG_FORMAT', 'O conteúdo enviado não é um SVG válido.', 422);
  }

  const icon = await prisma.serviceIcon.create({
    data: { tenantId, name: name.trim(), svgContent: clean },
    select: { id: true, name: true, svgContent: true },
  });

  return {
    id: icon.id,
    name: icon.name,
    message: modified ? 'Ícone salvo com sucesso. Código inseguro removido.' : 'Ícone salvo com sucesso.',
    svgContent: icon.svgContent,
  };
}
