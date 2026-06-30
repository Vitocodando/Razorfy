-- FEAT-086 (segurança): habilita Row-Level Security em todas as tabelas públicas.
-- Sem policies => a API REST do Supabase (roles anon/authenticated) é negada por padrão.
-- O backend usa Prisma com o role DONO das tabelas, que BYPASSA RLS — app inalterado.
ALTER TABLE admin_alerts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_services        ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_status_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_goals                ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_slots                ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbershops                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashback_transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashback_wallets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_admin_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_icons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE services                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_blocks             ENABLE ROW LEVEL SECURITY;
