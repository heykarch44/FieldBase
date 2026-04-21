import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./Card";
import { Colors } from "../constants/theme";
import { useSiteNotes, type SiteNote } from "../hooks/useSiteNotes";
import { useAuth } from "../providers/AuthProvider";

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function initials(name: string | null | undefined, email?: string): string {
  const src = name?.trim() || email?.trim() || "?";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

interface NotesSectionProps {
  jobsiteId: string;
  serviceOrderId?: string | null;
  orgId: string | null | undefined;
  title?: string;
  compact?: boolean;
  embedded?: boolean;
}

export function NotesSection({
  jobsiteId,
  serviceOrderId,
  orgId,
  title = "Notes",
  compact = false,
  embedded = false,
}: NotesSectionProps) {
  const { user, memberships } = useAuth();
  const { notes, loading, addNote, deleteNote } = useSiteNotes({
    jobsiteId,
    serviceOrderId,
  });
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isManager = React.useMemo(() => {
    if (!orgId) return false;
    const m = memberships.find((mm) => mm.org_id === orgId);
    return !!m && (m.role === "owner" || m.role === "admin" || m.role === "manager");
  }, [memberships, orgId]);

  const canDelete = useCallback(
    (n: SiteNote) => isManager || n.author_id === user?.id,
    [isManager, user?.id]
  );

  const handleAdd = useCallback(async () => {
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    const result = await addNote(body);
    setSubmitting(false);
    if (result.error) {
      Alert.alert("Couldn't save note", result.error);
      return;
    }
    setBody("");
  }, [body, submitting, addNote]);

  const handleDelete = useCallback(
    (note: SiteNote) => {
      Alert.alert("Delete note?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const result = await deleteNote(note.id);
            if (result.error) Alert.alert("Delete failed", result.error);
          },
        },
      ]);
    },
    [deleteNote]
  );

  const sectionHeaderStyle = embedded
    ? styles.sectionHeaderEmbedded
    : styles.sectionHeader;
  const cardStyle = embedded ? styles.cardEmbedded : styles.card;
  const inputCardStyle = embedded
    ? styles.inputCardEmbedded
    : styles.inputCard;

  return (
    <View>
      <View style={sectionHeaderStyle}>
        <Ionicons
          name="chatbubble-ellipses"
          size={16}
          color={Colors.primary[600]}
        />
        <Text style={styles.sectionHeaderText}>
          {title} ({notes.length})
        </Text>
      </View>

      <Card style={inputCardStyle}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Add a note... (tap mic on keyboard to dictate)"
          placeholderTextColor={Colors.gray[400]}
          multiline
          style={styles.input}
          editable={!submitting}
        />
        <View style={styles.inputActions}>
          <View style={styles.micHint}>
            <Ionicons name="mic-outline" size={13} color={Colors.gray[500]} />
            <Text style={styles.micHintText}>
              Tap mic on keyboard to dictate
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.addBtn,
              (!body.trim() || submitting) && styles.addBtnDisabled,
            ]}
            onPress={handleAdd}
            disabled={!body.trim() || submitting}
            activeOpacity={0.7}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="add" size={16} color="white" />
                <Text style={styles.addBtnText}>Add Note</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Card>

      {loading && notes.length === 0 ? (
        <Card style={cardStyle}>
          <ActivityIndicator size="small" color={Colors.primary[600]} />
        </Card>
      ) : notes.length === 0 ? (
        <Card style={cardStyle}>
          <View style={styles.emptyBox}>
            <Ionicons
              name="chatbubble-outline"
              size={compact ? 24 : 32}
              color={Colors.gray[300]}
            />
            <Text style={styles.emptyText}>No notes yet</Text>
          </View>
        </Card>
      ) : (
        notes.map((note) => {
          const displayName =
            note.author?.full_name || note.author?.email || "Unknown";
          return (
            <TouchableOpacity
              key={note.id}
              activeOpacity={1}
              onLongPress={() => {
                if (canDelete(note)) handleDelete(note);
              }}
            >
              <Card style={cardStyle}>
                <View style={styles.noteHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {initials(note.author?.full_name, note.author?.email)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noteAuthor}>{displayName}</Text>
                    <Text style={styles.noteTime}>
                      {formatRelative(note.created_at)}
                    </Text>
                  </View>
                  {canDelete(note) && (
                    <TouchableOpacity
                      onPress={() => handleDelete(note)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={Colors.gray[400]}
                      />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.noteBody}>{note.body}</Text>
              </Card>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeaderEmbedded: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
    paddingBottom: 8,
  },
  inputCardEmbedded: {
    marginBottom: 8,
  },
  cardEmbedded: {
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.gray[600],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputCard: {
    marginBottom: 10,
    marginHorizontal: 16,
  },
  input: {
    fontSize: 14,
    color: "#111827",
    minHeight: 60,
    textAlignVertical: "top",
    padding: 0,
  },
  inputActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    gap: 8,
  },
  micHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  micHintText: {
    fontSize: 11,
    color: Colors.gray[500],
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary[600],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  addBtnText: {
    color: "white",
    fontWeight: "600",
    fontSize: 13,
  },
  card: {
    marginBottom: 8,
    marginHorizontal: 16,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 16,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: Colors.gray[400],
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary[700],
  },
  noteAuthor: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  noteTime: {
    fontSize: 11,
    color: Colors.gray[500],
    marginTop: 1,
  },
  noteBody: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
});
