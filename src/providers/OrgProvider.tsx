import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { withTimeout } from "../lib/withTimeout";
import { useAuth } from "./AuthProvider";
import type { Organization, OrgMember, FieldDefinition, EntityType } from "../types/database";

// Hard timeout for each Supabase query in this provider. Without this, a
// stuck request on bad cell can indefinitely block the provider tree on
// foreground (app appears "hung" until force restart).
const QUERY_TIMEOUT_MS = 8000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EMPTY_RES = { data: null } as any;

interface OrgContextType {
  org: Organization | null;
  orgId: string | null;
  members: OrgMember[];
  fieldDefinitions: FieldDefinition[];
  loading: boolean;
  routesEnabled: boolean;
  orgSettings: Record<string, unknown>;
  switchOrg: (orgId: string) => Promise<void>;
  getFieldsForEntity: (entityType: EntityType) => FieldDefinition[];
  refreshFieldDefinitions: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | null>(null);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const orgId = user?.active_org_id ?? null;

  const routesEnabled = useMemo(
    () => (org?.settings as Record<string, unknown>)?.routes_enabled !== false,
    [org?.settings]
  );

  const orgSettings = useMemo(
    () => (org?.settings as Record<string, unknown>) ?? {},
    [org?.settings]
  );

  const fetchOrgData = useCallback(async (activeOrgId: string) => {
    const [orgRes, membersRes, fieldsRes] = await Promise.all([
      withTimeout(
        supabase.from("organizations").select("*").eq("id", activeOrgId).single(),
        QUERY_TIMEOUT_MS,
        EMPTY_RES
      ),
      withTimeout(
        supabase.from("org_members").select("*").eq("org_id", activeOrgId),
        QUERY_TIMEOUT_MS,
        EMPTY_RES
      ),
      withTimeout(
        supabase
          .from("field_definitions")
          .select("*")
          .eq("org_id", activeOrgId)
          .eq("active", true)
          .order("display_order"),
        QUERY_TIMEOUT_MS,
        EMPTY_RES
      ),
    ]);

    if (orgRes.data) setOrg(orgRes.data as Organization);
    if (membersRes.data) setMembers(membersRes.data as OrgMember[]);
    if (fieldsRes.data) setFieldDefinitions(fieldsRes.data as FieldDefinition[]);
    // Always release loading, even if a query timed out — otherwise the UI
    // stays stuck on the loading gate forever when cell is degraded.
    setLoading(false);
  }, []);

  useEffect(() => {
    if (orgId && session) {
      fetchOrgData(orgId);
    } else {
      setOrg(null);
      setMembers([]);
      setFieldDefinitions([]);
      setLoading(false);
    }
  }, [orgId, session, fetchOrgData]);

  const switchOrg = useCallback(
    async (newOrgId: string) => {
      if (!user) return;
      await supabase
        .from("users")
        .update({ active_org_id: newOrgId })
        .eq("id", user.id);
      await fetchOrgData(newOrgId);
    },
    [user, fetchOrgData]
  );

  const getFieldsForEntity = useCallback(
    (entityType: EntityType) =>
      fieldDefinitions.filter((fd) => fd.entity_type === entityType),
    [fieldDefinitions]
  );

  const refreshFieldDefinitions = useCallback(async () => {
    if (!orgId) return;
    const { data } = await withTimeout(
      supabase
        .from("field_definitions")
        .select("*")
        .eq("org_id", orgId)
        .eq("active", true)
        .order("display_order"),
      QUERY_TIMEOUT_MS,
      EMPTY_RES
    );
    if (data) setFieldDefinitions(data as FieldDefinition[]);
  }, [orgId]);

  return (
    <OrgContext.Provider
      value={{
        org,
        orgId,
        members,
        fieldDefinitions,
        loading,
        routesEnabled,
        orgSettings,
        switchOrg,
        getFieldsForEntity,
        refreshFieldDefinitions,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (!context) throw new Error("useOrg must be used within OrgProvider");
  return context;
}
