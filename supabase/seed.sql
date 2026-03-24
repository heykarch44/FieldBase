-- ============================================================
-- FieldBase — Industry Templates + Dev Seed Data
-- ============================================================

-- Industry Templates
insert into industry_templates (id, name, description, icon, field_definitions) values

('pool_cleaning', 'Pool Service', 'Weekly pool maintenance, chemical balancing, equipment service', 'droplet', '[
  {"entity_type":"visit","field_key":"ph_before","label":"pH Before","field_type":"number","is_required":true,"group_name":"Water Chemistry","display_order":1,"validation":{"min":0,"max":14}},
  {"entity_type":"visit","field_key":"ph_after","label":"pH After","field_type":"number","is_required":false,"group_name":"Water Chemistry","display_order":2,"validation":{"min":0,"max":14}},
  {"entity_type":"visit","field_key":"chlorine_before","label":"Chlorine Before","field_type":"number","is_required":true,"group_name":"Water Chemistry","display_order":3},
  {"entity_type":"visit","field_key":"chlorine_after","label":"Chlorine After","field_type":"number","is_required":false,"group_name":"Water Chemistry","display_order":4},
  {"entity_type":"visit","field_key":"alkalinity","label":"Alkalinity","field_type":"number","group_name":"Water Chemistry","display_order":5},
  {"entity_type":"visit","field_key":"cya","label":"CYA Level","field_type":"number","group_name":"Water Chemistry","display_order":6},
  {"entity_type":"visit","field_key":"salt_level","label":"Salt Level","field_type":"number","group_name":"Water Chemistry","display_order":7},
  {"entity_type":"visit","field_key":"water_temp","label":"Water Temp (°F)","field_type":"number","group_name":"Water Chemistry","display_order":8},
  {"entity_type":"visit","field_key":"filter_psi","label":"Filter PSI","field_type":"number","group_name":"Equipment Check","display_order":9},
  {"entity_type":"visit","field_key":"pump_running","label":"Pump Running","field_type":"boolean","group_name":"Equipment Check","display_order":10},
  {"entity_type":"visit","field_key":"chemicals_added","label":"Chemicals Added","field_type":"textarea","group_name":"Service Notes","display_order":11},
  {"entity_type":"jobsite","field_key":"pool_type","label":"Pool Type","field_type":"enum","options":["Chlorine","Saltwater","Ozone","UV","Other"],"display_order":1},
  {"entity_type":"jobsite","field_key":"pool_volume","label":"Pool Volume (gal)","field_type":"number","display_order":2},
  {"entity_type":"jobsite","field_key":"surface_type","label":"Surface Type","field_type":"enum","options":["Plaster","Pebble","Tile","Vinyl","Fiberglass"],"display_order":3}
]'::jsonb),

('hood_cleaning', 'Hood & Exhaust Cleaning', 'Commercial kitchen hood, duct, and exhaust system cleaning', 'flame', '[
  {"entity_type":"visit","field_key":"grease_depth","label":"Grease Depth (mm)","field_type":"number","is_required":true,"group_name":"Inspection","display_order":1},
  {"entity_type":"visit","field_key":"fan_rpm","label":"Fan RPM","field_type":"number","group_name":"Inspection","display_order":2},
  {"entity_type":"visit","field_key":"fire_suppression_ok","label":"Fire Suppression OK","field_type":"boolean","is_required":true,"group_name":"Safety","display_order":3},
  {"entity_type":"visit","field_key":"access_panels_ok","label":"Access Panels OK","field_type":"boolean","group_name":"Safety","display_order":4},
  {"entity_type":"visit","field_key":"duct_condition","label":"Duct Condition","field_type":"enum","options":["Clean","Light Buildup","Moderate","Heavy","Requires Repair"],"group_name":"Inspection","display_order":5},
  {"entity_type":"visit","field_key":"cleaning_method","label":"Cleaning Method","field_type":"enum","options":["Scrape & Degrease","Pressure Wash","Steam Clean","Chemical Treatment"],"group_name":"Service","display_order":6},
  {"entity_type":"visit","field_key":"before_photo_taken","label":"Before Photo Taken","field_type":"boolean","is_required":true,"group_name":"Documentation","display_order":7},
  {"entity_type":"visit","field_key":"after_photo_taken","label":"After Photo Taken","field_type":"boolean","is_required":true,"group_name":"Documentation","display_order":8},
  {"entity_type":"jobsite","field_key":"hood_type","label":"Hood Type","field_type":"enum","options":["Type I","Type II","Condensate"],"display_order":1},
  {"entity_type":"jobsite","field_key":"num_hoods","label":"Number of Hoods","field_type":"number","display_order":2},
  {"entity_type":"jobsite","field_key":"kitchen_type","label":"Kitchen Type","field_type":"enum","options":["Restaurant","Hospital","School","Hotel","Industrial"],"display_order":3}
]'::jsonb),

