import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGemini } from "@/context/GeminiContext";
import { useColors } from "@/hooks/useColors";

export default function AIChatBubble() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { messages, isLoading, sendMessage, clearMessages, apiKey } = useGemini();

  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const tabH = Platform.OS === "web" ? 72 : 60;
  const initX = 20;
  const initY = -(tabH + 80);

  const pan = useRef(new Animated.ValueXY({ x: initX, y: initY })).current;
  const panOffset = useRef({ x: initX, y: initY });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
      onPanResponderGrant: () => {
        pan.setOffset({ x: panOffset.current.x, y: panOffset.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gs) => {
        pan.flattenOffset();
        panOffset.current = {
          x: panOffset.current.x + gs.dx,
          y: panOffset.current.y + gs.dy,
        };
      },
    })
  ).current;

  useEffect(() => {
    if (chatOpen && scrollRef.current) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, chatOpen]);

  const handleSend = async () => {
    const txt = input.trim();
    if (!txt || isLoading) return;
    setInput("");
    await sendMessage(txt);
  };

  return (
    <>
      <Animated.View
        style={[
          styles.bubble,
          {
            backgroundColor: colors.primary,
            bottom: tabH + insets.bottom + 16,
            transform: pan.getTranslateTransform(),
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.bubbleTouchable}
          onPress={() => setChatOpen(true)}
          activeOpacity={0.85}
        >
          <Feather name="message-circle" size={26} color="#000" />
          {messages.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.expense }]}>
              <Text style={styles.badgeText}>
                {messages.filter((m) => m.role === "assistant").length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      <Modal
        visible={chatOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setChatOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setChatOpen(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.kvAvoid}
          >
            <Pressable
              style={[
                styles.chatPanel,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  paddingBottom: insets.bottom + 8,
                },
              ]}
              onPress={() => {}}
            >
              <View style={[styles.chatHeader, { borderBottomColor: colors.border }]}>
                <View style={styles.chatHeaderLeft}>
                  <View style={[styles.aiIcon, { backgroundColor: colors.primary + "22" }]}>
                    <Feather name="zap" size={16} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.chatTitle, { color: colors.foreground }]}>
                      AI Assistant
                    </Text>
                    <Text style={[styles.chatSubtitle, { color: colors.mutedForeground }]}>
                      Powered by Gemini
                    </Text>
                  </View>
                </View>
                <View style={styles.chatHeaderActions}>
                  {messages.length > 0 && (
                    <TouchableOpacity
                      onPress={clearMessages}
                      style={styles.headerBtn}
                      activeOpacity={0.7}
                    >
                      <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => setChatOpen(false)}
                    style={styles.headerBtn}
                    activeOpacity={0.7}
                  >
                    <Feather name="x" size={20} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                ref={scrollRef}
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {messages.length === 0 && (
                  <View style={styles.emptyState}>
                    <View
                      style={[styles.emptyIcon, { backgroundColor: colors.primary + "18" }]}
                    >
                      <Feather name="message-square" size={32} color={colors.primary} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                      Hi! I'm your finance assistant
                    </Text>
                    <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                      Ask me anything about budgeting, spending, saving, or investment tips.
                    </Text>
                    {!apiKey && (
                      <View style={[styles.noKeyBanner, { backgroundColor: colors.expense + "18", borderColor: colors.expense + "40" }]}>
                        <Feather name="alert-circle" size={14} color={colors.expense} />
                        <Text style={[styles.noKeyText, { color: colors.expense }]}>
                          Add your Gemini API key in Preferences to start chatting.
                        </Text>
                      </View>
                    )}
                    <View style={styles.suggestions}>
                      {[
                        "How do I reduce my monthly expenses?",
                        "Explain the 50/30/20 budget rule",
                        "Tips to save ₹10,000 per month",
                      ].map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.suggestionChip, { borderColor: colors.border, backgroundColor: colors.muted }]}
                          onPress={() => { setInput(s); }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.suggestionText, { color: colors.foreground }]}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {messages.map((msg) => (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageBubble,
                      msg.role === "user" ? styles.userBubble : styles.assistantBubble,
                      {
                        backgroundColor:
                          msg.role === "user"
                            ? colors.primary
                            : colors.muted,
                        borderColor: msg.role === "user" ? "transparent" : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        {
                          color:
                            msg.role === "user" ? "#000" : colors.foreground,
                        },
                      ]}
                    >
                      {msg.text}
                    </Text>
                    <Text
                      style={[
                        styles.messageTime,
                        {
                          color:
                            msg.role === "user"
                              ? "rgba(0,0,0,0.5)"
                              : colors.mutedForeground,
                        },
                      ]}
                    >
                      {new Date(msg.ts).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                ))}

                {isLoading && (
                  <View
                    style={[
                      styles.messageBubble,
                      styles.assistantBubble,
                      { backgroundColor: colors.muted, borderColor: colors.border },
                    ]}
                  >
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                )}
              </ScrollView>

              <View style={[styles.inputRow, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                    },
                  ]}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ask me anything…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  maxLength={500}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor:
                        input.trim() && !isLoading ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={handleSend}
                  disabled={!input.trim() || isLoading}
                  activeOpacity={0.8}
                >
                  <Feather
                    name="send"
                    size={18}
                    color={input.trim() && !isLoading ? "#000" : colors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  bubbleTouchable: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  kvAvoid: { justifyContent: "flex-end" },
  chatPanel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    height: "75%",
    minHeight: 400,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  chatHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  chatTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  chatSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  chatHeaderActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerBtn: { padding: 8 },
  messagesList: { flex: 1 },
  messagesContent: { padding: 16, gap: 10, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: "center", paddingTop: 12, gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  noKeyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 8,
  },
  noKeyText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 20 },
  suggestions: { width: "100%", gap: 8, paddingHorizontal: 4 },
  suggestionChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  messageBubble: {
    maxWidth: "80%",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    gap: 4,
  },
  userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  messageTime: { fontSize: 11, fontFamily: "Inter_400Regular", alignSelf: "flex-end" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
