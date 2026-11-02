import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  siteKey: string;
  action: string;
  /** Origin the widget runs under; must be an allowed hostname for the site key and the auth service. */
  baseUrl: string;
  onToken: (token: string) => void;
}

/** Cloudflare Turnstile inside a WebView; posts the token back (empty string when it expires/fails). */
export function TurnstileWebView({ siteKey, action, baseUrl, onToken }: Props) {
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>body{margin:0;display:flex;justify-content:center;background:transparent}</style></head>
<body><div class="cf-turnstile" data-sitekey=${JSON.stringify(siteKey)} data-action=${JSON.stringify(action)} data-theme="dark"
data-callback="ok" data-expired-callback="reset" data-error-callback="reset"></div>
<script>
function ok(t){window.ReactNativeWebView.postMessage(t)}
function reset(){window.ReactNativeWebView.postMessage('')}
</script></body></html>`;
  return (
    <View style={styles.box}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl }}
        onMessage={(e) => onToken(e.nativeEvent.data)}
        style={styles.web}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 75, marginVertical: 8 },
  web: { backgroundColor: 'transparent' },
});
