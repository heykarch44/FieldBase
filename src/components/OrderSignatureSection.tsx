import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/theme";
import {
  useSignatures,
  getSignedSignatureUrl,
} from "../hooks/useSignatures";
import { SignatureCaptureModal } from "./SignatureCaptureModal";

interface Props {
  serviceOrderId: string;
  requiresSignature: boolean;
}

function formatSignedAt(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export function OrderSignatureSection({
  serviceOrderId,
  requiresSignature,
}: Props) {
  const { signatures, loading, refresh } = useSignatures(serviceOrderId);
  const [modalVisible, setModalVisible] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  const primary = signatures[0] ?? null;

  useEffect(() => {
    let alive = true;
    if (primary?.signature_url) {
      getSignedSignatureUrl(primary.signature_url, 3600).then((url) => {
        if (alive) setThumbUrl(url);
      });
    } else {
      setThumbUrl(null);
    }
    return () => {
      alive = false;
    };
  }, [primary?.id, primary?.signature_url]);

  const handleSigned = async () => {
    setModalVisible(false);
    await refresh();
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="small" color={Colors.primary[600]} />
      </View>
    );
  }

  if (primary) {
    return (
      <View style={styles.signedBox}>
        <View style={styles.signedTop}>
          <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
          <View style={styles.signedMeta}>
            <Text style={styles.signedName}>Signed by {primary.signer_name}</Text>
            <Text style={styles.signedAt}>
              {formatSignedAt(primary.signed_at)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={styles.addMoreBtn}
          >
            <Ionicons name="add" size={14} color={Colors.primary[700]} />
            <Text style={styles.addMoreText}>Add</Text>
          </TouchableOpacity>
        </View>
        {thumbUrl ? (
          <Image
            source={{ uri: thumbUrl }}
            style={styles.thumbnail}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailLoading]}>
            <ActivityIndicator size="small" color={Colors.gray[400]} />
          </View>
        )}
        <SignatureCaptureModal
          serviceOrderId={serviceOrderId}
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSigned={handleSigned}
        />
      </View>
    );
  }

  if (requiresSignature) {
    return (
      <>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={styles.primaryCta}
          activeOpacity={0.85}
        >
          <Ionicons name="create" size={18} color={Colors.white} />
          <Text style={styles.primaryCtaText}>Capture Signature</Text>
          <View style={styles.requiredPill}>
            <Text style={styles.requiredPillText}>Required</Text>
          </View>
        </TouchableOpacity>
        <SignatureCaptureModal
          serviceOrderId={serviceOrderId}
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSigned={handleSigned}
        />
      </>
    );
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={styles.secondaryCta}
        activeOpacity={0.85}
      >
        <Ionicons name="create-outline" size={16} color={Colors.primary[700]} />
        <Text style={styles.secondaryCtaText}>Add Signature</Text>
      </TouchableOpacity>
      <SignatureCaptureModal
        serviceOrderId={serviceOrderId}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSigned={handleSigned}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary[600],
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryCtaText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.white,
  },
  requiredPill: {
    backgroundColor: Colors.primary[700],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  requiredPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.white,
    letterSpacing: 0.3,
  },
  secondaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primary[300],
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary[50],
  },
  secondaryCtaText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary[700],
  },
  signedBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  signedTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signedMeta: {
    flex: 1,
  },
  signedName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#166534",
  },
  signedAt: {
    fontSize: 11,
    color: "#15803d",
    marginTop: 1,
  },
  addMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.primary[50],
    borderRadius: 8,
  },
  addMoreText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary[700],
  },
  thumbnail: {
    height: 70,
    width: "100%",
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  thumbnailLoading: {
    alignItems: "center",
    justifyContent: "center",
  },
});
