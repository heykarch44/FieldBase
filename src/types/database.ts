import { z } from "zod";

// ============================================================
// Enum Schemas
// ============================================================

export const UserRoleSchema = z.enum(["admin", "office", "technician", "customer"]);
export const PoolTypeSchema = z.enum(["chlorine", "saltwater", "other"]);
export const DayOfWeekSchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export const CustomerStatusSchema = z.enum(["active", "inactive", "lead"]);
export const VisitStatusSchema = z.enum(["scheduled", "in_progress", "completed", "skipped"]);
export const ChemicalUnitSchema = z.enum(["oz", "lbs", "gallons", "tablets"]);
export const PhotoTypeSchema = z.enum(["before", "after", "issue", "equipment"]);
export const RepairCategorySchema = z.enum([
  "pump", "filter", "pipe", "heater", "tile",
  "acid_wash", "resurface", "electrical", "plumbing", "other",
]);
export const UrgencyLevelSchema = z.enum(["low", "medium", "high", "emergency"]);
export const RepairStatusSchema = z.enum([
  "pending_review", "quoted", "approved", "scheduled",
  "in_progress", "completed", "declined",
]);
export const EquipmentTypeSchema = z.enum([
  "pump", "filter", "heater", "salt_cell",
  "automation", "cleaner", "light", "other",
]);
export const EquipmentConditionSchema = z.enum(["good", "fair", "poor", "needs_replacement"]);

// ============================================================
// Table Schemas
// ============================================================

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string(),
  phone: z.string().nullable(),
  role: UserRoleSchema,
  avatar_url: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CustomerSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address_line1: z.string(),
  address_line2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  gate_code: z.string().nullable(),
  access_notes: z.string().nullable(),
  pool_type: PoolTypeSchema,
  pool_volume_gallons: z.number().nullable(),
  service_day: DayOfWeekSchema.nullable(),
  monthly_rate: z.number().nullable(),
  status: CustomerStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const RouteSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  technician_id: z.string().uuid(),
  day_of_week: DayOfWeekSchema,
  optimized_order: z.array(z.string()).default([]),
  total_estimated_minutes: z.number().nullable(),
  total_distance_miles: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ServiceVisitSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  technician_id: z.string().uuid(),
  route_id: z.string().uuid().nullable(),
  scheduled_date: z.string(),
  arrived_at: z.string().nullable(),
  departed_at: z.string().nullable(),
  arrived_lat: z.number().nullable(),
  arrived_lng: z.number().nullable(),
  departed_lat: z.number().nullable(),
  departed_lng: z.number().nullable(),
  arrived_distance_meters: z.number().nullable().optional(),
  geofence_flagged: z.boolean().optional(),
  status: VisitStatusSchema,
  notes: z.string().nullable(),
  checklist: z.record(z.string(), z.boolean()).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ChemicalLogSchema = z.object({
  id: z.string().uuid(),
  visit_id: z.string().uuid(),
  chemical_name: z.string().nullable(),
  amount: z.number().nullable(),
  unit: ChemicalUnitSchema.nullable(),
  ph_before: z.number().nullable(),
  ph_after: z.number().nullable(),
  chlorine_before: z.number().nullable(),
  chlorine_after: z.number().nullable(),
  alkalinity_before: z.number().nullable(),
  alkalinity_after: z.number().nullable(),
  cya_before: z.number().nullable(),
  cya_after: z.number().nullable(),
  calcium_hardness: z.number().nullable(),
  salt_level: z.number().nullable(),
  water_temp: z.number().nullable(),
  logged_at: z.string(),
});

export const VisitPhotoSchema = z.object({
  id: z.string().uuid(),
  visit_id: z.string().uuid(),
  storage_url: z.string(),
  caption: z.string().nullable(),
  photo_type: PhotoTypeSchema,
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  taken_at: z.string().nullable(),
  uploaded_at: z.string(),
});

