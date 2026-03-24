import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { useOrg } from "../providers/OrgProvider";
import type { EntityType } from "../types/database";

interface SignaturePadProps {
  entityType: EntityType;
  entityId: string;
  signerName: string;
  signerEmail?: string;
  signerRole?: string;
  onSaved?: (signatureUrl: string) => void;
}

export function SignaturePad({
  entityType,
  entityId,
  signerName,
  signerEmail,
  signerRole,
  onSaved,
}: SignaturePadProps) {
  const { orgId } = useOrg();
  const [signed, setSigned] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef(null);

  const handleSign = async (signatureDataUrl: string) => {
    if (!orgId) return;
    setSaving(true);

    try {
      // Convert data URL to file and upload
      const base64 = signatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const fileName = `signatures/${orgId}/${entityId}/${Date.now()}.png`;
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

      const { error: uploadError } = await supabase.storage
        .from("signatures")
        .upload(fileName, bytes, { contentType: "image/png" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("signatures")
        .getPublicUrl(fileName);

      // Create signature record
      const { error: insertError } = await supabase.from("signatures").insert({
        org_id: orgId,
        entity_type: entityType,
        entity_id: entityId,
        signer_name: signerName,
        signer_email: signerEmail ?? null,
        signer_role: signerRole ?? null,
        signature_url: urlData.publicUrl,
      });

      if (insertError) throw insertError;

      setSigned(true);
      onSaved?.(urlData.publicUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save signature";
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };

  if (signed) {
    return (
      <View style={styles.successContainer}>
        <Ionicons name="checkmark-circle" size={48} color="#10B981" />
        <Text style={styles.successText}>Signature captured</Text>
        <Text style={styles.successSubtext}>Signed by {signerName}</Text>
      </View>
    );
  }

  // Note: react-native-signature-canvas would be used here in a real build.
  // This is a placeholder UI that simulates the signature capture flow.
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Signature Required</Text>
      <Text style={styles.subtitle}>
        {signerRole ? `${signerRole}: ` : ""}
        {signerName}
      </Text>

      <View ref={canvasRef} style={styles.canvas}>
        <Text style={styles.canvasPlaceholder}>
          Sign here
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => {/* clear canvas */}}
        >
          <Ionicons name="trash-outline" size={18} color="#6B7280" />
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmButton, saving && styles.buttonDisabled]}
          onPress={() => {
            // In real implementation, get data URL from canvas ref
            handleSign("data:image/png;base64,placeholder");
          }}
          disabled={saving}
        >
          <Ionicons name="checkmark" size={18} color="#FFF" />
          <Text style={styles.confirmText}>
            {saving ? "Saving..." : "Confirm"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#6B7280", marginBottom: 16 },
  canvas: {
    height: 200,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    marginBottom: 16,
  },
  canvasPlaceholder: { fontSize: 16, color: "#9CA3AF", fontStyle: "italic" },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
  },
  clearText: { fontSize: 14, color: "#6B7280", fontWeight: "600" },
  confirmButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#6366F1",
    paddingVertical: 12,
    borderRadius: 10,
  },
  confirmText: { fontSize: 14, color: "#FFFFFF", fontWeight: "700" },
  buttonDisabled: { opacity: 0.6 },
  successContainer: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  successText: { fontSize: 17, fontWeight: "700", color: "#111827" },
  successSubtext: { fontSize: 14, color: "#6B7280" },
});
