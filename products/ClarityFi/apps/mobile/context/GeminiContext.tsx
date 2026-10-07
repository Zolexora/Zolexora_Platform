import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const GEMINI_KEY_STORAGE = "@mymoney_gemini_api_key";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
};

type GeminiContextType = {
  apiKey: string;
  setApiKey: (k: string) => Promise<void>;
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
};

const GeminiContext = createContext<GeminiContextType>({
  apiKey: "",
  setApiKey: async () => {},
  messages: [],
  isLoading: false,
  sendMessage: async () => {},
  clearMessages: () => {},
});

export function GeminiProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(GEMINI_KEY_STORAGE).then((v) => {
      if (v) setApiKeyState(v);
    });
  }, []);

  const setApiKey = useCallback(async (k: string) => {
    setApiKeyState(k);
    await AsyncStorage.setItem(GEMINI_KEY_STORAGE, k);
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        text: text.trim(),
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const history = [...messages, userMsg].map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.text }],
        }));

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: "You are a helpful personal finance assistant embedded in the ClarityFi app. Help users track expenses, plan budgets, understand spending patterns, and make smart financial decisions. Keep responses concise and practical." }],
              },
              contents: history,
              generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
            }),
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error?.message || "API error");
        }

        const reply =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response from Gemini.";

        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: reply,
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        const errMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: `Error: ${err?.message ?? "Could not reach Gemini. Check your API key in Preferences."}`,
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, messages]
  );

  return (
    <GeminiContext.Provider value={{ apiKey, setApiKey, messages, isLoading, sendMessage, clearMessages }}>
      {children}
    </GeminiContext.Provider>
  );
}

export function useGemini() {
  return useContext(GeminiContext);
}
