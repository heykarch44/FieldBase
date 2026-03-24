export const SERVICE_CHECKLIST_ITEMS = [
  { key: "skim_surface", label: "Skim surface" },
  { key: "brush_walls", label: "Brush walls & tile" },
  { key: "vacuum_pool", label: "Vacuum pool" },
  { key: "empty_skimmer_baskets", label: "Empty skimmer baskets" },
  { key: "empty_pump_basket", label: "Empty pump basket" },
  { key: "backwash_filter", label: "Backwash filter (if applicable)" },
  { key: "check_equipment", label: "Check equipment operation" },
] as const;

export type ChecklistKey = (typeof SERVICE_CHECKLIST_ITEMS)[number]["key"];

export const CHEMICAL_NAMES = [
  "Liquid Chlorine",
  "Muriatic Acid",
  "Chlorine Tablets",
  "Algaecide",
  "CYA Stabilizer",
  "Calcium Increaser",
  "Salt",
  "Other",
] as const;

export const CHEMICAL_UNITS = ["oz", "lbs", "gallons", "tablets"] as const;

export const REPAIR_CATEGORIES = [
  "pump",
  "filter",
  "pipe",
  "heater",
  "tile",
  "acid_wash",
  "resurface",
  "electrical",
  "plumbing",
  "other",
] as const;

export const URGENCY_LEVELS = ["low", "medium", "high", "emergency"] as const;

export const PHOTO_TYPES = ["before", "after", "issue", "equipment"] as const;
