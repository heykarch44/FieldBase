-- ============================================================
-- Aqua Palm Pool Service — Seed Data
-- Run AFTER migrations. Uses service_role key (bypasses RLS).
-- 
-- Creates: 1 admin, 1 office user, 2 technicians, 12 customers,
-- 2 routes, sample visits, chemical logs, and equipment.
--
-- NOTE: Auth users must be created via Supabase Auth API first.
-- This script seeds the public.users table and all related data.
-- See setup guide for auth user creation commands.
-- ============================================================

-- ============================================================
-- 1. USERS (profiles only — auth users created separately)
-- ============================================================

-- Use fixed UUIDs so foreign keys work in seed data
-- In production, these come from auth.users.id

insert into users (id, email, full_name, phone, role) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@aquapalmpools.com', 'Admin User', '(602) 555-7665', 'admin'),
  ('a0000000-0000-0000-0000-000000000002', 'office@aquapalmpools.com', 'Sarah Martinez', '(602) 555-7666', 'office'),
  ('a0000000-0000-0000-0000-000000000003', 'jake@aquapalmpools.com', 'Jake Thompson', '(602) 555-7667', 'technician'),
  ('a0000000-0000-0000-0000-000000000004', 'mike@aquapalmpools.com', 'Mike Reyes', '(602) 555-7668', 'technician')
on conflict (id) do update set
  phone = excluded.phone,
  role = excluded.role;


-- ============================================================
-- 2. CUSTOMERS — 12 across Greater Phoenix
-- ============================================================

insert into customers (id, first_name, last_name, email, phone, address_line1, city, zip, lat, lng, gate_code, access_notes, pool_type, pool_volume_gallons, service_day, monthly_rate, status) values

