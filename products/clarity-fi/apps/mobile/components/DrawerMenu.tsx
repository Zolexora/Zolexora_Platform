import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDrawer } from "@/context/DrawerContext";
import { useMoney } from "@/context/MoneyContext";
import { useColors } from "@/hooks/useColors";

type DrawerModal = "none" | "export" | "backup" | "restore" | "delete";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function DrawerMenu() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isOpen, closeDrawer } = useDrawer();
  const { transactions, clearTransactions, deleteAll, resetAll } = useMoney();

  const [activeModal, setActiveModal] = useState<DrawerModal>("none");
  const [restoreText, setRestoreText] = useState("");

  const now = new Date();
  const [exportFrom, setExportFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [exportTo, setExportTo] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const close = () => { closeDrawer(); setActiveModal("none"); };

  const handleExport = async () => {
    const filtered = transactions.filter((t) => {
      const d = new Date(t.date);
      return d >= exportFrom && d <= exportTo;
    });
    const lines = [
      "Date,Type,Category,Account,Description,Amount",
      ...filtered.map((t) =>
        [
          new Date(t.date).toLocaleDateString("en-IN"),
          t.type,
          t.category,
          t.account,
          `"${t.description}"`,
          t.type === "income" ? t.amount : -t.amount,
        ].join(",")
      ),
    ];
    try {
      await Share.share({ message: lines.join("\n"), title: "Money Manager Export.csv" });
    } catch {}
  };

  const handleBackup = async () => {
    const backup = { version: 1, exportedAt: new Date().toISOString(), transactions };
    try {
      await Share.share({ message: JSON.stringify(backup, null, 2), title: "money-manager-backup.json" });
    } catch {}
  };

  const handleRestore = async () => {
    try {
      const parsed = JSON.parse(restoreText);
      if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
        Alert.alert("Invalid backup", "The backup data is not in the correct format.");
        return;
      }
      Alert.alert("Restore Backup", `This will replace all current data with ${parsed.transactions.length} transactions. Continue?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore", style: "destructive",
          onPress: async () => {
            await clearTransactions();
            setActiveModal("none");
            Alert.alert("Restored", "Backup restored successfully.");
          },
        },
      ]);
    } catch {
      Alert.alert("Parse Error", "Could not parse the backup JSON. Please check the format.");
    }
  };

  const menuItems = [
    {
      section: null,
      item: { icon: "settings" as const, label: "Preferences", onPress: () => { close(); setTimeout(() => router.push("/(tabs)/settings"), 300); } },
    },
    {
      section: "Management",
      item: { icon: "download" as const, label: "Export records", onPress: () => setActiveModal("export") },
    },
    {
      section: "Management",
      item: { icon: "save" as const, label: "Backup & Restore", onPress: () => setActiveModal("backup") },
    },
    {
      section: "Management",
      item: { icon: "trash-2" as const, label: "Delete & Reset", onPress: () => setActiveModal("delete") },
    },
  ];

  const sections: { [key: string]: typeof menuItems[0]["item"][] } = {};
  const topItems: typeof menuItems[0]["item"][] = [];
  for (const m of menuItems) {
    if (!m.section) { topItems.push(m.item); }
    else {
      if (!sections[m.section]) sections[m.section] = [];
      sections[m.section].push(m.item);
    }
  }

  return (
    <>
      <Modal visible={isOpen} transparent animationType="none" onRequestClose={close}>
        <Pressable style={styles.overlay} onPress={close}>
          <Pressable
            style={[styles.drawer, { backgroundColor: colors.card, paddingTop: (Platform.OS === "web" ? 0 : insets.top) + 16 }]}
            onPress={() => {}}
          >
            <View style={styles.drawerHeader}>
              <Text style={[styles.appName, { color: colors.primary }]}>ClarityFi</Text>
              <Text style={[styles.version, { color: colors.mutedForeground }]}>1.0-free</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {topItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <Feather name={item.icon} size={20} color={colors.foreground} />
                <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}

            {Object.entries(sections).map(([sectionName, items]) => (
              <View key={sectionName}>
                <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 12 }]} />
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{sectionName}</Text>
                {items.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={styles.menuItem}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                  >
                    <Feather name={item.icon} size={20} color={colors.foreground} />
                    <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Export Modal */}
      <Modal visible={activeModal === "export"} transparent animationType="slide" onRequestClose={() => setActiveModal("none")}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setActiveModal("none")}>
                <Feather name="arrow-left" size={22} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Export records</Text>
              <View style={{ width: 22 }} />
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                {`\u2022 All records between a specified time range can be exported as a CSV worksheet.\n\n\u2022 To export records, set the start time and end time of the interval below and tap EXPORT NOW.\n\n\u2022 Note that exported files (.csv) are not backup files and you cannot restore data from these files.`}
              </Text>
            </View>

            <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>From:</Text>
            <Text style={[styles.dateValue, { color: colors.primary }]}>
              {MONTHS[exportFrom.getMonth()].toUpperCase()} {String(exportFrom.getDate()).padStart(2, "0")}, {exportFrom.getFullYear()}
            </Text>
            <View style={[styles.dateDivider, { backgroundColor: colors.border }]} />

            <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>To:</Text>
            <Text style={[styles.dateValue, { color: colors.primary }]}>
              {MONTHS[exportTo.getMonth()].toUpperCase()} {String(exportTo.getDate()).padStart(2, "0")}, {exportTo.getFullYear()}
            </Text>
            <View style={[styles.dateDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.border }]}
              onPress={handleExport}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, { color: colors.foreground }]}>EXPORT NOW</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Backup & Restore Modal */}
      <Modal visible={activeModal === "backup"} transparent animationType="slide" onRequestClose={() => setActiveModal("none")}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setActiveModal("none")}>
                <Feather name="arrow-left" size={22} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Backup & Restore</Text>
              <View style={{ width: 22 }} />
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                {`\u2022 A backup file contains all your records (at the time of backup). Using this file, you can restore the saved data later in case your device is lost or you accidentally uninstall the app.\n\n\u2022 To make a backup, press BACKUP NOW. ClarityFi will share a backup JSON file.\n\n\u2022 To restore, press RESTORE and paste your backup JSON.`}
              </Text>
            </View>

            <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={handleBackup} activeOpacity={0.8}>
              <Text style={[styles.actionBtnText, { color: colors.foreground }]}>BACKUP NOW</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => setActiveModal("restore")} activeOpacity={0.8}>
              <Text style={[styles.actionBtnText, { color: colors.foreground }]}>RESTORE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Restore Modal */}
      <Modal visible={activeModal === "restore"} transparent animationType="slide" onRequestClose={() => setActiveModal("backup")}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setActiveModal("backup")}>
                <Feather name="arrow-left" size={22} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Restore Backup</Text>
              <View style={{ width: 22 }} />
            </View>
            <Text style={[styles.restoreDesc, { color: colors.mutedForeground }]}>
              Paste your backup JSON below and tap RESTORE.
            </Text>
            <TextInput
              style={[styles.restoreInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
              value={restoreText}
              onChangeText={setRestoreText}
              placeholder='{"version":1,"transactions":[...]}'
              placeholderTextColor={colors.mutedForeground}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.primary }]} onPress={handleRestore} activeOpacity={0.8}>
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>RESTORE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete & Reset Modal */}
      <Modal visible={activeModal === "delete"} transparent animationType="slide" onRequestClose={() => setActiveModal("none")}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setActiveModal("none")}>
                <Feather name="arrow-left" size={22} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Delete & Reset</Text>
              <View style={{ width: 22 }} />
            </View>

            {[
              {
                label: "Delete all records",
                desc: "Delete all records, but keep current accounts, categories and budgets",
                onPress: () => Alert.alert("Delete all records", "This will permanently delete all your transaction records.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: async () => { if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); await clearTransactions(); setActiveModal("none"); close(); } },
                ]),
              },
              {
                label: "Delete all",
                desc: "Delete everything including records, accounts, categories and budgets",
                onPress: () => Alert.alert("Delete all", "This will permanently delete all data.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: async () => { await deleteAll(); setActiveModal("none"); close(); } },
                ]),
              },
              {
                label: "Reset all",
                desc: "Reset the app to its initial state, deleting current records, accounts, categories, and budgets",
                onPress: () => Alert.alert("Reset all", "This will reset the app to factory defaults.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Reset", style: "destructive", onPress: async () => { await resetAll(); setActiveModal("none"); close(); } },
                ]),
              },
            ].map((opt) => (
              <TouchableOpacity key={opt.label} style={styles.deleteOption} onPress={opt.onPress} activeOpacity={0.7}>
                <Text style={[styles.deleteLabel, { color: colors.foreground }]}>{opt.label}</Text>
                <Text style={[styles.deleteDesc, { color: colors.mutedForeground }]}>{opt.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: "row", backgroundColor: "rgba(0,0,0,0.55)" },
  drawer: { width: 280, height: "100%", paddingHorizontal: 24, paddingBottom: 40 },
  drawerHeader: { marginBottom: 12, gap: 2 },
  appName: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  version: { fontSize: 13, fontFamily: "Inter_400Regular" },
  divider: { height: 1, marginVertical: 4 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_500Medium", letterSpacing: 0.8, marginBottom: 8, paddingHorizontal: 4 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 4 },
  menuLabel: { fontSize: 16, fontFamily: "Inter_400Regular" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 12 },
  modalTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  infoBox: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 20 },
  infoText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  dateLabel: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8 },
  dateValue: { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center", marginTop: 4 },
  dateDivider: { height: 1, marginVertical: 12 },
  actionBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  actionBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  restoreDesc: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 12 },
  restoreInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 13, fontFamily: "Inter_400Regular", height: 160, textAlignVertical: "top", marginBottom: 16 },
  deleteOption: { paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#514D3C", gap: 4 },
  deleteLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  deleteDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
