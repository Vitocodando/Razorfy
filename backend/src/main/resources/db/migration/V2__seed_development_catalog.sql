INSERT INTO users (id, name, email, phone, password, role) VALUES
('11111111-1111-1111-1111-111111111111', 'Rafael Martins', 'rafael@razorfy.local', '+5511999990001', '$2a$12$HdRB05dNxvBZBb28tVNOROzMDN.K3RE/ZDrX3ZPeAamUo4nPonwqS', 'BARBER'),
('22222222-2222-2222-2222-222222222222', 'Bruno Costa', 'bruno@razorfy.local', '+5511999990002', '$2a$12$HdRB05dNxvBZBb28tVNOROzMDN.K3RE/ZDrX3ZPeAamUo4nPonwqS', 'BARBER')
ON CONFLICT DO NOTHING;

INSERT INTO barber_slots (barber_id, day_of_week, start_time, end_time, lunch_start, lunch_end)
SELECT barber_id, day_of_week, '09:00', '19:00', '12:00', '13:00'
FROM (
    VALUES
        ('11111111-1111-1111-1111-111111111111'::uuid),
        ('22222222-2222-2222-2222-222222222222'::uuid)
) AS barbers(barber_id)
CROSS JOIN generate_series(1, 6) AS days(day_of_week)
ON CONFLICT DO NOTHING;

INSERT INTO services (id, name, duration_minutes, price) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Corte clássico', 30, 35.00),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Barba completa', 30, 30.00),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Sobrancelha', 15, 15.00),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'Corte + barba premium', 60, 60.00)
ON CONFLICT DO NOTHING;
