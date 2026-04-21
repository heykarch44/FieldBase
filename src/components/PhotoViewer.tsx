import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SitePhoto } from "../hooks/useSitePhotos";
import { getSignedPhotoUrl } from "../hooks/useSitePhotos";

interface PhotoViewerProps {
  visible: boolean;
  photos: SitePhoto[];
  startIndex: number;
  onClose: () => void;
  onDelete?: (photo: SitePhoto) => void;
  canDelete?: (photo: SitePhoto) => boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function PhotoViewer({
  visible,
  photos,
  startIndex,
  onClose,
  onDelete,
  canDelete,
}: PhotoViewerProps) {
  const { width, height } = Dimensions.get("window");
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({});
  const listRef = useRef<FlatList<SitePhoto>>(null);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(startIndex);
    }
  }, [visible, startIndex]);

  const ensureUrl = useCallback(
    async (photo: SitePhoto) => {
      if (urls[photo.id] !== undefined || loadingUrls[photo.id]) return;
      setLoadingUrls((m) => ({ ...m, [photo.id]: true }));
      const url = await getSignedPhotoUrl(photo.storage_path, 3600);
      setUrls((m) => ({ ...m, [photo.id]: url }));
      setLoadingUrls((m) => ({ ...m, [photo.id]: false }));
    },
    [urls, loadingUrls]
  );

  useEffect(() => {
    if (!visible) return;
    const toPrefetch = [currentIndex - 1, currentIndex, currentIndex + 1]
      .filter((i) => i >= 0 && i < photos.length)
      .map((i) => photos[i]);
    toPrefetch.forEach(ensureUrl);
  }, [visible, currentIndex, photos, ensureUrl]);

  const onMomentumEnd = (e: {
    nativeEvent: { contentOffset: { x: number } };
  }) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== currentIndex) setCurrentIndex(i);
  };

  const current = photos[currentIndex];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <FlatList
          ref={listRef}
          data={photos}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_data, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={({ item }) => {
            const url = urls[item.id];
            const loading = loadingUrls[item.id];
            return (
              <View style={[styles.page, { width, height }]}>
                {url ? (
                  <Image
                    source={{ uri: url }}
                    style={styles.image}
                    resizeMode="contain"
                  />
                ) : loading || url === undefined ? (
                  <ActivityIndicator size="large" color="#ffffff" />
                ) : (
                  <Text style={styles.errorText}>Unable to load image</Text>
                )}
              </View>
            );
          }}
        />

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <Ionicons name="close" size={28} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.counter}>
            {currentIndex + 1} / {photos.length}
          </Text>
          {onDelete && current && canDelete?.(current) ? (
            <TouchableOpacity
              onPress={() => onDelete(current)}
              style={styles.iconButton}
            >
              <Ionicons name="trash-outline" size={24} color="#ffffff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>

        {/* Bottom info */}
        {current && (
          <View style={styles.bottomBar}>
            {current.caption ? (
              <Text style={styles.caption}>{current.caption}</Text>
            ) : null}
            <Text style={styles.meta}>
              {current.uploader?.full_name ?? "Unknown"} ·{" "}
              {formatDate(current.created_at)}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
  },
  page: {
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  counter: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  caption: {
    color: "#ffffff",
    fontSize: 14,
    marginBottom: 6,
  },
  meta: {
    color: "#d1d5db",
    fontSize: 12,
  },
  errorText: {
    color: "#ffffff",
    fontSize: 14,
  },
});
