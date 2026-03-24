// Database types matching the Supabase schema

export type UserRole = 'admin' | 'office' | 'technician' | 'customer';
export type PoolType = 'chlorine' | 'saltwater' | 'other';
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type CustomerStatus = 'active' | 'inactive' | 'lead';
export type VisitStatus = 'scheduled' | 'in_progress' | 'completed' | 'skipped';
export type ChemicalUnit = 'oz' | 'lbs' | 'gallons' | 'tablets';
export type PhotoType = 'before' | 'after' | 'issue' | 'equipment';
export type RepairCategory = 'pump' | 'filter' | 'pipe' | 'heater' | 'tile' | 'acid_wash' | 'resurface' | 'electrical' | 'plumbing' | 'other';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'emergency';
export type RepairStatus = 'pending_review' | 'quoted' | 'approved' | 'scheduled' | 'in_progress' | 'completed' | 'declined';
export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';
export type InvoiceType = 'recurring' | 'one_time';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
export type EquipmentType = 'pump' | 'filter' | 'heater' | 'salt_cell' | 'automation' | 'cleaner' | 'light' | 'other';
export type EquipmentCondition = 'good' | 'fair' | 'poor' | 'needs_replacement';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  gate_code: string | null;
  access_notes: string | null;
  pool_type: PoolType;
  pool_volume_gallons: number | null;
  service_day: DayOfWeek | null;
  monthly_rate: number | null;
  status: CustomerStatus;
  created_at: string;
  updated_at: string;
}

export interface Route {
  id: string;
  name: string;
  technician_id: string;
  day_of_week: DayOfWeek;
  optimized_order: string[];
  total_estimated_minutes: number | null;
  total_distance_miles: number | null;
  created_at: string;
  updated_at: string;
  technician?: User;
}

export interface ServiceVisit {
  id: string;
  customer_id: string;
  technician_id: string;
  route_id: string | null;
  scheduled_date: string;
  arrived_at: string | null;
  departed_at: string | null;
  arrived_lat: number | null;
  arrived_lng: number | null;
  departed_lat: number | null;
  departed_lng: number | null;
  arrived_distance_meters?: number | null;
  geofence_flagged?: boolean;
  checklist?: Record<string, boolean> | null;
  status: VisitStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  technician?: User;
}

export interface ChemicalLog {
  id: string;
  visit_id: string;
  chemical_name: string | null;
  amount: number | null;
  unit: ChemicalUnit | null;
  ph_before: number | null;
  ph_after: number | null;
  chlorine_before: number | null;
  chlorine_after: number | null;
  alkalinity_before: number | null;
  alkalinity_after: number | null;
  cya_before: number | null;
  cya_after: number | null;
  calcium_hardness: number | null;
  salt_level: number | null;
  water_temp: number | null;
  logged_at: string;
}

export interface VisitPhoto {
  id: string;
  visit_id: string;
  storage_url: string;
  caption: string | null;
  photo_type: PhotoType;
  lat: number | null;
  lng: number | null;
  taken_at: string | null;
  uploaded_at: string;
}

export interface RepairRequest {
  id: string;
  visit_id: string | null;
  customer_id: string;
  requested_by: string;
  category: RepairCategory;
  description: string;
  urgency: UrgencyLevel;
  estimated_cost: number | null;
  status: RepairStatus;
  photos: string[];
  created_at: string;
  updated_at: string;
  customer?: Customer;
  requester?: User;
}

export interface Quote {
  id: string;
  repair_request_id: string | null;
  customer_id: string;
  created_by: string;
  line_items: Record<string, unknown>[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: QuoteStatus;
  valid_until: string | null;
  stripe_invoice_id: string | null;
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  customer_id: string;
  quote_id: string | null;
  type: InvoiceType;
  line_items: Record<string, unknown>[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: InvoiceStatus;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface EquipmentInventory {
  id: string;
  customer_id: string;
  equipment_type: EquipmentType;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  install_date: string | null;
  warranty_expiry: string | null;
  last_serviced: string | null;
  condition: EquipmentCondition;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}
