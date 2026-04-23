// Cache the supabase session + org id in SecureStore so the background
// geofence task (which runs outside the React tree) can make authenticated
// inserts. Called on login / auth state changes and cleared on sign-out.

import * as SecureStore from "expo-secure-store";

const USER_ID_KEY = "fieldiq_bg_user_id";
const ORG_ID_KEY = "fieldiq_bg_org_id";
const ACCESS_TOKEN_KEY = "fieldiq_bg_access_token";
const REFRESH_TOKEN_KEY = "fieldiq_bg_refresh_token";
const ASSIGNED_SITES_KEY = "fieldiq_bg_assigned_sites";

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
  lat: number;
  lng: number;
  radius_m: number;
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
