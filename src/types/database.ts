import { z } from "zod";

// ============================================================
// Enum Schemas
// ============================================================

export const UserRoleSchema = z.enum(["owner", "admin", "manager", "technician", "viewer"]);
export const OrgPlanSchema = z.enum(["free", "pro", "enterprise"]);
export const VisitStatusSchema = z.enum(["scheduled", "en_route", "in_progress", "completed", "skipped", "canceled"]);
export const ServiceOrderStatusSchema = z.enum([
  "draft", "pending", "approved", "scheduled",
  "in_progress", "completed", "invoiced", "canceled",
]);
export const InvoiceStatusSchema = z.enum(["draft", "sent", "paid", "overdue", "void"]);
export const UrgencyLevelSchema = z.enum(["low", "medium", "high", "emergency"]);
export const FieldTypeSchema = z.enum([
  "text", "number", "enum", "boolean", "date",
  "photo", "signature", "textarea", "email", "phone", "url",
]);
export const EntityTypeSchema = z.enum(["jobsite", "visit", "service_order", "inventory_item", "equipment"]);
export const DayOfWeekSchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export const InviteStatusSchema = z.enum(["pending", "accepted", "expired", "revoked"]);
export const DocTypeSchema = z.enum(["plan", "permit", "contract", "photo_report", "inspection", "other"]);

// ============================================================
// Table Schemas
// ============================================================

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  template_id: z.string().nullable(),
  plan: OrgPlanSchema,
  logo_url: z.string().nullable(),
  timezone: z.string(),
  settings: z.record(z.string(), z.unknown()).default({}),
  stripe_customer_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string(),
  phone: z.string().nullable(),
  avatar_url: z.string().nullable(),
  active_org_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const OrgMemberSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: UserRoleSchema,
  joined_at: z.string(),
});

export const OrgInviteSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  email: z.string().email(),
  role: UserRoleSchema,
  invited_by: z.string().uuid(),
  status: InviteStatusSchema,
  token: z.string(),
  expires_at: z.string(),
  created_at: z.string(),
});

export const FieldDefinitionSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  entity_type: EntityTypeSchema,
  field_key: z.string(),
  label: z.string(),
  field_type: FieldTypeSchema,
  options: z.unknown().nullable(),
  default_value: z.string().nullable(),
  is_required: z.boolean(),
  display_order: z.number().int(),
  group_name: z.string().nullable(),
  show_on_report: z.boolean(),
  active: z.boolean(),
  description: z.string().nullable(),
  validation: z.unknown().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const FieldValueSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  field_definition_id: z.string().uuid(),
  entity_type: EntityTypeSchema,
  entity_id: z.string().uuid(),
  value_text: z.string().nullable(),
  value_numeric: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const JobsiteSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  name: z.string(),
  contact_name: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_phone: z.string().nullable(),
  address_line1: z.string(),
  address_line2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  geofence_radius_m: z.number().nullable().optional(),
  geocoded_at: z.string().nullable().optional(),
  access_notes: z.string().nullable(),
  status: z.string(),
  tags: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});

export const RouteSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  name: z.string(),
  technician_id: z.string().uuid(),
  day_of_week: DayOfWeekSchema,
  optimized_order: z.unknown().default([]),
  total_estimated_minutes: z.number().nullable(),
  total_distance_miles: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const VisitSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  jobsite_id: z.string().uuid(),
  technician_id: z.string().uuid(),
  route_id: z.string().uuid().nullable(),
  scheduled_date: z.string(),
  scheduled_time: z.string().nullable(),
  arrived_at: z.string().nullable(),
  departed_at: z.string().nullable(),
  arrived_lat: z.number().nullable(),
  arrived_lng: z.number().nullable(),
  departed_lat: z.number().nullable(),
  departed_lng: z.number().nullable(),
  geofence_radius_meters: z.number().nullable(),
  geofence_verified: z.boolean().nullable(),
  status: VisitStatusSchema,
  notes: z.string().nullable(),
  duration_minutes: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ServiceOrderSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  jobsite_id: z.string().uuid(),
  visit_id: z.string().uuid().nullable(),
  assigned_to: z.string().uuid().nullable(),
  requested_by: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  urgency: UrgencyLevelSchema,
  status: ServiceOrderStatusSchema,
  estimated_cost: z.number().nullable(),
  actual_cost: z.number().nullable(),
  scheduled_date: z.string().nullable(),
  completed_at: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});

