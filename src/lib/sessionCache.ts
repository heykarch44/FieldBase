// Cache the supabase session + org id in SecureStore so the background
// geofence task (which runs outside the React tree) can make authenticated
// inserts. Called on login / auth state changes and cleared on sign-out.

import * as SecureStore from "expo-secure-store";

const USER_ID_KEY = "fieldiq_bg_user_id";
const ORG_ID_KEY = "fieldiq_bg_org_id";
const ACCESS_TOKEN_KEY = "fieldiq_bg_access_token";
const REFRESH_TOKEN_KEY = "fieldiq_bg_refresh_token";
const ASSIGNED_SITES_KEY = "fieldiq_bg_assigned_sites";
const CLOCK_IN_LABEL_KEY = "fieldiq_bg_clock_in_label";
const CLOCK_OUT_LABEL_KEY = "fieldiq_bg_clock_out_label";
const LAST_POSITION_KEY = "fieldiq_bg_last_position";
const SAMPLE_HISTORY_KEY = "fieldiq_bg_sample_history";
const DIAG_LOG_KEY = "fieldiq_bg_diag_log";
const SITE_OUTSIDE_FIRST_KEY = "fieldiq_bg_site_outside_first";

export interface CachedSession {
  userId: string;
  orgId: string | null;
  accessToken: string;
  refreshToken: string | null;
}

export async function writeSessionCache(session: CachedSession): Promise<void> {
  await SecureStore.setItemAsync(USER_ID_KEY, session.userId);
  if (session.orgId) {
    await SecureStore.setItemAsync(ORG_ID_KEY, session.orgId);
  } else {
    await SecureStore.deleteItemAsync(ORG_ID_KEY);
  }
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken);
  if (session.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}

export async function readSessionCache(): Promise<CachedSession | null> {
  const [userId, orgId, accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(USER_ID_KEY),
    SecureStore.getItemAsync(ORG_ID_KEY),
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  if (!userId || !accessToken) return null;
  return {
    userId,
    orgId: orgId ?? null,
    accessToken,
    refreshToken: refreshToken ?? null,
  };
}

export async function clearSessionCache(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(USER_ID_KEY),
    SecureStore.deleteItemAsync(ORG_ID_KEY),
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(ASSIGNED_SITES_KEY),
    SecureStore.deleteItemAsync(CLOCK_IN_LABEL_KEY),
    SecureStore.deleteItemAsync(CLOCK_OUT_LABEL_KEY),
    SecureStore.deleteItemAsync(LAST_POSITION_KEY),
    SecureStore.deleteItemAsync(SAMPLE_HISTORY_KEY),
    SecureStore.deleteItemAsync(DIAG_LOG_KEY),
    SecureStore.deleteItemAsync(SITE_OUTSIDE_FIRST_KEY),
  ]);
}

export async function updateCachedOrgId(orgId: string | null): Promise<void> {
  if (orgId) {
    await SecureStore.setItemAsync(ORG_ID_KEY, orgId);
  } else {
    await SecureStore.deleteItemAsync(ORG_ID_KEY);
  }
}

// Assigned sites must be available to the background location task, which
// runs outside the React tree. We write this whenever the user's assignment
// list changes in the UI.
export interface CachedSite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
}

// Per-org labels used on the mobile clock-in/clock-out notification. The
// notification fires from background tasks so we cache these in SecureStore.
export interface CachedClockLabels {
  clockIn: string;
  clockOut: string;
}

const DEFAULT_CLOCK_LABELS: CachedClockLabels = {
  clockIn: "Clocked In",
  clockOut: "Clocked Out",
};

export async function writeCachedClockLabels(
  labels: CachedClockLabels
): Promise<void> {
  await SecureStore.setItemAsync(CLOCK_IN_LABEL_KEY, labels.clockIn);
  await SecureStore.setItemAsync(CLOCK_OUT_LABEL_KEY, labels.clockOut);
}

export async function readCachedClockLabels(): Promise<CachedClockLabels> {
  const [clockIn, clockOut] = await Promise.all([
    SecureStore.getItemAsync(CLOCK_IN_LABEL_KEY),
    SecureStore.getItemAsync(CLOCK_OUT_LABEL_KEY),
  ]);
  return {
    clockIn: clockIn && clockIn.trim() ? clockIn : DEFAULT_CLOCK_LABELS.clockIn,
    clockOut:
      clockOut && clockOut.trim() ? clockOut : DEFAULT_CLOCK_LABELS.clockOut,
  };
}