export const RepairRequestSchema = z.object({
  id: z.string().uuid(),
  visit_id: z.string().uuid().nullable(),
  customer_id: z.string().uuid(),
  requested_by: z.string().uuid(),
  category: RepairCategorySchema,
  description: z.string(),
  urgency: UrgencyLevelSchema,
  estimated_cost: z.number().nullable(),
  status: RepairStatusSchema,
  photos: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});

export const EquipmentInventorySchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  equipment_type: EquipmentTypeSchema,
  brand: z.string().nullable(),
  model: z.string().nullable(),
  serial_number: z.string().nullable(),
  install_date: z.string().nullable(),
  warranty_expiry: z.string().nullable(),
  last_serviced: z.string().nullable(),
  condition: EquipmentConditionSchema,
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// ============================================================
// TypeScript Types
// ============================================================

export type UserRole = z.infer<typeof UserRoleSchema>;
export type PoolType = z.infer<typeof PoolTypeSchema>;
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;
export type CustomerStatus = z.infer<typeof CustomerStatusSchema>;
export type VisitStatus = z.infer<typeof VisitStatusSchema>;
export type ChemicalUnit = z.infer<typeof ChemicalUnitSchema>;
export type PhotoType = z.infer<typeof PhotoTypeSchema>;
export type RepairCategory = z.infer<typeof RepairCategorySchema>;
export type UrgencyLevel = z.infer<typeof UrgencyLevelSchema>;
export type RepairStatus = z.infer<typeof RepairStatusSchema>;
export type EquipmentType = z.infer<typeof EquipmentTypeSchema>;
export type EquipmentCondition = z.infer<typeof EquipmentConditionSchema>;

export type User = z.infer<typeof UserSchema>;
export type Customer = z.infer<typeof CustomerSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type ServiceVisit = z.infer<typeof ServiceVisitSchema>;
export type ChemicalLog = z.infer<typeof ChemicalLogSchema>;
export type VisitPhoto = z.infer<typeof VisitPhotoSchema>;
export type RepairRequest = z.infer<typeof RepairRequestSchema>;
export type EquipmentInventory = z.infer<typeof EquipmentInventorySchema>;

// ============================================================
// Form Input Schemas (for React Hook Form)
// ============================================================

export const ChemicalReadingsFormSchema = z.object({
  ph_before: z.coerce.number().min(0).max(14).optional(),
  ph_after: z.coerce.number().min(0).max(14).optional(),
  chlorine_before: z.coerce.number().min(0).optional(),
  chlorine_after: z.coerce.number().min(0).optional(),
  alkalinity_before: z.coerce.number().int().min(0).optional(),
  alkalinity_after: z.coerce.number().int().min(0).optional(),
  cya_before: z.coerce.number().int().min(0).optional(),
  cya_after: z.coerce.number().int().min(0).optional(),
  calcium_hardness: z.coerce.number().int().min(0).optional(),
  salt_level: z.coerce.number().int().min(0).optional(),
  water_temp: z.coerce.number().min(0).max(150).optional(),
});

export const ChemicalAddedFormSchema = z.object({
  chemical_name: z.string().min(1, "Select a chemical"),
  amount: z.coerce.number().positive("Amount must be positive"),
  unit: ChemicalUnitSchema,
});

export const RepairRequestFormSchema = z.object({
  category: RepairCategorySchema,
  description: z.string().min(5, "Description must be at least 5 characters"),
  urgency: UrgencyLevelSchema,
  estimated_cost: z.coerce.number().min(0).optional(),
});

export type ChemicalReadingsForm = z.infer<typeof ChemicalReadingsFormSchema>;
export type ChemicalAddedForm = z.infer<typeof ChemicalAddedFormSchema>;
export type RepairRequestForm = z.infer<typeof RepairRequestFormSchema>;

// ============================================================
// Extended types for UI (joined data)
// ============================================================

export interface RouteStop extends ServiceVisit {
  customer: Customer;
  equipment: EquipmentInventory[];
  order_index: number;
}

export interface VisitDetail extends ServiceVisit {
  customer: Customer;
  chemical_logs: ChemicalLog[];
  photos: VisitPhoto[];
  repair_requests: RepairRequest[];
}