export const PhotoSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  entity_type: EntityTypeSchema,
  entity_id: z.string().uuid(),
  storage_url: z.string(),
  thumbnail_url: z.string().nullable(),
  caption: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  taken_at: z.string().nullable(),
  uploaded_by: z.string().uuid().nullable(),
  created_at: z.string(),
});

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  entity_type: EntityTypeSchema.nullable(),
  entity_id: z.string().uuid().nullable(),
  doc_type: DocTypeSchema,
  name: z.string(),
  storage_url: z.string(),
  file_size_bytes: z.number().nullable(),
  mime_type: z.string().nullable(),
  uploaded_by: z.string().uuid().nullable(),
  created_at: z.string(),
});

export const SignatureSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  entity_type: EntityTypeSchema,
  entity_id: z.string().uuid(),
  signer_name: z.string(),
  signer_email: z.string().nullable(),
  signer_role: z.string().nullable(),
  signature_url: z.string(),
  ip_address: z.string().nullable(),
  signed_at: z.string(),
  created_at: z.string(),
});

export const EquipmentSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  jobsite_id: z.string().uuid(),
  name: z.string(),
  equipment_type: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  serial_number: z.string().nullable(),
  install_date: z.string().nullable(),
  warranty_expiry: z.string().nullable(),
  last_serviced: z.string().nullable(),
  condition: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const InventorySchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  name: z.string(),
  sku: z.string().nullable(),
  category: z.string().nullable(),
  unit: z.string().nullable(),
  unit_cost: z.number().nullable(),
  quantity_on_hand: z.number(),
  reorder_point: z.number().nullable(),
  location_type: z.string(),
  location_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const InventoryUsageSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  inventory_id: z.string().uuid(),
  visit_id: z.string().uuid().nullable(),
  service_order_id: z.string().uuid().nullable(),
  quantity_used: z.number(),
  used_by: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  used_at: z.string(),
});

export const IndustryTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  field_definitions: z.unknown(),
  default_settings: z.unknown(),
  created_at: z.string(),
});

// ============================================================
// TypeScript Types
// ============================================================

export type UserRole = z.infer<typeof UserRoleSchema>;
export type OrgPlan = z.infer<typeof OrgPlanSchema>;
export type VisitStatus = z.infer<typeof VisitStatusSchema>;
export type ServiceOrderStatus = z.infer<typeof ServiceOrderStatusSchema>;
export type UrgencyLevel = z.infer<typeof UrgencyLevelSchema>;
export type FieldType = z.infer<typeof FieldTypeSchema>;
export type EntityType = z.infer<typeof EntityTypeSchema>;
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;
export type InviteStatus = z.infer<typeof InviteStatusSchema>;
export type DocType = z.infer<typeof DocTypeSchema>;

export type Organization = z.infer<typeof OrganizationSchema>;
export type User = z.infer<typeof UserSchema>;
export type OrgMember = z.infer<typeof OrgMemberSchema>;
export type OrgInvite = z.infer<typeof OrgInviteSchema>;
export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>;
export type FieldValue = z.infer<typeof FieldValueSchema>;
export type Jobsite = z.infer<typeof JobsiteSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type Visit = z.infer<typeof VisitSchema>;
export type ServiceOrder = z.infer<typeof ServiceOrderSchema>;
export type Photo = z.infer<typeof PhotoSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type Signature = z.infer<typeof SignatureSchema>;
export type Equipment = z.infer<typeof EquipmentSchema>;
export type Inventory = z.infer<typeof InventorySchema>;
export type InventoryUsage = z.infer<typeof InventoryUsageSchema>;
export type IndustryTemplate = z.infer<typeof IndustryTemplateSchema>;

// ============================================================
// Form Input Schemas
// ============================================================

export const ServiceOrderFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  urgency: UrgencyLevelSchema,
  estimated_cost: z.coerce.number().min(0).optional(),
});

export type ServiceOrderForm = z.infer<typeof ServiceOrderFormSchema>;

// ============================================================
// Extended types for UI (joined data)
// ============================================================

export interface RouteStop extends Visit {
  jobsite: Jobsite;
  equipment: Equipment[];
  order_index: number;
}

export interface VisitDetail extends Visit {
  jobsite: Jobsite;
  field_values: FieldValue[];
  photos: Photo[];
  service_orders: ServiceOrder[];
}
