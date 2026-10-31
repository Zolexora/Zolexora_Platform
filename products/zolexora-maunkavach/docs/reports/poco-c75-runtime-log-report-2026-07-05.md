# POCO C75 Runtime Log Report

Date: 2026-07-05
Device: POCO C75 / model `24116PCC1I`
ADB serial: `2f04eaef`
App package: `com.maunkavach`
App version observed: `1.0.6` / versionCode `7`

## Test Scope

The POCO device was monitored with `adb logcat` while the app was used normally after installing `v1.0.6`.

Areas watched:

- App crash traces: `AndroidRuntime`, `FATAL EXCEPTION`
- ANR/process health
- QR generation and QR scanning related logs
- Biometric and keystore logs
- Network and HTTP errors
- Memory state

## Result Summary

No critical runtime failure was observed during the monitored window.

- No `AndroidRuntime` fatal crash.
- No ANR was detected.
- App process stayed alive.
- Memory usage was acceptable for this app size and Compose UI.

Observed process:

- PID: `26937`
- State: foreground/top activity
- Total PSS: about `67 MB`
- Java heap: about `7.4 MB`
- Graphics: about `22.5 MB`

## Findings

### 1. Main Thread Performance Warning

Observed log:

```text
Skipped 38 frames! The application may be doing too much work on its main thread.
```

Impact:

This can cause visible UI jank, especially on lower-memory devices like the POCO C75. It appeared around popup/navigation activity during app usage.

Likely fix:

Move QR payload generation and QR encoding work off the main thread in:

- `app/src/main/java/com/maunkavach/ui/screens/GenerateContactQrScreen.kt`

Recommended approach:

- Use `rememberCoroutineScope()`.
- Run key lookup/generation and `ContactExchange.createFull(...)` in `Dispatchers.IO`.
- Run `QrCodeEncoder.encode(...)` in `Dispatchers.Default`.
- Only update Compose state on the main thread.

Priority: High

### 2. Resource Cleanup Warning

Observed log:

```text
A resource failed to call close.
A resource failed to call close.
```

Impact:

No crash was observed, but this suggests a resource is not being closed deterministically. The most likely candidate is `HttpURLConnection`, because response streams are read but the connection is not disconnected.

Likely fix:

Update:

- `app/src/main/java/com/maunkavach/network/ApiClient.kt`

Recommended approach:

Wrap each request so `conn.disconnect()` runs in `finally`, for example:

```kotlin
val conn = open(path, "GET", token)
return try {
    JSONObject(readResponse(conn))
} finally {
    conn.disconnect()
}
```

Apply the same pattern to:

- `postJson`
- `getJson`
- `requestJson`
- `uploadEncryptedBlob`

Priority: Medium

### 3. Android Back Callback Warning

Observed log:

```text
OnBackInvokedCallback is not enabled for the application.
Set 'android:enableOnBackInvokedCallback="true"' in the application manifest.
```

Impact:

No crash was observed. This is a compatibility/platform warning on newer Android versions.

Fix:

Update:

- `app/src/main/AndroidManifest.xml`

Add to the `<application>` tag:

```xml
android:enableOnBackInvokedCallback="true"
```

Priority: Low

### 4. HyperOS / MIUI Vendor Noise

Observed repeated logs included:

```text
MiuiPreloadClassImpl invoke error
InsetsSource Has no intersection
FramePredict registerContentObserver fail
PhoneAdapter not support satellite
```

Impact:

These appear to be HyperOS/MIUI framework logs, not MaunKavach defects. They were not associated with an app crash or ANR.

Recommended action:

Do not spend engineering time on these unless a visible UI problem can be tied directly to one of them.

Priority: None

## Fix Checklist

- [ ] Move Generate QR key/payload work off the main thread.
- [ ] Move QR matrix encoding off the main thread.
- [ ] Add `HttpURLConnection.disconnect()` cleanup in `ApiClient`.
- [ ] Enable Android back callback in the manifest.
- [ ] Re-test on POCO C75 after fixes.
- [ ] Re-run `./gradlew assembleRelease`.
- [ ] Install release APK on POCO and verify no `AndroidRuntime` crashes.

## Verification Commands Used

```bash
adb -s 2f04eaef devices -l
adb -s 2f04eaef shell dumpsys package com.maunkavach
adb -s 2f04eaef logcat -c
adb -s 2f04eaef logcat -d -v time AndroidRuntime:E '*:S'
adb -s 2f04eaef logcat -d -v time --pid=26937
adb -s 2f04eaef shell dumpsys meminfo com.maunkavach
adb -s 2f04eaef shell dumpsys activity processes
```

