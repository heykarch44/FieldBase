import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";
import type { Organization, OrgMember, FieldDefinition, EntityType } from "../types/database";

interface OrgContextType {
  org: Organization | null;
  orgId: string | null;
  members: OrgMember[];
  fieldDefinitions: FieldDefinition[];
  loading: boolean;
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

  const fetchOrgData = useCallback(async (activeOrgId: string) => {
    const [orgRes, membersRes, fieldsRes] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", activeOrgId).single(),
      supabase.from("org_members").select("*").eq("org_id", activeOrgId),
      supabase
        .from("field_definitions")
        .select("*")
        .eq("org_id", activeOrgId)
        .eq("active", true)
        .order("display_order"),
    ]);

    if (orgRes.data) setOrg(orgRes.data as Organization);
    if (membersRes.data) setMembers(membersRes.data as OrgMember[]);
    if (fieldsRes.data) setFieldDefinitions(fieldsRes.data as FieldDefinition[]);
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
    const { data } = await supabase
      .from("field_definitions")
      .select("*")
      .eq("org_id", orgId)
      .eq("active", true)
      .order("display_order");
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
