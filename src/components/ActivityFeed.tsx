import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./Card";
import { Colors } from "../constants/theme";
import { useActivityEntries, type ActivityEntry } from "../hooks/useActivityEntries";
import { useActivityEntryTypes } from "../hooks/useActivityEntryTypes";
import { useSiteNotes, type SiteNote } from "../hooks/useSiteNotes";
import { useSitePhotos, type SitePhoto, getSignedPhotoUrl } from "../hooks/useSitePhotos";
import { useAuth } from "../providers/AuthProvider";
import { ActivityEntryModal } from "./ActivityEntryModal";
import { activityColorForKey, activityIconForKey } from "./activityStyles";

type FeedKind = "entry" | "note" | "photo";

interface FeedItem {
  kind: FeedKind;
  id: string;
  occurredAt: string;
  data: ActivityEntry | SiteNote | SitePhoto;
}

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
  return d.toLocaleDateString();
}

interface ActivityFeedProps {
  jobsiteId: string;
  serviceOrderId?: string | null;
  scope: "site" | "service_order";
  title?: string;
}

export function ActivityFeed({
  jobsiteId,
  serviceOrderId,
  scope,
  title = "Activity",
}: ActivityFeedProps) {
  const { user } = useAuth();
  const { types: entryTypes } = useActivityEntryTypes();
  const {
    entries,
    loading: loadingEntries,
    refetch: refetchEntries,
    addEntry,
    deleteEntry,
  } = useActivityEntries({ jobsiteId, serviceOrderId });
  const { notes } = useSiteNotes({
    jobsiteId: scope === "site" ? jobsiteId : null,
  });
  const { photos } = useSitePhotos(
    scope === "site" ? jobsiteId : null
  );

  const [showAdd, setShowAdd] = useState(false);
  const [activeTypeIds, setActiveTypeIds] = useState<Set<string>>(new Set());
  const [showNotes, setShowNotes] = useState(scope === "site");
  const [showPhotos, setShowPhotos] = useState(scope === "site");
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({});

  const linkedPhotoIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of entries) {
      for (const p of e.photos ?? []) ids.add(p.id);
    }
    return ids;
  }, [entries]);

  // Resolve signed URLs for displayed photos
  useEffect(() => {
    let cancelled = false;
    const candidates: SitePhoto[] = [
      ...photos.filter((p) => !linkedPhotoIds.has(p.id)),
      ...entries.flatMap((e) => e.photos ?? []),
    ];
    const missing = candidates.filter((p) => photoUrls[p.id] === undefined);
    if (missing.length === 0) return;
    (async () => {
      const results = await Promise.all(
        missing.map(async (p) => {
          const url = await getSignedPhotoUrl(p.storage_path, 3600);
          return [p.id, url] as const;
        })
      );
      if (cancelled) return;
      setPhotoUrls((prev) => {
        const next = { ...prev };
        for (const [id, url] of results) next[id] = url;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [photos, entries, linkedPhotoIds, photoUrls]);

  const feedItems: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [];
    for (const e of entries) {
      items.push({ kind: "entry", id: e.id, occurredAt: e.occurred_at, data: e });
    }
    if (scope === "site") {
      for (const n of notes) {
        items.push({ kind: "note", id: n.id, occurredAt: n.created_at, data: n });
      }
      for (const p of photos) {
        if (linkedPhotoIds.has(p.id)) continue;
        items.push({ kind: "photo", id: p.id, occurredAt: p.created_at, data: p });
      }
    }

    const filtered = items.filter((item) => {
      if (item.kind === "entry") {
        if (activeTypeIds.size === 0) return true;
        const e = item.data as ActivityEntry;
        return e.entry_type_id ? activeTypeIds.has(e.entry_type_id) : false;
      }
      if (item.kind === "note") return showNotes;
      if (item.kind === "photo") return showPhotos;
      return true;
    });

    filtered.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
    return filtered;
  }, [entries, notes, photos, scope, activeTypeIds, showNotes, showPhotos, linkedPhotoIds]);

  const handleDelete = useCallback(
    (entry: ActivityEntry) => {
      Alert.alert("Delete entry?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await deleteEntry(entry.id);
            if (error) Alert.alert("Could not delete", error);
          },
        },
      ]);
    },
    [deleteEntry]
  );

  function toggleType(id: string) {
    setActiveTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const typeById = useMemo(() => {
    const m: Record<string, (typeof entryTypes)[number]> = {};
    for (const t of entryTypes) m[t.id] = t;
    return m;
  }, [entryTypes]);

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="pulse" size={16} color={Colors.primary[600]} />
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAdd(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={16} color={Colors.white} />
          <Text style={styles.addBtnText}>Add Entry</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {entryTypes.map((t) => {
          const active = activeTypeIds.size === 0 || activeTypeIds.has(t.id);
          const color = activityColorForKey(t.color);
          const iconName = activityIconForKey(t.icon);
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => toggleType(t.id)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? color.bg : Colors.white,
                  borderColor: active ? color.fg : Colors.gray[200],
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={iconName}
                size={12}
                color={active ? color.fg : Colors.gray[500]}
              />
              <Text
                style={[
                  styles.filterChipText,
                  { color: active ? color.fg : Colors.gray[600] },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {scope === "site" && (
          <>
            <TouchableOpacity
              onPress={() => setShowNotes((v) => !v)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: showNotes ? Colors.primary[50] : Colors.white,
                  borderColor: showNotes ? Colors.primary[600] : Colors.gray[200],
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="reader"
                size={12}
                color={showNotes ? Colors.primary[700] : Colors.gray[500]}
              />
              <Text
                style={[
                  styles.filterChipText,
                  { color: showNotes ? Colors.primary[700] : Colors.gray[600] },
                ]}
              >
                Notes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowPhotos((v) => !v)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: showPhotos ? Colors.primary[50] : Colors.white,
                  borderColor: showPhotos ? Colors.primary[600] : Colors.gray[200],
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="camera"
                size={12}
                color={showPhotos ? Colors.primary[700] : Colors.gray[500]}
              />
              <Text
                style={[
                  styles.filterChipText,
                  { color: showPhotos ? Colors.primary[700] : Colors.gray[600] },
                ]}
              >
                Photos
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Feed list */}
      {loadingEntries && entries.length === 0 ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={Colors.primary[600]} />
        </View>
      ) : feedItems.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyBox}>
            <Ionicons name="pulse-outline" size={28} color={Colors.gray[300]} />
            <Text style={styles.emptyText}>No activity yet</Text>
            <Text style={styles.emptyHint}>
              Log a milestone, damage report, or note to get started.
            </Text>
          </View>
        </Card>
      ) : (
        <View style={styles.feedList}>
          {feedItems.map((item) => (
            <FeedItemRow
              key={`${item.kind}-${item.id}`}
              item={item}
              typeById={typeById}
              photoUrls={photoUrls}
              currentUserId={user?.id ?? null}
              onDelete={handleDelete}
            />
          ))}
        </View>
      )}

      <ActivityEntryModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        entryTypes={entryTypes}
        onSubmit={async (args) => {
          const result = await addEntry({
            entry_type_id: args.entry_type_id,
            title: args.title,
            body: args.body,
            photos: args.photos,
          });
          if (!result.error) await refetchEntries();
          return result;
        }}
      />
    </View>
  );
}

function FeedItemRow({
  item,
  typeById,
  photoUrls,
  currentUserId,
  onDelete,
}: {
  item: FeedItem;
  typeById: Record<string, { label: string; icon: string | null; color: string | null }>;
  photoUrls: Record<string, string | null>;
  currentUserId: string | null;
  onDelete: (e: ActivityEntry) => void;
}) {
  if (item.kind === "entry") {
    const e = item.data as ActivityEntry;
    const type = e.entry_type_id ? typeById[e.entry_type_id] : null;
    const color = activityColorForKey(type?.color ?? null);
    const iconName = activityIconForKey(type?.icon ?? null);
    const authorName = e.author?.full_name || e.author?.email || "Unknown";
    const canDelete = e.author_id === currentUserId;

    return (
      <View style={styles.itemRow}>
        <View style={[styles.iconCircle, { backgroundColor: color.bg }]}>
          <Ionicons name={iconName} size={16} color={color.fg} />
        </View>
        <Card style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.itemTitleRow}>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {e.title}
                </Text>
                {type && (
                  <View style={[styles.typePill, { backgroundColor: color.bg }]}>
                    <Text style={[styles.typePillText, { color: color.fg }]}>
                      {type.label}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.itemMeta}>
                {authorName} · {formatRelative(e.occurred_at)}
              </Text>
            </View>
            {canDelete && (
              <TouchableOpacity
                onPress={() => onDelete(e)}
                style={styles.menuBtn}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.gray[400]} />
              </TouchableOpacity>
            )}
          </View>
          {e.body ? <Text style={styles.itemBody}>{e.body}</Text> : null}
          {e.photos && e.photos.length > 0 && (
            <View style={styles.photoGrid}>
              {e.photos.map((p) => (
                <View key={p.id} style={styles.photoThumb}>
                  {photoUrls[p.id] ? (
                    <Image
                      source={{ uri: photoUrls[p.id]! }}
                      style={styles.photoImage}
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="image" size={18} color={Colors.gray[300]} />
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </Card>
      </View>
    );
  }

  if (item.kind === "note") {
    const n = item.data as SiteNote;
    const authorName = n.author?.full_name || n.author?.email || "Unknown";
    return (
      <View style={styles.itemRow}>
        <View style={[styles.iconCircle, { backgroundColor: "#f1f5f9" }]}>
          <Ionicons name="reader" size={16} color="#475569" />
        </View>
        <Card style={styles.itemCard}>
          <Text style={styles.itemMeta}>
            {authorName} · {formatRelative(n.created_at)}
          </Text>
          <Text style={[styles.itemBody, { marginTop: 4 }]}>{n.body}</Text>
        </Card>
      </View>
    );
  }

  if (item.kind === "photo") {
    const p = item.data as SitePhoto;
    const uploaderName = p.uploader?.full_name || p.uploader?.email || "Unknown";
    return (
      <View style={styles.itemRow}>
        <View style={[styles.iconCircle, { backgroundColor: "#dbeafe" }]}>
          <Ionicons name="camera" size={16} color="#1d4ed8" />
        </View>
        <Card style={styles.itemCard}>
          <Text style={styles.itemMeta}>
            {uploaderName} · {formatRelative(p.created_at)}
          </Text>
          <View style={[styles.photoGrid, { marginTop: 6 }]}>
            <View style={styles.photoThumbLarge}>
              {photoUrls[p.id] ? (
                <Image source={{ uri: photoUrls[p.id]! }} style={styles.photoImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="image" size={18} color={Colors.gray[300]} />
                </View>
              )}
            </View>
          </View>
        </Card>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 4,
    marginBottom: 8,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary[700],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary[600],
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtnText: { color: Colors.white, fontSize: 12, fontWeight: "600" },
  filterRow: { gap: 6, paddingVertical: 6, paddingHorizontal: 2 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
  },
  filterChipText: { fontSize: 11, fontWeight: "500" },
  loadingRow: { paddingVertical: 20, alignItems: "center" },
  feedList: { gap: 10, paddingTop: 4 },
  itemRow: { flexDirection: "row", gap: 10 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  itemCard: { flex: 1, padding: 12 },
  itemHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  itemTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  itemTitle: { fontSize: 14, fontWeight: "600", color: Colors.gray[900] },
  typePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  typePillText: { fontSize: 10, fontWeight: "600" },
  itemMeta: { fontSize: 11, color: Colors.gray[400], marginTop: 2 },
  itemBody: { fontSize: 13, color: Colors.gray[700], marginTop: 6 },
  menuBtn: { padding: 4 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  photoThumb: { width: 72, height: 72, borderRadius: 8, overflow: "hidden", backgroundColor: Colors.gray[100] },
  photoThumbLarge: { width: 180, height: 120, borderRadius: 8, overflow: "hidden", backgroundColor: Colors.gray[100] },
  photoImage: { width: "100%", height: "100%" },
  photoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyCard: { marginTop: 4 },
  emptyBox: { alignItems: "center", paddingVertical: 16 },
  emptyText: { color: Colors.gray[600], fontSize: 14, marginTop: 8 },
  emptyHint: { color: Colors.gray[400], fontSize: 12, marginTop: 4, textAlign: "center" },
});
