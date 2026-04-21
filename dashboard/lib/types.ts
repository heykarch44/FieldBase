// Database types matching the FieldBase Supabase schema

export type UserRole = 'owner' | 'admin' | 'manager' | 'technician' | 'viewer';
export type OrgPlan = 'free' | 'pro' | 'enterprise';
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type VisitStatus = 'scheduled' | 'en_route' | 'in_progress' | 'completed' | 'skipped' | 'canceled';
export type ServiceOrderStatus = 'draft' | 'pending' | 'approved' | 'scheduled' | 'in_progress' | 'completed' | 'invoiced' | 'canceled';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'emergency';
export type FieldType = 'text' | 'number' | 'enum' | 'boolean' | 'date' | 'photo' | 'signature' | 'textarea' | 'email' | 'phone' | 'url';
export type EntityType = 'jobsite' | 'visit' | 'service_order' | 'inventory_item' | 'equipment';
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type DocType = 'plan' | 'permit' | 'contract' | 'photo_report' | 'inspection' | 'other';

export type OrgStatus = 'waitlist' | 'active' | 'suspended';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  template_id: string | null;
  plan: OrgPlan;
  status: OrgStatus;
  logo_url: string | null;
  timezone: string;
  settings: Record<string, unknown>;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  active_org_id: string | null;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: UserRole;
  joined_at: string;
  user?: User;
}

export interface OrgInvite {
  id: string;
  org_id: string;
  email: string;
  role: UserRole;
  invited_by: string;
  status: InviteStatus;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface FieldDefinition {
  id: string;
  org_id: string;
  entity_type: EntityType;
  field_key: string;
  label: string;
  field_type: FieldType;
  options: unknown;
  default_value: string | null;
  is_required: boolean;
  display_order: number;
  group_name: string | null;
  show_on_report: boolean;
  active: boolean;
  description: string | null;
  validation: unknown;
  created_at: string;
  updated_at: string;
}

export interface FieldValue {
  id: string;
  org_id: string;
  field_definition_id: string;
  entity_type: EntityType;
  entity_id: string;
  value_text: string | null;
  value_numeric: number | null;
  created_at: string;
  updated_at: string;
}

export interface JobsiteAssignee {
  id: string;
  jobsite_id: string;
  user_id: string;
  org_id: string;
  assigned_at: string;
  user?: { id: string; full_name: string | null; email: string };
}

export interface Jobsite {
  id: string;
  org_id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  access_notes: string | null;
  status: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  assignees?: JobsiteAssignee[];
}

export interface Route {
  id: string;
  org_id: string;
  name: string;
  technician_id: string;
  day_of_week: DayOfWeek;
  optimized_order: unknown;
  total_estimated_minutes: number | null;
  total_distance_miles: number | null;
  created_at: string;
  updated_at: string;
  technician?: User;
}

export interface Visit {
  id: string;
  org_id: string;
  jobsite_id: string;
  technician_id: string;
  route_id: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  arrived_at: string | null;
  departed_at: string | null;
  arrived_lat: number | null;
  arrived_lng: number | null;
  departed_lat: number | null;
  departed_lng: number | null;
  geofence_radius_meters: number | null;
  geofence_verified: boolean | null;
  status: VisitStatus;
  notes: string | null;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
  jobsite?: Jobsite;
  technician?: User;
}

export interface ServiceOrderAssignee {
  id: string;
  service_order_id: string;
  user_id: string;
  org_id: string;
  assigned_at: string;
  user?: User;
}

export interface ServiceOrder {
  id: string;
  org_id: string;
  jobsite_id: string;
  visit_id: string | null;
  assigned_to: string | null;
  requested_by: string | null;
  title: string;
  description: string | null;
  urgency: UrgencyLevel;
  status: ServiceOrderStatus;
  estimated_cost: number | null;
  actual_cost: number | null;
  scheduled_date: string | null;
  completed_at: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  jobsite?: Jobsite;
  assignee?: User;
  requester?: User;
  assignees?: ServiceOrderAssignee[];
}

export interface Photo {
  id: string;
  org_id: string;
  entity_type: EntityType;
  entity_id: string;
  storage_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  tags: string[];
  lat: number | null;
  lng: number | null;
  taken_at: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface SitePhoto {
  id: string;
  org_id: string;
  jobsite_id: string;
  service_order_id: string | null;
  visit_id: string | null;
  uploaded_by: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
  uploader?: { id: string; full_name: string | null; email: string };
}

export interface Signature {
  id: string;
  org_id: string;
  entity_type: EntityType;
  entity_id: string;
  signer_name: string;
  signer_email: string | null;
  signer_role: string | null;
  signature_url: string;
  ip_address: string | null;
  signed_at: string;
  created_at: string;
}

export interface Equipment {
  id: string;
  org_id: string;
  jobsite_id: string;
  name: string;
  equipment_type: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  install_date: string | null;
  warranty_expiry: string | null;
  last_serviced: string | null;
  condition: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  id: string;
  org_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string | null;
  unit_cost: number | null;
  quantity_on_hand: number;
  reorder_point: number | null;
  location_type: string;
  location_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryUsage {
  id: string;
  org_id: string;
  inventory_id: string;
  visit_id: string | null;
  service_order_id: string | null;
  quantity_used: number;
  used_by: string | null;
  notes: string | null;
  used_at: string;
}

export interface IndustryTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  field_definitions: unknown;
  default_settings: unknown;
  created_at: string;
}
