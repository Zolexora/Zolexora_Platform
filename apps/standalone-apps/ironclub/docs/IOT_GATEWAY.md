# Zolexora IronClub — Smart IoT Turnstile & Gate Integration

## 1. Hardware Interface Architecture

Zolexora IronClub interfaces directly with modern gym turnstiles, speed gates, and flap barriers via:
1. **ESP32 Microcontroller Bridge** with Ethernet (W5500) or Wi-Fi (802.11 b/g/n)
2. **Wiegand-26 / Wiegand-34** RFID card readers (13.56 MHz Mifare / DESFire)
3. **Optical 2D Barcode & QR Scanners** (GM65 / Newland FM3080 series)
4. **Relay Actuator**: Normally Open (NO) / Normally Closed (NC) dry contacts triggering gate motor controllers

```
[ Member NFC/QR/Biometric ]
            │
            ▼
┌──────────────────────────┐
│   Optical / RFID Reader   │ (Wiegand / UART / USB-HID)
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│   ESP32 Gateway Node     │
│   (W5500 Ethernet)       │
└───────────┬──────────────┘
            │
            │ HTTP POST /api/v1/access/verify (Latency < 30ms)
            ▼
┌──────────────────────────┐
│  Zolexora IronClub Core  │
│  (FastAPI Turnstile Eng) │
└───────────┬──────────────┘
            │
            │ HTTP 200 OK {"decision": "GRANTED", "unlockDurationMs": 5000}
            ▼
┌──────────────────────────┐
│ ESP32 Closes Relay (NO)  │ ──► [ Solenoid Releases Gate Arm ] ──► Lifter Enters
└──────────────────────────┘
```

---

## 2. API Contract for Gate Controllers

### Request: `POST /api/v1/access/verify`

**Headers:**
```http
Content-Type: application/json
X-Gate-API-Key: ironclub-iot-gate-secret-key-9981
```

**Payload:**
```json
{
  "deviceId": "gate-dev-01",
  "credentialType": "RFID_TAG",
  "credentialValue": "RFID-88910-A",
  "gateZone": "MAIN_ENTRY",
  "direction": "ENTRY"
}
```

### Response: `200 OK` (Granted)
```json
{
  "decision": "GRANTED",
  "accessGranted": true,
  "memberId": "mem-001",
  "memberName": "Vikram Singhania",
  "memberPhotoUrl": "https://...",
  "membershipTier": "BLACK_IRON_VIP",
  "message": "Welcome Vikram! Turnstile unlocked.",
  "unlockDurationMs": 5000,
  "currentGymOccupancy": 69,
  "maxGymCapacity": 160
}
```

### Response: `200 OK` (Denied: Expired)
```json
{
  "decision": "DENIED_EXPIRED",
  "accessGranted": false,
  "memberId": "mem-004",
  "memberName": "Dev Kapoor",
  "message": "Membership expired on 2026-09-01. Please renew to enter.",
  "unlockDurationMs": 0,
  "currentGymOccupancy": 68,
  "maxGymCapacity": 160
}
```

---

## 3. Fail-Safe Offline Mode

If network connectivity drops between the gate microcontroller and the local server:
1. Microcontroller checks local SQLite / SPIFFS cache of active member RFID hashes.
2. If match is verified, relay pulses open.
3. Access event is enqueued in non-volatile flash and replayed automatically upon server reconnection.