('cabinet_installation', 'Cabinet Installation', 'Residential and commercial cabinet installation and millwork', 'layout', '[
  {"entity_type":"service_order","field_key":"wall_number","label":"Wall Number","field_type":"text","group_name":"Location","display_order":1},
  {"entity_type":"service_order","field_key":"phase","label":"Phase","field_type":"enum","options":["Measure","Template","Rough-in","Install","Finish","Punch"],"is_required":true,"group_name":"Location","display_order":2},
  {"entity_type":"service_order","field_key":"install_order","label":"Install Order","field_type":"number","group_name":"Location","display_order":3},
  {"entity_type":"visit","field_key":"cabinets_installed","label":"Cabinets Installed","field_type":"number","group_name":"Progress","display_order":1},
  {"entity_type":"visit","field_key":"cabinets_remaining","label":"Cabinets Remaining","field_type":"number","group_name":"Progress","display_order":2},
  {"entity_type":"visit","field_key":"damage_found","label":"Damage Found","field_type":"boolean","group_name":"QC","display_order":3},
  {"entity_type":"visit","field_key":"damage_notes","label":"Damage Notes","field_type":"textarea","group_name":"QC","display_order":4},
  {"entity_type":"visit","field_key":"level_check","label":"Level Check Passed","field_type":"boolean","group_name":"QC","display_order":5},
  {"entity_type":"jobsite","field_key":"project_name","label":"Project Name","field_type":"text","is_required":true,"display_order":1},
  {"entity_type":"jobsite","field_key":"builder","label":"Builder/GC","field_type":"text","display_order":2},
  {"entity_type":"jobsite","field_key":"cabinet_brand","label":"Cabinet Brand","field_type":"text","display_order":3}
]'::jsonb),

('hvac', 'HVAC Service', 'Heating, ventilation, and air conditioning installation and maintenance', 'thermometer', '[
  {"entity_type":"visit","field_key":"supply_temp","label":"Supply Temp (°F)","field_type":"number","is_required":true,"group_name":"Readings","display_order":1},
  {"entity_type":"visit","field_key":"return_temp","label":"Return Temp (°F)","field_type":"number","is_required":true,"group_name":"Readings","display_order":2},
  {"entity_type":"visit","field_key":"temp_split","label":"Temp Split (°F)","field_type":"number","group_name":"Readings","display_order":3},
  {"entity_type":"visit","field_key":"refrigerant_pressure","label":"Refrigerant Pressure (PSI)","field_type":"number","group_name":"Readings","display_order":4},
  {"entity_type":"visit","field_key":"filter_changed","label":"Filter Changed","field_type":"boolean","group_name":"Service","display_order":5},
  {"entity_type":"visit","field_key":"filter_size","label":"Filter Size","field_type":"text","group_name":"Service","display_order":6},
  {"entity_type":"visit","field_key":"capacitor_reading","label":"Capacitor Reading (µF)","field_type":"number","group_name":"Diagnostics","display_order":7},
  {"entity_type":"visit","field_key":"amp_draw","label":"Compressor Amp Draw","field_type":"number","group_name":"Diagnostics","display_order":8},
  {"entity_type":"jobsite","field_key":"system_type","label":"System Type","field_type":"enum","options":["Split","Package","Mini-Split","Heat Pump","Furnace"],"display_order":1},
  {"entity_type":"jobsite","field_key":"tonnage","label":"Tonnage","field_type":"number","display_order":2},
  {"entity_type":"jobsite","field_key":"refrigerant_type","label":"Refrigerant Type","field_type":"enum","options":["R-410A","R-22","R-32","R-134a"],"display_order":3}
]'::jsonb),

