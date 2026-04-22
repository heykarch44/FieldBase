import React, { useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SignatureScreen, {
  type SignatureViewRef,
} from "react-native-signature-canvas";
import { Colors } from "../constants/theme";
import { useCreateSignature } from "../hooks/useSignatures";

interface Props {
  serviceOrderId: string;
  visible: boolean;
  onClose: () => void;
  onSigned: (signatureId: string) => void;
}

const CANVAS_STYLE = `
  .m-signature-pad { box-shadow: none; border: none; margin: 0; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad--footer { display: none; margin: 0; }
  body, html { background-color: #ffffff; margin: 0; padding: 0; height: 100%; width: 100%; }
`;

export function SignatureCaptureModal({
  serviceOrderId,
  visible,
  onClose,
  onSigned,
}: Props) {
  const signatureRef = useRef<SignatureViewRef>(null);
  const [signerName, setSignerName] = useState("");
  const [saving, setSaving] = useState(false);
  const createSignature = useCreateSignature();

  const handleSaveRequest = () => {
    if (!signerName.trim()) {
      Alert.alert("Name required", "Please enter the customer's name.");
      return;
    }
    // readSignature triggers onOK with the data URL
    signatureRef.current?.readSignature();
  };

  const handleOK = async (dataUrl: string) => {
    if (!dataUrl) {
      Alert.alert("Empty signature", "Please sign before saving.");
      return;
    }
    setSaving(true);
    try {
      const { id } = await createSignature({
        serviceOrderId,
        signerName,
        base64Png: dataUrl,
      });
      setSignerName("");
      onSigned(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save signature";
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEmpty = () => {
    Alert.alert("Empty signature", "Please sign before saving.");
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
  };

  const handleClose = () => {
    if (saving) return;
    setSignerName("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            disabled={saving}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={Colors.gray[700]} />
          </TouchableOpacity>
          <Text style={styles.title}>Customer Signature</Text>
          <View style={styles.closeButton} />
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.label}>Customer Name</Text>
          <TextInput
            value={signerName}
            onChangeText={setSignerName}
            placeholder="Enter customer name"
            placeholderTextColor={Colors.gray[400]}
            editable={!saving}
            style={styles.nameInput}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        <View style={styles.canvasWrapper}>
          <SignatureScreen
            ref={signatureRef}
            onOK={handleOK}
            onEmpty={handleEmpty}
            webStyle={CANVAS_STYLE}
            descriptionText=""
            imageType="image/png"
            dataURL=""
            autoClear={false}
          />
          <View style={styles.signaturePrompt} pointerEvents="none">
            <Text style={styles.signaturePromptText}>Sign above</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleClear}
            disabled={saving}
            style={[styles.secondaryButton, saving && styles.disabled]}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.gray[700]} />
            <Text style={styles.secondaryButtonText}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleClose}
            disabled={saving}
            style={[styles.secondaryButton, saving && styles.disabled]}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSaveRequest}
            disabled={saving}
            style={[styles.primaryButton, saving && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color={Colors.white} />
                <Text style={styles.primaryButtonText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray[200],
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.gray[900],
  },
  nameRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.gray[700],
    marginBottom: 6,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.gray[900],
    backgroundColor: Colors.white,
  },
  canvasWrapper: {
    flex: 1,
    margin: 16,
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.white,
  },
  signaturePrompt: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  signaturePromptText: {
    fontSize: 12,
    color: Colors.gray[400],
    fontStyle: "italic",
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.gray[200],
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: 10,
    backgroundColor: Colors.white,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: Colors.gray[700],
    fontWeight: "600",
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary[600],
  },
  primaryButtonText: {
    fontSize: 14,
    color: Colors.white,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.6,
  },
});
