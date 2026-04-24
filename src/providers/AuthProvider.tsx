import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { supabase } from "../lib/supabase";
import { withTimeout } from "../lib/withTimeout";
import {
  clearSessionCache,
  writeSessionCache,
} from "../lib/sessionCache";
import type { User, OrgMember } from "../types/database";

// Hard timeout so stuck Supabase calls on bad cell don't indefinitely
// block auth init / foreground rehydration (app appeared "hung").
const AUTH_TIMEOUT_MS = 8000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EMPTY_RES = { data: null } as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EMPTY_SESSION = { data: { session: null } } as any;

interface AuthState {
  session: Session | null;
  user: User | null;
  memberships: OrgMember[];
  loading: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  authenticateWithBiometrics: () => Promise<boolean>;
  toggleBiometric: (enabled: boolean) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const BIOMETRIC_KEY = "fieldiq_biometric_enabled";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    memberships: [],
    loading: true,
    biometricEnabled: false,
    biometricAvailable: false,
  });

  const fetchUserProfile = useCallback(async (userId: string): Promise<{
    user: User | null;
    memberships: OrgMember[];
  }> => {
    const [userRes, memberRes] = await Promise.all([
      withTimeout(
        supabase.from("users").select("*").eq("id", userId).single(),
        AUTH_TIMEOUT_MS,
        EMPTY_RES
      ),
      withTimeout(
        supabase.from("org_members").select("*").eq("user_id", userId),
        AUTH_TIMEOUT_MS,
        EMPTY_RES
      ),
    ]);

    return {
      user: userRes.data as User | null,
      memberships: (memberRes.data as OrgMember[]) ?? [],
    };
  }, []);

  const refreshUser = useCallback(async () => {
    if (!state.session?.user?.id) return;
    const { user, memberships } = await fetchUserProfile(state.session.user.id);
    if (user) {
      setState((prev) => ({ ...prev, user, memberships }));
    }
  }, [state.session?.user?.id, fetchUserProfile]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const [bioAvailable, bioEnabledStr] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        SecureStore.getItemAsync(BIOMETRIC_KEY),
      ]);

      const sessionRes = await withTimeout(
        supabase.auth.getSession(),
        AUTH_TIMEOUT_MS,
        EMPTY_SESSION
      );
      const session: Session | null = sessionRes.data?.session ?? null;
      let user: User | null = null;
      let memberships: OrgMember[] = [];
      if (session?.user?.id) {
        const result = await fetchUserProfile(session.user.id);
        user = result.user;
        memberships = result.memberships;
        // Cache for background geofence task
        if (session.access_token) {
          await writeSessionCache({
            userId: session.user.id,
            orgId: user?.active_org_id ?? null,
            accessToken: session.access_token,
            refreshToken: session.refresh_token ?? null,
          });
        }
      }

      if (mounted) {
        setState({
          session,
          user,
          memberships,
          loading: false,
          biometricEnabled: bioEnabledStr === "true",
          biometricAvailable: bioAvailable,
        });
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        let user: User | null = null;
        let memberships: OrgMember[] = [];
        if (session?.user?.id) {
          const result = await fetchUserProfile(session.user.id);
          user = result.user;
          memberships = result.memberships;
          if (session.access_token) {
            await writeSessionCache({
              userId: session.user.id,
              orgId: user?.active_org_id ?? null,
              accessToken: session.access_token,
              refreshToken: session.refresh_token ?? null,
            });
          }
        } else {
          await clearSessionCache();
        }
        if (mounted) {
          setState((prev) => ({ ...prev, session, user, memberships, loading: false }));
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await clearSessionCache();
    setState((prev) => ({ ...prev, session: null, user: null, memberships: [] }));
  }, []);

  const authenticateWithBiometrics = useCallback(async (): Promise<boolean> => {
    if (!state.biometricAvailable || !state.biometricEnabled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock FieldIQ",
      fallbackLabel: "Use password",
      disableDeviceFallback: false,
    });
    return result.success;
  }, [state.biometricAvailable, state.biometricEnabled]);

  const toggleBiometric = useCallback(async (enabled: boolean) => {
    await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? "true" : "false");
    setState((prev) => ({ ...prev, biometricEnabled: enabled }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signOut,
        authenticateWithBiometrics,
        toggleBiometric,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
