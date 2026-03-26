import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { useOrg } from "../providers/OrgProvider";
import { enqueueAction } from "../lib/offline-db";
import type { FieldDefinition, FieldValue, EntityType } from "../types/database";
import { Colors } from "../constants/theme";

interface DynamicFormProps {
  entityType: EntityType;
  entityId: string;
  isConnected: boolean;
  onSaved?: () => void;
  readOnly?: boolean;
}

interface FieldGroup {
  name: string | null;
  fields: FieldDefinition[];
}

export function DynamicForm({
  entityType,
  entityId,
  isConnected,
  onSaved,
  readOnly = false,
}: DynamicFormProps) {
  const { orgId, getFieldsForEntity } = useOrg();
  const fields = getFieldsForEntity(entityType);
  const [values, setValues] = useState<Record<string, string>>({});
  const [existingValues, setExistingValues] = useState<Record<string, FieldValue>>({});
  const [saving, setSaving] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadExistingValues();
  }, [entityId, entityType]);

  const loadExistingValues = useCallback(async () => {
    if (!orgId || !entityId) return;

    if (isConnected) {
      const { data } = await supabase
        .from("field_values")
        .select("*")
        .eq("org_id", orgId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId);

      if (data) {
        const valMap: Record<string, string> = {};
        const existMap: Record<string, FieldValue> = {};
        for (const fv of data as FieldValue[]) {
          valMap[fv.field_definition_id] = fv.value_text ?? "";
          existMap[fv.field_definition_id] = fv;
        }
        setValues(valMap);
        setExistingValues(existMap);
      }
    }
  }, [orgId, entityId, entityType, isConnected]);

  const groupedFields: FieldGroup[] = React.useMemo(() => {
    const groups = new Map<string | null, FieldDefinition[]>();
    for (const field of fields) {
      const key = field.group_name;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(field);
    }
    return Array.from(groups.entries()).map(([name, fieldList]) => ({
      name,
      fields: fieldList,
    }));
  }, [fields]);

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const updateValue = (fieldId: string, val: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
  };

  const handleSave = async () => {
    if (!orgId) return;

    // Validate required fields
    const missing = fields.filter(
      (f) => f.is_required && !values[f.id]?.trim()
    );
    if (missing.length > 0) {
      Alert.alert(
        "Required Fields",
        `Please fill in: ${missing.map((f) => f.label).join(", ")}`
      );
      return;
    }

    setSaving(true);

    for (const field of fields) {
      const val = values[field.id] ?? "";
      if (!val && !existingValues[field.id]) continue;

      const isNumeric = field.field_type === "number";
      const payload = {
        org_id: orgId,
        field_definition_id: field.id,
        entity_type: entityType,
        entity_id: entityId,
        value_text: val || null,
        value_numeric: isNumeric && val ? parseFloat(val) : null,
      };

      const existing = existingValues[field.id];

      if (isConnected) {
        if (existing) {
          await supabase
            .from("field_values")
            .update(payload)
            .eq("id", existing.id);
        } else if (val) {
          await supabase.from("field_values").insert(payload);
        }
      } else {
        const recordId = existing?.id ?? `local_${field.id}_${entityId}`;
        await enqueueAction(
          "field_values",
          existing ? "update" : "insert",
          recordId,
          existing ? { ...payload, id: existing.id } : payload
        );
      }
    }

    setSaving(false);
    onSaved?.();
  };

  const renderField = (field: FieldDefinition) => {
    const val = values[field.id] ?? "";

    switch (field.field_type) {
      case "text":
      case "email":
      case "phone":
      case "url":
        return (
          <TextInput
            style={styles.input}
            value={val}
            onChangeText={(v) => updateValue(field.id, v)}
            placeholder={field.label}
            editable={!readOnly}
            keyboardType={
              field.field_type === "number"
                ? "decimal-pad"
                : field.field_type === "email"
                ? "email-address"
                : field.field_type === "phone"
                ? "phone-pad"
                : "default"
            }
          />
        );

      case "number":
        return (
          <TextInput
            style={styles.input}
            value={val}
            onChangeText={(v) => updateValue(field.id, v)}
            placeholder={field.label}
            editable={!readOnly}
            keyboardType="decimal-pad"
          />
        );

      case "textarea":
        return (
          <TextInput
            style={[styles.input, styles.textArea]}
            value={val}
            onChangeText={(v) => updateValue(field.id, v)}
            placeholder={field.label}
            editable={!readOnly}
            multiline
            numberOfLines={3}
          />
        );

      case "boolean":
        return (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{val === "true" ? "Yes" : "No"}</Text>
            <Switch
              value={val === "true"}
              onValueChange={(v) => updateValue(field.id, v ? "true" : "false")}
              disabled={readOnly}
              trackColor={{ false: "#D1D5DB", true: Colors.primary[600] }}
            />
          </View>
        );

      case "enum": {
        const options = Array.isArray(field.options) ? field.options as string[] : [];
        return (
          <View style={styles.enumContainer}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.enumOption,
                  val === opt && styles.enumOptionSelected,
                ]}
                onPress={() => !readOnly && updateValue(field.id, opt)}
                disabled={readOnly}
              >
                <Text
                  style={[
                    styles.enumOptionText,
                    val === opt && styles.enumOptionTextSelected,
                  ]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      }

      case "date":
        return (
          <TextInput
            style={styles.input}
            value={val}
            onChangeText={(v) => updateValue(field.id, v)}
            placeholder="YYYY-MM-DD"
            editable={!readOnly}
          />
        );

      case "photo":
      case "signature":
        return (
          <View style={styles.placeholderField}>
            <Ionicons
              name={field.field_type === "photo" ? "camera" : "pencil"}
              size={20}
              color="#9CA3AF"
            />
            <Text style={styles.placeholderText}>
              {field.field_type === "photo" ? "Tap to capture" : "Tap to sign"}
            </Text>
          </View>
        );

      default:
        return (
          <TextInput
            style={styles.input}
            value={val}
            onChangeText={(v) => updateValue(field.id, v)}
            placeholder={field.label}
            editable={!readOnly}
          />
        );
    }
  };

  if (fields.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="document-text-outline" size={32} color="#9CA3AF" />
        <Text style={styles.emptyText}>No fields configured for this entity type.</Text>
        <Text style={styles.emptySubtext}>An admin can add fields in Settings.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {groupedFields.map((group) => (
        <View key={group.name ?? "__ungrouped"} style={styles.group}>
          {group.name && (
            <TouchableOpacity
              style={styles.groupHeader}
              onPress={() => toggleGroup(group.name!)}
            >
              <Text style={styles.groupTitle}>{group.name}</Text>
              <Ionicons
                name={
                  collapsedGroups.has(group.name)
                    ? "chevron-down"
                    : "chevron-up"
                }
                size={18}
                color="#6B7280"
              />
            </TouchableOpacity>
          )}

          {(!group.name || !collapsedGroups.has(group.name)) &&
            group.fields.map((field) => (
              <View key={field.id} style={styles.fieldContainer}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  {field.is_required && (
                    <Text style={styles.requiredStar}>*</Text>
                  )}
                </View>
                {field.description && (
                  <Text style={styles.fieldDescription}>{field.description}</Text>
                )}
                {renderField(field)}
              </View>
            ))}
        </View>
      ))}

      {!readOnly && (
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name="save" size={18} color="#FFF" />
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : "Save Fields"}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  group: { marginBottom: 16 },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldContainer: { marginBottom: 14, paddingHorizontal: 4 },
  labelRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  requiredStar: { color: "#EF4444", marginLeft: 4, fontWeight: "700" },
  fieldDescription: { fontSize: 12, color: "#9CA3AF", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  textArea: { height: 80, textAlignVertical: "top" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 14, color: "#6B7280" },
  enumContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  enumOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
  },
  enumOptionSelected: {
    backgroundColor: Colors.primary[600],
    borderColor: Colors.primary[600],
  },
  enumOptionText: { fontSize: 13, color: "#374151" },
  enumOptionTextSelected: { color: "#FFFFFF", fontWeight: "600" },
  placeholderField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    borderStyle: "dashed",
  },
  placeholderText: { fontSize: 14, color: "#9CA3AF" },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 15, color: "#6B7280", fontWeight: "600" },
  emptySubtext: { fontSize: 13, color: "#9CA3AF" },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary[600],
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 16,
    marginBottom: 32,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