export async function writeCachedSites(sites: CachedSite[]): Promise<void> {
  await SecureStore.setItemAsync(ASSIGNED_SITES_KEY, JSON.stringify(sites));
}

export async function readCachedSites(): Promise<CachedSite[]> {
  const raw = await SecureStore.getItemAsync(ASSIGNED_SITES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CachedSite[]) : [];
  } catch {
    return [];
  }
}

// Last-known background position. Persisted on every sample we receive in
// the background tasks so that on next foreground we can:
//   - back-date late events using the cached "first outside" timestamp
//   - reconcile clock state without waiting for a fresh GPS fix
export interface CachedPosition {
  lat: number;
  lng: number;
  accuracyM: number | null;
  // Timestamp the OS reported on the location sample, in ms since epoch.
  // Falls back to receipt time if the OS didn't include one.
  sampledAt: number;
  // Wall-clock time we received the sample. Useful to detect stale OS
  // deliveries (sampledAt vs receivedAt diverging).
  receivedAt: number;
}

export async function writeLastPosition(pos: CachedPosition): Promise<void> {
  await SecureStore.setItemAsync(LAST_POSITION_KEY, JSON.stringify(pos));
}

export async function readLastPosition(): Promise<CachedPosition | null> {
  const raw = await SecureStore.getItemAsync(LAST_POSITION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedPosition;
  } catch {
    return null;
  }
}

// Rolling sample history (most recent N), so foreground reconcile can pick
// the earliest "outside" sample to back-date a clock_out. We keep this
// small to bound SecureStore writes — last 30 samples is ~15 min at 30s.
const MAX_SAMPLES = 30;

export async function appendSample(pos: CachedPosition): Promise<void> {
  const raw = await SecureStore.getItemAsync(SAMPLE_HISTORY_KEY);
  let samples: CachedPosition[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) samples = parsed as CachedPosition[];
    } catch {
      samples = [];
    }
  }
  samples.push(pos);
  if (samples.length > MAX_SAMPLES) {
    samples = samples.slice(samples.length - MAX_SAMPLES);
  }
  await SecureStore.setItemAsync(SAMPLE_HISTORY_KEY, JSON.stringify(samples));
}

export async function readSamples(): Promise<CachedPosition[]> {
  const raw = await SecureStore.getItemAsync(SAMPLE_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CachedPosition[]) : [];
  } catch {
    return [];
  }
}

export async function clearSamples(): Promise<void> {
  await SecureStore.deleteItemAsync(SAMPLE_HISTORY_KEY);
}

// Per-site "first observed outside" timestamp. We persist this so that
// even if the OS kills the JS process, dwell tracking can still back-date
// the clock_out using the earliest evidence we have.
//
// Map<siteId, ms-since-epoch>.
export type SiteOutsideMap = Record<string, number>;

export async function readSiteOutsideMap(): Promise<SiteOutsideMap> {
  const raw = await SecureStore.getItemAsync(SITE_OUTSIDE_FIRST_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as SiteOutsideMap)
      : {};
  } catch {
    return {};
  }
}

export async function writeSiteOutsideMap(map: SiteOutsideMap): Promise<void> {
  await SecureStore.setItemAsync(SITE_OUTSIDE_FIRST_KEY, JSON.stringify(map));
}

export async function clearSiteOutsideMap(): Promise<void> {
  await SecureStore.deleteItemAsync(SITE_OUTSIDE_FIRST_KEY);
}

// Diagnostic log written from background tasks so we can read it on
// foreground (background tasks have no console access we can capture).
// Bounded ring buffer to avoid unbounded SecureStore growth.
export interface DiagEntry {
  ts: number;
  tag: string;
  msg: string;
}

const MAX_DIAG = 80;

export async function appendDiag(tag: string, msg: string): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(DIAG_LOG_KEY);
    let entries: DiagEntry[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) entries = parsed as DiagEntry[];
      } catch {
        entries = [];
      }
    }
    entries.push({ ts: Date.now(), tag, msg });
    if (entries.length > MAX_DIAG) {
      entries = entries.slice(entries.length - MAX_DIAG);
    }
    await SecureStore.setItemAsync(DIAG_LOG_KEY, JSON.stringify(entries));
  } catch {
    // never throw from a logger
  }
}

export async function readDiag(): Promise<DiagEntry[]> {
  const raw = await SecureStore.getItemAsync(DIAG_LOG_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DiagEntry[]) : [];
  } catch {
    return [];
  }
}

export async function clearDiag(): Promise<void> {
  await SecureStore.deleteItemAsync(DIAG_LOG_KEY);
}
