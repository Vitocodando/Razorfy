-- FEAT-082: remove comissões/repasses e adiciona biblioteca de ícones SVG.

-- Parte A: descarta comissionamento.
DROP TABLE IF EXISTS barber_commissions;

-- Parte B: biblioteca de ícones (globais = tenant_id NULL; privados = tenant_id preenchido).
CREATE TABLE service_icons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES barbershops(id),
  name        VARCHAR(50) NOT NULL,
  svg_content TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_icons_tenant ON service_icons (tenant_id);

ALTER TABLE services ADD COLUMN icon_id UUID REFERENCES service_icons(id);

-- Ícones globais padrão (currentColor herda a cor do tema).
INSERT INTO service_icons (tenant_id, name, svg_content) VALUES
(NULL, 'Tesoura', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>'),
(NULL, 'Máquina', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2h2v4H4zM8 2h2v4H8zM12 2h2v4h-2zM16 2h2v4h-2z"/><rect x="3" y="7" width="18" height="6" rx="1.5"/><path d="M10 14h4v8h-4z"/></svg>'),
(NULL, 'Navalha', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-9 2 2-9 9z"/><path d="M5 13l-2 8 8-2"/><path d="M14 4l6 6-7 7"/></svg>'),
(NULL, 'Barba', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4c0 6 2 10 8 10s8-4 8-10c-2 2-4 3-8 3S6 6 4 4zM7 15c1 3 3 5 5 5s4-2 5-5c-1.5 1-3.2 1.5-5 1.5S8.5 16 7 15z"/></svg>'),
(NULL, 'Toalha', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="3" x2="8" y2="21"/><line x1="11" y1="7" x2="17" y2="7"/></svg>');
