import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync("fieldiq.db");
    await initializeDb(db);
  }
  return db;
}

async function initializeDb(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS cached_routes (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cached_jobsites (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cached_visits (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cached_equipment (
      id TEXT PRIMARY KEY,
      jobsite_id TEXT NOT NULL,
      data TEXT NOT NULL,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cached_field_definitions (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      data TEXT NOT NULL,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cached_field_values (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      data TEXT NOT NULL,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cached_photos (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      data TEXT NOT NULL,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL,
      record_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      retry_count INTEGER DEFAULT 0,
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS photo_upload_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_uri TEXT NOT NULL,
      entity_type TEXT NOT NULL DEFAULT 'visit',
      entity_id TEXT NOT NULL,
      caption TEXT,
      lat REAL,
      lng REAL,
      taken_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      retry_count INTEGER DEFAULT 0,
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS conflict_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      local_data TEXT NOT NULL,
      server_data TEXT NOT NULL,
      resolved_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ============================================================
// Cache Operations
// ============================================================

export async function cacheRoutes(routes: Array<{ id: string } & Record<string, unknown>>): Promise<void> {
  const database = await getDb();
  await database.execAsync("DELETE FROM cached_routes");
  for (const route of routes) {
    await database.runAsync(
      "INSERT OR REPLACE INTO cached_routes (id, data) VALUES (?, ?)",
      [route.id, JSON.stringify(route)]
    );
  }
}

export async function getCachedRoutes<T>(): Promise<T[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ data: string }>(
    "SELECT data FROM cached_routes"
  );
  return rows.map((r) => JSON.parse(r.data));
}

export async function cacheJobsites(jobsites: Array<{ id: string } & Record<string, unknown>>): Promise<void> {
  const database = await getDb();
  await database.execAsync("DELETE FROM cached_jobsites");
  for (const jobsite of jobsites) {
    await database.runAsync(
      "INSERT OR REPLACE INTO cached_jobsites (id, data) VALUES (?, ?)",
      [jobsite.id, JSON.stringify(jobsite)]
    );
  }
}

export async function getCachedJobsites<T>(): Promise<T[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ data: string }>(
    "SELECT data FROM cached_jobsites"
  );
  return rows.map((r) => JSON.parse(r.data));
}

export async function getCachedJobsite<T>(id: string): Promise<T | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ data: string }>(
    "SELECT data FROM cached_jobsites WHERE id = ?",
    [id]
  );
  return row ? JSON.parse(row.data) : null;
}

export async function cacheVisits(visits: Array<{ id: string } & Record<string, unknown>>): Promise<void> {
  const database = await getDb();
  await database.execAsync("DELETE FROM cached_visits");
  for (const visit of visits) {
    await database.runAsync(
      "INSERT OR REPLACE INTO cached_visits (id, data) VALUES (?, ?)",
      [visit.id, JSON.stringify(visit)]
    );
  }
}

export async function getCachedVisits<T>(): Promise<T[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ data: string }>(
    "SELECT data FROM cached_visits"
  );
  return rows.map((r) => JSON.parse(r.data));
}

export async function updateCachedVisit(id: string, data: Record<string, unknown>): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "INSERT OR REPLACE INTO cached_visits (id, data) VALUES (?, ?)",
    [id, JSON.stringify(data)]
  );
}

export async function cacheEquipment(
  equipment: Array<{ id: string; jobsite_id: string } & Record<string, unknown>>
): Promise<void> {
  const database = await getDb();
  await database.execAsync("DELETE FROM cached_equipment");
  for (const item of equipment) {
    await database.runAsync(
      "INSERT OR REPLACE INTO cached_equipment (id, jobsite_id, data) VALUES (?, ?, ?)",
      [item.id, item.jobsite_id, JSON.stringify(item)]
    );
  }
}

export async function getCachedEquipment<T>(jobsiteId: string): Promise<T[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ data: string }>(
    "SELECT data FROM cached_equipment WHERE jobsite_id = ?",
    [jobsiteId]
  );
  return rows.map((r) => JSON.parse(r.data));
}

export async function cacheFieldDefinitions(
  fields: Array<{ id: string; org_id: string } & Record<string, unknown>>
): Promise<void> {
  const database = await getDb();
  await database.execAsync("DELETE FROM cached_field_definitions");
  for (const field of fields) {
    await database.runAsync(
      "INSERT OR REPLACE INTO cached_field_definitions (id, org_id, data) VALUES (?, ?, ?)",
      [field.id, field.org_id, JSON.stringify(field)]
    );
  }
}

export async function getCachedFieldDefinitions<T>(orgId: string): Promise<T[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ data: string }>(
    "SELECT data FROM cached_field_definitions WHERE org_id = ?",
    [orgId]
  );
  return rows.map((r) => JSON.parse(r.data));
}

// ============================================================
// Sync Queue Operations
// ============================================================

export async function enqueueAction(
  tableName: string,
  operation: "insert" | "update" | "upsert",
  recordId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "INSERT INTO sync_queue (table_name, operation, record_id, payload) VALUES (?, ?, ?, ?)",
    [tableName, operation, recordId, JSON.stringify(payload)]
  );
}

export async function getQueuedActions(): Promise<
  Array<{
    id: number;
    table_name: string;
    operation: string;
    record_id: string;
    payload: string;
    retry_count: number;
  }>
> {
  const database = await getDb();
  return database.getAllAsync(
    "SELECT * FROM sync_queue ORDER BY created_at ASC"
  );
}

export async function removeQueuedAction(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM sync_queue WHERE id = ?", [id]);
}

export async function incrementRetry(id: number, error: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?",
    [error, id]
  );
}

// ============================================================
// Photo Upload Queue
// ============================================================

export async function enqueuePhotoUpload(params: {
  localUri: string;
  entityType: string;
  entityId: string;
  caption?: string;
  lat?: number;
  lng?: number;
  takenAt?: string;
}): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO photo_upload_queue (local_uri, entity_type, entity_id, caption, lat, lng, taken_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.localUri,
      params.entityType,
      params.entityId,
      params.caption ?? null,
      params.lat ?? null,
      params.lng ?? null,
      params.takenAt ?? null,
    ]
  );
}

export async function getQueuedPhotos(): Promise<
  Array<{
    id: number;
    local_uri: string;
    entity_type: string;
    entity_id: string;
    caption: string | null;
    lat: number | null;
    lng: number | null;
    taken_at: string | null;
    retry_count: number;
  }>
> {
  const database = await getDb();
  return database.getAllAsync(
    "SELECT * FROM photo_upload_queue ORDER BY created_at ASC"
  );
}

export async function removeQueuedPhoto(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM photo_upload_queue WHERE id = ?", [id]);
}

// ============================================================
// Conflict Log
// ============================================================

export async function logConflict(
  tableName: string,
  recordId: string,
  localData: unknown,
  serverData: unknown
): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "INSERT INTO conflict_log (table_name, record_id, local_data, server_data) VALUES (?, ?, ?, ?)",
    [tableName, recordId, JSON.stringify(localData), JSON.stringify(serverData)]
  );
}

export async function getPendingQueueCount(): Promise<number> {
  const database = await getDb();
  const syncResult = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sync_queue"
  );
  const photoResult = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM photo_upload_queue"
  );
  return (syncResult?.count ?? 0) + (photoResult?.count ?? 0);
}
