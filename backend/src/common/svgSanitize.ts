// FEAT-082: sanitização anti-XSS de SVG antes de persistir (NFR).
// Remove vetores de execução de script: <script>/<iframe>/<foreignObject>, handlers on*,
// e protocolos perigosos (javascript:) em atributos de link.

const DANGEROUS_TAGS = ['script', 'iframe', 'foreignObject', 'object', 'embed', 'use', 'animate', 'set'];

export function sanitizeSvg(input: string): { clean: string; modified: boolean } {
  let svg = input;

  // Remove blocos de tags perigosas (com conteúdo) e suas variantes self-closing.
  for (const tag of DANGEROUS_TAGS) {
    svg = svg.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'gi'), '');
    svg = svg.replace(new RegExp(`<${tag}\\b[^>]*/?>`, 'gi'), '');
  }

  // Remove atributos de evento (onload, onclick, onmouseover, ...).
  svg = svg.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  svg = svg.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  svg = svg.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');

  // Remove protocolos perigosos em href/xlink:href (javascript:, data:text/html).
  svg = svg.replace(/(href|xlink:href)\s*=\s*"(\s*javascript:|\s*data:text\/html)[^"]*"/gi, '');
  svg = svg.replace(/(href|xlink:href)\s*=\s*'(\s*javascript:|\s*data:text\/html)[^']*'/gi, '');

  // Remove DOCTYPE/ENTITY (XXE) e comentários condicionais.
  svg = svg.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  svg = svg.replace(/<!ENTITY[\s\S]*?>/gi, '');

  const clean = svg.trim();
  return { clean, modified: clean !== input.trim() };
}
