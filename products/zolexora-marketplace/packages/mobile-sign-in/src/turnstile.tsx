import React from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

/** Cloudflare Turnstile inside a WebView; posts the token back (empty string when it expires/fails). */
export function TurnstileWebView({ siteKey, action, baseUrl, onToken }: {
  siteKey: string;
  action: string;
  /** Origin the widget runs under; must be an allowed hostname for the site key. */
  baseUrl: string;
  onToken: (token: string) => void;
}) {
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>body{margin:0;display:flex;justify-content:center;background:transparent}</style></head>
<body><div class="cf-turnstile" data-sitekey=${JSON.stringify(siteKey)} data-action=${JSON.stringify(action)}
data-callback="ok" data-expired-callback="reset" data-error-callback="reset"></div>
<script>function ok(t){window.ReactNativeWebView.postMessage(t)}function reset(){window.ReactNativeWebView.postMessage('')}</script>
</body></html>`;
  return (
    <View style={{ height: 75, marginVertical: 8 }}>
      <WebView originWhitelist={["*"]} source={{ html, baseUrl }} onMessage={(e) => onToken(e.nativeEvent.data)}
        style={{ backgroundColor: "transparent" }} scrollEnabled={false} />
    </View>
  );
}
