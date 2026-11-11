import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppHeader from "@/components/AppHeader";
import { PasscodeInput } from "@/components/PasscodeGate";
import { useAppSecurity } from "@/context/AppSecurityContext";
import { useGemini } from "@/context/GeminiContext";
import { useMoney } from "@/context/MoneyContext";
import { useColors } from "@/hooks/useColors";

const APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Date","Type","Category","Account","Description","Amount (Rs)"]);
    }
    const last = sheet.getLastRow();
    if (last > 1) sheet.deleteRows(2, last - 1);
    data.transactions.forEach(t => {
      sheet.appendRow([
        new Date(t.date).toLocaleString("en-IN"),
        t.type, t.category, t.account, t.description,
        t.type === "income" ? t.amount : -t.amount
      ]);
    });
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

type PasscodeStep = "none" | "enter-new" | "confirm-new" | "change-old";
type SheetsStep = 1 | 2 | 3;

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { syncToSheets, syncStatus } = useMoney();
  const {
    passcode, biometricEnabled, biometricAvailable,
    sheetsUrl, setPasscode, toggleBiometric, setSheetsUrl,
  } = useAppSecurity();
  const { apiKey, setApiKey } = useGemini();

  const [passcodeStep, setPasscodeStep] = useState<PasscodeStep>("none");
  const [pendingCode, setPendingCode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");

  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [geminiDraft, setGeminiDraft] = useState(apiKey);
  const [geminiVisible, setGeminiVisible] = useState(false);

  const [sheetsDraft, setSheetsDraft] = useState(sheetsUrl);
  const [showSetup, setShowSetup] = useState(false);
  const [sheetsStep, setSheetsStep] = useState<SheetsStep>(1);
  const [copied, setCopied] = useState(false);

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const startSetPasscode = () => {
    setPasscodeStep(passcode ? "change-old" : "enter-new");
    setPasscodeError("");
    setPendingCode("");
  };

  const handleRemovePasscode = () => {
    Alert.alert("Remove Passcode", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setPasscode(null) },
    ]);
  };

  const handlePasscodeStepSuccess = async (code: string) => {
    if (passcodeStep === "change-old") {
      if (code !== passcode) { setPasscodeError("Incorrect current passcode"); return; }
      setPasscodeError("");
      setPasscodeStep("enter-new");
      return;
    }
    if (passcodeStep === "enter-new") {
      setPendingCode(code);
      setPasscodeStep("confirm-new");
      return;
    }
    if (passcodeStep === "confirm-new") {
      if (code !== pendingCode) {
        setPasscodeError("Passcodes don't match. Try again.");
        setPasscodeStep("enter-new");
        setPendingCode("");
        return;
      }
      await setPasscode(code);
      setPasscodeStep("none");
      setPendingCode("");
      setPasscodeError("");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleCopyScript = async () => {
    await Clipboard.setStringAsync(APPS_SCRIPT_CODE);
    setCopied(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveSheets = async () => {
    await setSheetsUrl(sheetsDraft);
    if (sheetsDraft.trim()) {
      await syncToSheets(sheetsDraft.trim());
      setShowSetup(false);
    }
  };

  const syncStatusColor = syncStatus === "ok" ? colors.income : syncStatus === "error" ? colors.expense : colors.mutedForeground;
  const syncStatusText = syncStatus === "syncing" ? "Syncing…" : syncStatus === "ok" ? "Synced ✓" : syncStatus === "error" ? "Sync failed" : sheetsUrl ? "Tap to sync" : "Not connected";
  const isConnected = !!sheetsUrl;

  const tabH = Platform.OS === "web" ? 72 : 60;

  return (
    <>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <AppHeader />
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: tabH + 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Preferences</Text>

          {/* Security */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SECURITY</Text>
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={startSetPasscode} activeOpacity={0.7}>
              <View style={[styles.iconBox, { backgroundColor: colors.primary + "22" }]}>
                <Feather name="lock" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>{passcode ? "Change Passcode" : "Set Passcode"}</Text>
              <View style={styles.rowRight}>
                {passcode && (
                  <View style={[styles.badge, { backgroundColor: colors.income + "22" }]}>
                    <Text style={[styles.badgeText, { color: colors.income }]}>ON</Text>
                  </View>
                )}
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </View>
            </TouchableOpacity>

            {passcode && (
              <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={handleRemovePasscode} activeOpacity={0.7}>
                <View style={[styles.iconBox, { backgroundColor: colors.expense + "22" }]}>
                  <Feather name="unlock" size={18} color={colors.expense} />
                </View>
                <Text style={[styles.rowLabel, { color: colors.expense }]}>Remove Passcode</Text>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}

            {passcode && biometricAvailable && (
              <View style={[styles.row, { borderBottomColor: "transparent" }]}>
                <View style={[styles.iconBox, { backgroundColor: colors.income + "22" }]}>
                  <Feather name="aperture" size={18} color={colors.income} />
                </View>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Biometric Unlock</Text>
                <Switch
                  value={biometricEnabled}
                  onValueChange={toggleBiometric}
                  trackColor={{ false: colors.border, true: colors.primary + "80" }}
                  thumbColor={biometricEnabled ? colors.primary : colors.mutedForeground}
                />
              </View>
            )}
          </View>

          {/* Google Sheets */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>GOOGLE SHEETS SYNC</Text>
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {isConnected ? (
              <>
                <View style={[styles.row, { borderBottomColor: colors.border }]}>
                  <View style={[styles.iconBox, { backgroundColor: colors.income + "22" }]}>
                    <Feather name="check-circle" size={18} color={colors.income} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: colors.foreground }]}>Connected</Text>
                    <Text style={[styles.rowHint, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {sheetsUrl.length > 40 ? sheetsUrl.slice(0, 40) + "…" : sheetsUrl}
                    </Text>
                  </View>
                  <Text style={[styles.syncStatus, { color: syncStatusColor }]}>{syncStatusText}</Text>
                </View>
                <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => syncToSheets()} activeOpacity={0.7}>
                  <View style={[styles.iconBox, { backgroundColor: colors.income + "22" }]}>
                    <Feather name="refresh-cw" size={18} color={colors.income} />
                  </View>
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>Sync Now</Text>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.row, { borderBottomColor: "transparent" }]} onPress={() => { setShowSetup(true); setSheetsStep(3); setSheetsDraft(sheetsUrl); }} activeOpacity={0.7}>
                  <View style={[styles.iconBox, { backgroundColor: colors.primary + "22" }]}>
                    <Feather name="edit-2" size={18} color={colors.primary} />
                  </View>
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>Change Sheet URL</Text>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.row, { borderBottomColor: colors.border }]}>
                  <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
                    <Feather name="grid" size={18} color={colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: colors.foreground }]}>Not Connected</Text>
                    <Text style={[styles.rowHint, { color: colors.mutedForeground }]}>Sync transactions to Google Sheets</Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.connectBtn, { backgroundColor: colors.income }]} onPress={() => { setShowSetup(true); setSheetsStep(1); }} activeOpacity={0.8}>
                  <Feather name="grid" size={16} color="#FFF" />
                  <Text style={styles.connectBtnText}>Connect Google Sheets</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* AI Assistant */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>AI ASSISTANT</Text>
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: "transparent" }]}
              onPress={() => { setGeminiDraft(apiKey); setGeminiVisible(false); setShowGeminiModal(true); }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: "#7C3AED22" }]}>
                <Feather name="zap" size={18} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Gemini API Key</Text>
                <Text style={[styles.rowHint, { color: colors.mutedForeground }]}>
                  {apiKey ? "Key configured — tap to change" : "Tap to add your API key"}
                </Text>
              </View>
              {apiKey ? (
                <View style={[styles.badge, { backgroundColor: colors.income + "22" }]}>
                  <Text style={[styles.badgeText, { color: colors.income }]}>ON</Text>
                </View>
              ) : null}
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* About */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ABOUT</Text>
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <View style={[styles.iconBox, { backgroundColor: colors.primary + "22" }]}>
                <Feather name="info" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>ClarityFi</Text>
              <Text style={[styles.rowHint, { color: colors.mutedForeground }]}>v1.0.0</Text>
            </View>
            <View style={[styles.row, { borderBottomColor: "transparent" }]}>
              <View style={[styles.iconBox, { backgroundColor: colors.income + "22" }]}>
                <Feather name="lock" size={18} color={colors.income} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Private by default</Text>
                <Text style={[styles.rowHint, { color: colors.mutedForeground }]}>All data stored locally on device</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Passcode Modal */}
      <Modal visible={passcodeStep !== "none"} animationType="slide" presentationStyle="fullScreen">
        <View style={[styles.passcodeModal, { backgroundColor: "#1A1808" }]}>
          <PasscodeInput
            mode={passcodeStep === "change-old" ? "unlock" : passcodeStep === "enter-new" ? "setup" : "confirm"}
            title={passcodeStep === "change-old" ? "Enter Current Passcode" : passcodeStep === "enter-new" ? "Set New Passcode" : "Confirm Passcode"}
            subtitle={passcodeError || (passcodeStep === "confirm-new" ? "Enter the same 4 digits again" : undefined)}
            onSuccess={handlePasscodeStepSuccess}
            onCancel={() => { setPasscodeStep("none"); setPendingCode(""); setPasscodeError(""); }}
          />
        </View>
      </Modal>

      {/* Gemini API Key Modal */}
      <Modal visible={showGeminiModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowGeminiModal(false)}>
        <View style={[styles.wizardContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.wizardHeader, { borderBottomColor: colors.border, paddingTop: (Platform.OS === "web" ? 0 : insets.top) + 12 }]}>
            <TouchableOpacity onPress={() => setShowGeminiModal(false)} style={styles.wizardClose}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.wizardTitle, { color: colors.foreground }]}>Gemini API Key</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.wizardBody} keyboardShouldPersistTaps="handled">
            <View style={styles.wizardStep}>
              <View style={[styles.wizardIcon, { backgroundColor: "#7C3AED22" }]}>
                <Feather name="zap" size={32} color="#7C3AED" />
              </View>
              <Text style={[styles.wizardStepTitle, { color: colors.foreground }]}>Connect AI Assistant</Text>
              <Text style={[styles.wizardStepDesc, { color: colors.mutedForeground }]}>
                Get your free Gemini API key from Google AI Studio and paste it below. Your key is stored only on this device.
              </Text>
              <TouchableOpacity
                style={[styles.wizardActionBtn, { backgroundColor: "#7C3AED" }]}
                onPress={() => require("react-native").Linking.openURL("https://aistudio.google.com/app/apikey")}
                activeOpacity={0.8}
              >
                <Feather name="external-link" size={16} color="#FFF" />
                <Text style={styles.wizardActionBtnText}>Get API Key (Free)</Text>
              </TouchableOpacity>

              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, paddingHorizontal: 0, marginTop: 8 }]}>PASTE YOUR KEY</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput
                  style={[styles.urlInput, { flex: 1, color: colors.foreground, backgroundColor: colors.muted, borderColor: geminiDraft.trim() ? "#7C3AED" : colors.border }]}
                  value={geminiVisible ? geminiDraft : geminiDraft ? "•".repeat(Math.min(geminiDraft.length, 32)) : ""}
                  onChangeText={setGeminiDraft}
                  placeholder="AIza..."
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!geminiVisible}
                  editable={true}
                  onFocus={() => setGeminiVisible(true)}
                />
                <TouchableOpacity
                  onPress={() => setGeminiVisible((v) => !v)}
                  style={{ padding: 8 }}
                >
                  <Feather name={geminiVisible ? "eye-off" : "eye"} size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.wizardNextBtn, { backgroundColor: geminiDraft.trim() ? "#7C3AED" : colors.border }]}
                disabled={!geminiDraft.trim()}
                onPress={async () => {
                  await setApiKey(geminiDraft.trim());
                  setShowGeminiModal(false);
                  if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert("✓ Saved", "Your Gemini API key has been saved. Tap the chat bubble to start chatting!");
                }}
                activeOpacity={0.8}
              >
                <Feather name="check-circle" size={16} color="#FFF" />
                <Text style={styles.wizardNextBtnText}>Save API Key</Text>
              </TouchableOpacity>

              {apiKey ? (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert("Remove API Key", "This will disconnect the AI assistant.", [
                      { text: "Cancel", style: "cancel" },
                      { text: "Remove", style: "destructive", onPress: async () => { await setApiKey(""); setGeminiDraft(""); setShowGeminiModal(false); } },
                    ]);
                  }}
                  style={{ alignItems: "center", paddingVertical: 8 }}
                >
                  <Text style={{ color: colors.expense, fontSize: 14, fontFamily: "Inter_400Regular" }}>Remove API Key</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Google Sheets Setup Wizard */}
      <Modal visible={showSetup} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.wizardContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.wizardHeader, { borderBottomColor: colors.border, paddingTop: (Platform.OS === "web" ? 0 : insets.top) + 12 }]}>
            <TouchableOpacity onPress={() => setShowSetup(false)} style={styles.wizardClose}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.wizardTitle, { color: colors.foreground }]}>Connect Google Sheets</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.stepIndicator}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={styles.stepDotRow}>
                <View style={[styles.stepDot, { backgroundColor: sheetsStep >= s ? colors.income : colors.border }]}>
                  {sheetsStep > s
                    ? <Feather name="check" size={10} color="#FFF" />
                    : <Text style={[styles.stepDotText, { color: sheetsStep === s ? "#FFF" : colors.mutedForeground }]}>{s}</Text>}
                </View>
                {s < 3 && <View style={[styles.stepLine, { backgroundColor: sheetsStep > s ? colors.income : colors.border }]} />}
              </View>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.wizardBody} keyboardShouldPersistTaps="handled">
            {sheetsStep === 1 && (
              <View style={styles.wizardStep}>
                <View style={[styles.wizardIcon, { backgroundColor: colors.income + "22" }]}>
                  <Feather name="file-text" size={32} color={colors.income} />
                </View>
                <Text style={[styles.wizardStepTitle, { color: colors.foreground }]}>Step 1 — Create a Google Sheet</Text>
                <Text style={[styles.wizardStepDesc, { color: colors.mutedForeground }]}>
                  Open Google Sheets and create a new spreadsheet. Name it <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>"Money Manager"</Text>.
                </Text>
                <TouchableOpacity style={[styles.wizardActionBtn, { backgroundColor: colors.income }]} onPress={() => require("react-native").Linking.openURL("https://sheets.new")} activeOpacity={0.8}>
                  <Feather name="external-link" size={16} color="#FFF" />
                  <Text style={styles.wizardActionBtnText}>Open Google Sheets</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.wizardNextBtn, { backgroundColor: colors.primary }]} onPress={() => setSheetsStep(2)} activeOpacity={0.8}>
                  <Text style={styles.wizardNextBtnText}>Done, Next Step →</Text>
                </TouchableOpacity>
              </View>
            )}

            {sheetsStep === 2 && (
              <View style={styles.wizardStep}>
                <View style={[styles.wizardIcon, { backgroundColor: colors.primary + "22" }]}>
                  <Feather name="code" size={32} color={colors.primary} />
                </View>
                <Text style={[styles.wizardStepTitle, { color: colors.foreground }]}>Step 2 — Add the Script</Text>
                <Text style={[styles.wizardStepDesc, { color: colors.mutedForeground }]}>
                  In your sheet, click <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>Extensions → Apps Script</Text>. Delete all code, paste the script, then click <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>Deploy → Web App → Anyone → Deploy</Text>.
                </Text>
                <TouchableOpacity style={[styles.copyBtn, { backgroundColor: copied ? colors.income : colors.primary }]} onPress={handleCopyScript} activeOpacity={0.8}>
                  <Feather name={copied ? "check" : "copy"} size={16} color="#FFF" />
                  <Text style={styles.wizardNextBtnText}>{copied ? "Copied!" : "Copy Script to Clipboard"}</Text>
                </TouchableOpacity>
                <View style={[styles.scriptBox, { backgroundColor: "#0D0F1A", borderColor: colors.border }]}>
                  <Text style={styles.scriptCode} selectable>{APPS_SCRIPT_CODE}</Text>
                </View>
                <TouchableOpacity style={[styles.wizardNextBtn, { backgroundColor: colors.primary }]} onPress={() => setSheetsStep(3)} activeOpacity={0.8}>
                  <Text style={styles.wizardNextBtnText}>Done, Next Step →</Text>
                </TouchableOpacity>
              </View>
            )}

            {sheetsStep === 3 && (
              <View style={styles.wizardStep}>
                <View style={[styles.wizardIcon, { backgroundColor: "#F97316" + "22" }]}>
                  <Feather name="link" size={32} color="#F97316" />
                </View>
                <Text style={[styles.wizardStepTitle, { color: colors.foreground }]}>Step 3 — Paste the URL</Text>
                <Text style={[styles.wizardStepDesc, { color: colors.mutedForeground }]}>
                  After deploying, Google gives you a Web App URL. Copy and paste it below.
                </Text>
                <TextInput
                  style={[styles.urlInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: sheetsDraft.trim() ? colors.income : colors.border }]}
                  value={sheetsDraft}
                  onChangeText={setSheetsDraft}
                  placeholder="https://script.google.com/macros/s/..."
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  multiline
                  autoFocus
                />
                <TouchableOpacity style={[styles.wizardNextBtn, { backgroundColor: sheetsDraft.trim() ? colors.income : colors.border }]} onPress={handleSaveSheets} disabled={!sheetsDraft.trim()} activeOpacity={0.8}>
                  <Feather name="check-circle" size={16} color="#FFF" />
                  <Text style={styles.wizardNextBtnText}>Connect & Sync Now</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 24 },
  pageTitle: { fontSize: 24, fontFamily: "Inter_700Bold", paddingHorizontal: 20, paddingTop: 16, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, paddingHorizontal: 20, marginBottom: 8, marginTop: 4 },
  section: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12, borderBottomWidth: 1 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  syncStatus: { fontSize: 13, fontFamily: "Inter_500Medium" },
  connectBtn: { margin: 12, borderRadius: 10, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  connectBtnText: { color: "#FFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  passcodeModal: { flex: 1 },
  wizardContainer: { flex: 1 },
  wizardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  wizardClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  wizardTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  stepIndicator: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  stepDotRow: { flexDirection: "row", alignItems: "center" },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepDotText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  stepLine: { width: 48, height: 2 },
  wizardBody: { paddingHorizontal: 24, paddingBottom: 40 },
  wizardStep: { gap: 16 },
  wizardIcon: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  wizardStepTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  wizardStepDesc: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24, textAlign: "center" },
  wizardActionBtn: { borderRadius: 12, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  wizardActionBtnText: { color: "#FFF", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  wizardNextBtn: { borderRadius: 12, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  wizardNextBtnText: { color: "#FFF", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  copyBtn: { borderRadius: 12, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  scriptBox: { borderRadius: 12, borderWidth: 1, padding: 12, maxHeight: 200 },
  scriptCode: { color: "#A5B4FC", fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", lineHeight: 18 },
  urlInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", borderWidth: 1.5, minHeight: 48 },
});