('pest_control', 'Pest Control', 'Residential and commercial pest control and extermination services', 'bug', '[
  {"entity_type":"visit","field_key":"pests_found","label":"Pests Found","field_type":"enum","options":["None","Ants","Roaches","Spiders","Scorpions","Rodents","Termites","Bed Bugs","Wasps","Other"],"is_required":true,"group_name":"Inspection","display_order":1},
  {"entity_type":"visit","field_key":"activity_level","label":"Activity Level","field_type":"enum","options":["None","Low","Moderate","High","Severe"],"group_name":"Inspection","display_order":2},
  {"entity_type":"visit","field_key":"treatment_type","label":"Treatment Type","field_type":"enum","options":["Spray","Bait","Dust","Fumigation","Trap","Exclusion"],"is_required":true,"group_name":"Service","display_order":3},
  {"entity_type":"visit","field_key":"product_used","label":"Product Used","field_type":"text","group_name":"Service","display_order":4},
  {"entity_type":"visit","field_key":"product_amount","label":"Amount Used","field_type":"text","group_name":"Service","display_order":5},
  {"entity_type":"visit","field_key":"areas_treated","label":"Areas Treated","field_type":"textarea","group_name":"Service","display_order":6},
  {"entity_type":"visit","field_key":"entry_points","label":"Entry Points Found","field_type":"textarea","group_name":"Inspection","display_order":7},
  {"entity_type":"jobsite","field_key":"property_type","label":"Property Type","field_type":"enum","options":["Single Family","Multi-Family","Commercial","Restaurant","Warehouse"],"display_order":1},
  {"entity_type":"jobsite","field_key":"service_frequency","label":"Service Frequency","field_type":"enum","options":["Monthly","Bi-Monthly","Quarterly","One-Time"],"display_order":2}
]'::jsonb),

('duct_cleaning', 'Duct Cleaning', 'HVAC duct cleaning and indoor air quality services', 'wind', '[
  {"entity_type":"visit","field_key":"num_vents","label":"Number of Vents","field_type":"number","is_required":true,"group_name":"Scope","display_order":1},
  {"entity_type":"visit","field_key":"num_returns","label":"Number of Returns","field_type":"number","group_name":"Scope","display_order":2},
  {"entity_type":"visit","field_key":"duct_material","label":"Duct Material","field_type":"enum","options":["Sheet Metal","Flex","Fiberglass","Fiberboard"],"group_name":"System Info","display_order":3},
  {"entity_type":"visit","field_key":"contamination_level","label":"Contamination Level","field_type":"enum","options":["Light","Moderate","Heavy","Severe"],"group_name":"Inspection","display_order":4},
  {"entity_type":"visit","field_key":"mold_found","label":"Mold Found","field_type":"boolean","group_name":"Inspection","display_order":5},
  {"entity_type":"visit","field_key":"sanitizer_applied","label":"Sanitizer Applied","field_type":"boolean","group_name":"Service","display_order":6},
  {"entity_type":"visit","field_key":"dryer_vent_cleaned","label":"Dryer Vent Cleaned","field_type":"boolean","group_name":"Service","display_order":7},
  {"entity_type":"jobsite","field_key":"sq_footage","label":"Square Footage","field_type":"number","display_order":1},
  {"entity_type":"jobsite","field_key":"num_systems","label":"Number of Systems","field_type":"number","display_order":2}
]'::jsonb),

('blank', 'Blank Template', 'Start from scratch — define your own fields', 'settings', '[]'::jsonb);

-- Dev seed: demo org + user
insert into organizations (id, name, slug, template_id, plan) values
  ('a0000000-0000-0000-0000-000000000001', 'Demo Company', 'demo', 'pool_cleaning', 'pro');

-- Note: In production, users are created via Supabase Auth trigger.
-- For dev, manually insert after creating auth user.