-- East Valley customers (Jake's route)
('c0000000-0000-0000-0000-000000000001', 'David', 'Chen', 'david.chen@email.com', '(480) 555-1001',
  '4821 E Cactus Rd', 'Scottsdale', '85254', 33.4972, -111.9217,
  '4821#', 'Enter through side gate, dog friendly', 'saltwater', 18000, 'tue', 165.00, 'active'),

('c0000000-0000-0000-0000-000000000002', 'Maria', 'Gonzalez', 'maria.g@email.com', '(480) 555-1002',
  '1530 N Scottsdale Rd', 'Tempe', '85281', 33.4489, -111.9261,
  null, 'Gate is unlocked on service days', 'chlorine', 15000, 'tue', 140.00, 'active'),

('c0000000-0000-0000-0000-000000000003', 'Robert', 'Williams', 'rwilliams@email.com', '(480) 555-1003',
  '2245 S Val Vista Dr', 'Mesa', '85204', 33.3837, -111.7345,
  '9876', 'Pool behind casita, equipment in shed', 'chlorine', 22000, 'tue', 180.00, 'active'),

('c0000000-0000-0000-0000-000000000004', 'Jennifer', 'Park', 'jpark@email.com', '(480) 555-1004',
  '3670 E Guadalupe Rd', 'Gilbert', '85234', 33.3616, -111.7912,
  '1234', null, 'saltwater', 16000, 'thu', 155.00, 'active'),

('c0000000-0000-0000-0000-000000000005', 'James', 'Anderson', 'janderson@email.com', '(480) 555-1005',
  '890 W Chandler Blvd', 'Chandler', '85225', 33.3062, -111.8568,
  null, 'Ring doorbell on arrival', 'chlorine', 20000, 'thu', 160.00, 'active'),

('c0000000-0000-0000-0000-000000000006', 'Lisa', 'Nguyen', 'lisa.n@email.com', '(480) 555-1006',
  '5520 E Baseline Rd', 'Mesa', '85206', 33.3783, -111.7066,
  '5520', 'Large pool with attached spa', 'saltwater', 25000, 'thu', 195.00, 'active'),

-- West Valley customers (Mike's route)
('c0000000-0000-0000-0000-000000000007', 'Michael', 'Johnson', 'mjohnson@email.com', '(623) 555-2001',
  '7845 W Glendale Ave', 'Glendale', '85303', 33.5387, -112.1913,
  null, 'Pool in back, no dog', 'chlorine', 14000, 'mon', 130.00, 'active'),

('c0000000-0000-0000-0000-000000000008', 'Karen', 'Smith', 'ksmith@email.com', '(623) 555-2002',
  '12200 N 75th Ave', 'Peoria', '85381', 33.5806, -112.2237,
  '7755', 'HOA community — check in at guard gate', 'chlorine', 12000, 'mon', 125.00, 'active'),

('c0000000-0000-0000-0000-000000000009', 'Thomas', 'Brown', 'tbrown@email.com', '(623) 555-2003',
  '2100 N Litchfield Rd', 'Goodyear', '85395', 33.4559, -112.3588,
  '2100', 'Equipment pad on east side of house', 'saltwater', 20000, 'wed', 170.00, 'active'),

('c0000000-0000-0000-0000-000000000010', 'Amanda', 'Davis', 'adavis@email.com', '(602) 555-2004',
  '3344 W Camelback Rd', 'Phoenix', '85017', 33.5097, -112.1192,
  null, 'Pebblesheen finish, be careful with vacuum', 'chlorine', 17000, 'wed', 150.00, 'active'),

-- Leads (not yet converted)
('c0000000-0000-0000-0000-000000000011', 'Steven', 'Taylor', 'staylor@email.com', '(480) 555-3001',
  '6789 E Indian School Rd', 'Scottsdale', '85251', 33.4940, -111.9040,
  null, null, 'chlorine', null, null, null, 'lead'),

('c0000000-0000-0000-0000-000000000012', 'Rachel', 'Martinez', 'rmartinez@email.com', '(623) 555-3002',
  '15400 W Surprise Farms Loop', 'Surprise', '85388', 33.6114, -112.3640,
  null, null, 'other', null, null, null, 'lead');


-- ============================================================
-- 3. ROUTES
-- ============================================================

insert into routes (id, name, technician_id, day_of_week, optimized_order, total_estimated_minutes, total_distance_miles) values

-- Jake's Tuesday route (East Valley)
('b0000000-0000-0000-0000-000000000001', 'East Valley Tuesday', 'a0000000-0000-0000-0000-000000000003', 'tue',
  '["c0000000-0000-0000-0000-000000000002", "c0000000-0000-0000-0000-000000000001", "c0000000-0000-0000-0000-000000000003"]'::jsonb,
  210, 32.5),

-- Jake's Thursday route
('b0000000-0000-0000-0000-000000000002', 'East Valley Thursday', 'a0000000-0000-0000-0000-000000000003', 'thu',
  '["c0000000-0000-0000-0000-000000000004", "c0000000-0000-0000-0000-000000000005", "c0000000-0000-0000-0000-000000000006"]'::jsonb,
  195, 28.0),

-- Mike's Monday route (West Valley)
('b0000000-0000-0000-0000-000000000003', 'West Valley Monday', 'a0000000-0000-0000-0000-000000000004', 'mon',
  '["c0000000-0000-0000-0000-000000000007", "c0000000-0000-0000-0000-000000000008"]'::jsonb,
  140, 18.5),

-- Mike's Wednesday route
('b0000000-0000-0000-0000-000000000004', 'West Valley Wednesday', 'a0000000-0000-0000-0000-000000000004', 'wed',
  '["c0000000-0000-0000-0000-000000000010", "c0000000-0000-0000-0000-000000000009"]'::jsonb,
  155, 35.2);


-- ============================================================
-- 4. SAMPLE SERVICE VISITS (last week)
-- ============================================================

insert into service_visits (id, customer_id, technician_id, route_id, scheduled_date, arrived_at, departed_at, arrived_lat, arrived_lng, departed_lat, departed_lng, status, notes) values

-- Jake's Tuesday visits (March 10, 2026)
('d0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
  '2026-03-10', '2026-03-10 14:05:00+00', '2026-03-10 14:52:00+00',
  33.4489, -111.9261, 33.4489, -111.9261,
  'completed', 'Pool clear. Skimmer basket was full of leaves from recent wind.'),

('d0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
  '2026-03-10', '2026-03-10 15:10:00+00', '2026-03-10 16:00:00+00',
  33.4972, -111.9217, 33.4972, -111.9217,
  'completed', 'Salt cell showing low output. May need replacement soon — flagged repair request.'),

('d0000000-0000-0000-0000-000000000003',
  'c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
  '2026-03-10', '2026-03-10 16:25:00+00', '2026-03-10 17:20:00+00',
  33.3837, -111.7345, 33.3837, -111.7345,
  'completed', 'Large pool took extra time. Green algae starting on north wall — added extra chlorine.'),

-- Mike's Monday visits (March 9, 2026)
('d0000000-0000-0000-0000-000000000004',
  'c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003',
  '2026-03-09', '2026-03-09 14:00:00+00', '2026-03-09 14:40:00+00',
  33.5387, -112.1913, 33.5387, -112.1913,
  'completed', 'Routine service. All readings normal.'),

('d0000000-0000-0000-0000-000000000005',
  'c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003',
  '2026-03-09', '2026-03-09 15:00:00+00', '2026-03-09 15:38:00+00',
  33.5806, -112.2237, 33.5806, -112.2237,
  'completed', 'Filter pressure high at 22 PSI. Backwashed and dropped to 12 PSI.');


-- ============================================================
-- 5. SAMPLE CHEMICAL LOGS
-- ============================================================

insert into chemical_logs (visit_id, chemical_name, amount, unit, ph_before, ph_after, chlorine_before, chlorine_after, alkalinity_before, alkalinity_after, cya_before, cya_after, calcium_hardness, salt_level, water_temp) values

-- Visit 1: Maria Gonzalez (chlorine pool)
('d0000000-0000-0000-0000-000000000001', 'Liquid Chlorine', 1.00, 'gallons',
  7.6, 7.4, 1.0, 3.0, 90, 90, 40, 40, 250, null, 72.5),

-- Visit 2: David Chen (saltwater pool)
('d0000000-0000-0000-0000-000000000002', 'Muriatic Acid', 16.00, 'oz',
  7.8, 7.4, 2.5, 2.5, 110, 95, 60, 60, 320, 3200, 74.0),

-- Visit 3: Robert Williams (chlorine, algae treatment)
('d0000000-0000-0000-0000-000000000003', 'Liquid Chlorine', 2.00, 'gallons',
  7.4, 7.4, 0.5, 5.0, 80, 80, 35, 35, 280, null, 71.0),
('d0000000-0000-0000-0000-000000000003', 'Algaecide', 8.00, 'oz',
  null, null, null, null, null, null, null, null, null, null, 71.0),

-- Visit 4: Michael Johnson (routine)
('d0000000-0000-0000-0000-000000000004', 'Chlorine Tablets', 3.00, 'tablets',
  7.4, 7.4, 2.0, 3.5, 100, 100, 50, 50, 300, null, 70.0),

-- Visit 5: Karen Smith (post-backwash)
('d0000000-0000-0000-0000-000000000005', 'Liquid Chlorine', 0.50, 'gallons',
  7.2, 7.2, 1.5, 3.0, 85, 85, 45, 45, 240, null, 69.5);


-- ============================================================
-- 6. SAMPLE REPAIR REQUEST
-- ============================================================

insert into repair_requests (id, visit_id, customer_id, requested_by, category, description, urgency, estimated_cost, status, photos) values
('ee000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000003',
  'other',
  'Salt cell producing low chlorine output. Inspected and found heavy calcium buildup on plates. Acid wash may extend life 6–12 months, but cell is 4 years old. Recommend quoting both acid wash and full replacement.',
  'medium',
  450.00,
  'pending_review',
  '{}');


-- ============================================================
-- 7. SAMPLE EQUIPMENT INVENTORY
-- ============================================================

insert into equipment_inventory (customer_id, equipment_type, brand, model, serial_number, install_date, warranty_expiry, last_serviced, condition, notes) values

-- David Chen's saltwater setup
('c0000000-0000-0000-0000-000000000001', 'pump', 'Pentair', 'IntelliFlo VSF', 'PEN-2022-44821', '2022-03-15', '2025-03-15', '2026-03-10', 'good', 'Variable speed, running at 2400 RPM for daily circulation'),
('c0000000-0000-0000-0000-000000000001', 'salt_cell', 'Pentair', 'IntelliChlor IC40', 'PEN-2022-44822', '2022-03-15', '2025-03-15', '2026-03-10', 'poor', 'Heavy calcium buildup. See repair request RR-001'),
('c0000000-0000-0000-0000-000000000001', 'filter', 'Pentair', 'Clean & Clear Plus 520', 'PEN-2022-44823', '2022-03-15', '2025-03-15', '2026-01-15', 'good', 'DE filter, last acid wash Jan 2026'),
('c0000000-0000-0000-0000-000000000001', 'automation', 'Pentair', 'IntelliCenter', 'PEN-2022-44824', '2022-03-15', '2025-03-15', null, 'good', 'Controls pump, lights, spa jets, heater'),

-- Maria Gonzalez's basic setup
('c0000000-0000-0000-0000-000000000002', 'pump', 'Hayward', 'Super Pump VS', 'HAY-2020-31205', '2020-06-01', '2023-06-01', '2026-03-10', 'fair', 'Warranty expired. Running fine but motor sounds slightly louder than normal'),
('c0000000-0000-0000-0000-000000000002', 'filter', 'Hayward', 'SwimClear C3030', 'HAY-2020-31206', '2020-06-01', '2023-06-01', '2026-02-01', 'good', 'Cartridge filter, cleaned Feb 2026'),

-- Robert Williams
('c0000000-0000-0000-0000-000000000003', 'pump', 'Jandy', 'FloPro VS', 'JAN-2019-18744', '2019-11-01', '2022-11-01', '2026-03-10', 'fair', 'Older unit, still performing well'),
('c0000000-0000-0000-0000-000000000003', 'filter', 'Jandy', 'CL580', 'JAN-2019-18745', '2019-11-01', '2022-11-01', '2026-03-10', 'good', 'Cartridge filter, large capacity for 22k gal pool'),
('c0000000-0000-0000-0000-000000000003', 'heater', 'Raypak', 'R336A', 'RAY-2019-22100', '2019-11-01', '2024-11-01', '2025-10-15', 'good', 'Natural gas heater, used in winter months');
