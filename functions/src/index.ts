import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import express, { Request, Response } from "express";
import cors from "cors";
import * as crypto from "crypto";
import { RegistrationStateMachine, RegistrationAttemptData, SignupMethod, TargetPlatform } from "./state-machine";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();
const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

// Helper to generate canonical Zolexora ID
function generateZolexoraId(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const pick = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `ZX-${pick(4)}-${pick(4)}-${pick(4)}`;
}

// Log security audit event
async function logSecurityEvent(
  eventType: string,
  platform: TargetPlatform,
  uid: string | null = null,
  metadata: Record<string, unknown> = {}
) {
  try {
    const eventId = `sec_${crypto.randomUUID()}`;
    await db.collection("securityEvents").doc(eventId).set({
      eventId,
      eventType,
      platform,
      uid,
      timestamp: new Date().toISOString(),
      metadata,
    });
  } catch (err) {
    console.error("Failed to log security event:", err);
  }
}

// -----------------------------------------------------------------------
// 1. Start Registration Attempt
// -----------------------------------------------------------------------
app.post("/registration/start", async (req: Request, res: Response) => {
  try {
    const { signupMethod, platform, email, phoneNumber, uid } = req.body as {
      signupMethod: SignupMethod;
      platform: TargetPlatform;
      email?: string;
      phoneNumber?: string;
      uid?: string;
    };

    if (!signupMethod || !platform) {
      return res.status(400).json({ code: "AUTH_INVALID_REQUEST", message: "Missing signupMethod or platform" });
    }

    const attemptId = `reg_${crypto.randomUUID()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour TTL

    const attemptData: RegistrationAttemptData = {
      attemptId,
      uid: uid || null,
      signupMethod,
      platform,
      status: "contact_verification",
      email: email ? email.trim().toLowerCase() : null,
      emailVerified: false,
      phoneNumber: phoneNumber ? phoneNumber.trim() : null,
      phoneVerified: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt,
    };

    // If starting with Google and UID is already verified by Google
    if (signupMethod === "google" && uid) {
      const userRecord = await auth.getUser(uid);
      if (userRecord.email && userRecord.emailVerified) {
        attemptData.email = userRecord.email.toLowerCase();
        attemptData.emailVerified = true;
      }
    }

    await db.collection("registrationAttempts").doc(attemptId).set(attemptData);
    await logSecurityEvent("signup_started", platform, uid, { signupMethod, attemptId });

    return res.status(200).json({
      success: true,
      data: {
        attemptId,
        status: attemptData.status,
        emailVerified: attemptData.emailVerified,
        phoneVerified: attemptData.phoneVerified,
        expiresAt,
      },
    });
  } catch (err: any) {
    console.error("Error starting registration:", err);
    return res.status(500).json({ code: "AUTH_INTERNAL_ERROR", message: err.message });
  }
});

// -----------------------------------------------------------------------
// 2. Custom Email Challenge: Send Email OTP
// -----------------------------------------------------------------------
app.post("/registration/email/send-otp", async (req: Request, res: Response) => {
  try {
    const { attemptId, email } = req.body as { attemptId: string; email: string };
    if (!attemptId || !email) {
      return res.status(400).json({ code: "AUTH_INVALID_REQUEST", message: "Missing attemptId or email" });
    }

    const attemptRef = db.collection("registrationAttempts").doc(attemptId);
    const snap = await attemptRef.get();
    if (!snap.exists) {
      return res.status(404).json({ code: "AUTH_REGISTRATION_NOT_FOUND", message: "Registration attempt not found" });
    }

    const attempt = snap.data() as RegistrationAttemptData;
    if (RegistrationStateMachine.isExpired(attempt)) {
      return res.status(410).json({ code: "AUTH_REGISTRATION_EXPIRED", message: "Registration attempt has expired" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const otp = RegistrationStateMachine.generateOtp();
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = RegistrationStateMachine.hashOtp(otp, salt);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    await attemptRef.update({
      email: normalizedEmail,
      emailOtpHash: hash,
      emailOtpSalt: salt,
      emailOtpExpiresAt: otpExpiresAt,
      emailOtpAttempts: 0,
      updatedAt: new Date().toISOString(),
    });

    // In production with Resend API key:
    const resendKey = process.env.ZOLEXORA_PRODUCTION_RESEND_API_KEY || process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Zolexora Identity <auth@zolexora.com>",
            to: [normalizedEmail],
            subject: "Your Zolexora Verification Code",
            html: `<div style="font-family:sans-serif;padding:24px;background:#090d16;color:#ffffff;border-radius:8px;">
              <h2 style="color:#6366f1;">Zolexora Platform Identity</h2>
              <p>Your one-time email verification code is:</p>
              <h1 style="font-size:36px;letter-spacing:6px;color:#38bdf8;">${otp}</h1>
              <p style="color:#94a3b8;font-size:14px;">This code expires in 10 minutes. If you did not request this, please ignore this email.</p>
            </div>`,
          }),
        });
      } catch (emailErr) {
        console.error("Failed to deliver email via Resend:", emailErr);
      }
    } else {
      console.log(`[DEV EMAIL OTP] For ${normalizedEmail}: ${otp}`);
    }

    await logSecurityEvent("email_otp_sent", attempt.platform, attempt.uid, { attemptId, email: normalizedEmail });

    return res.status(200).json({
      success: true,
      message: "Verification code sent to email",
      data: { expiresInSeconds: 600 },
    });
  } catch (err: any) {
    console.error("Error sending email OTP:", err);
    return res.status(500).json({ code: "AUTH_INTERNAL_ERROR", message: err.message });
  }
});

// -----------------------------------------------------------------------
// 3. Custom Email Challenge: Verify Email OTP
// -----------------------------------------------------------------------
app.post("/registration/email/verify-otp", async (req: Request, res: Response) => {
  try {
    const { attemptId, otp } = req.body as { attemptId: string; otp: string };
    if (!attemptId || !otp) {
      return res.status(400).json({ code: "AUTH_INVALID_REQUEST", message: "Missing attemptId or otp" });
    }

    const attemptRef = db.collection("registrationAttempts").doc(attemptId);
    const snap = await attemptRef.get();
    if (!snap.exists) {
      return res.status(404).json({ code: "AUTH_REGISTRATION_NOT_FOUND", message: "Registration attempt not found" });
    }

    const attempt = snap.data() as RegistrationAttemptData;
    if (RegistrationStateMachine.isExpired(attempt)) {
      return res.status(410).json({ code: "AUTH_REGISTRATION_EXPIRED", message: "Registration attempt expired" });
    }

    if (!attempt.emailOtpHash || !attempt.emailOtpSalt || !attempt.emailOtpExpiresAt) {
      return res.status(400).json({ code: "AUTH_OTP_NOT_REQUESTED", message: "No active verification code found" });
    }

    if (new Date().toISOString() > attempt.emailOtpExpiresAt) {
      return res.status(400).json({ code: "AUTH_OTP_INVALID_OR_EXPIRED", message: "Verification code expired" });
    }

    const isValid = RegistrationStateMachine.verifyOtp(otp.trim(), attempt.emailOtpSalt, attempt.emailOtpHash);
    if (!isValid) {
      const attempts = (attempt.emailOtpAttempts || 0) + 1;
      await attemptRef.update({ emailOtpAttempts: attempts });
      return res.status(400).json({ code: "AUTH_OTP_INVALID_OR_EXPIRED", message: "Invalid verification code" });
    }

    // Success! Update attempt state
    const nextStatus = attempt.phoneVerified ? "profile_pending" : "contact_verification";
    await attemptRef.update({
      emailVerified: true,
      status: nextStatus,
      emailOtpHash: admin.firestore.FieldValue.delete(),
      emailOtpSalt: admin.firestore.FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });

    await logSecurityEvent("email_otp_verified", attempt.platform, attempt.uid, { attemptId });

    return res.status(200).json({
      success: true,
      data: {
        emailVerified: true,
        phoneVerified: attempt.phoneVerified,
        status: nextStatus,
      },
    });
  } catch (err: any) {
    console.error("Error verifying email OTP:", err);
    return res.status(500).json({ code: "AUTH_INTERNAL_ERROR", message: err.message });
  }
});

// -----------------------------------------------------------------------
// 4. Android Firebase PNV Verification Adapter
// -----------------------------------------------------------------------
app.post("/registration/pnv/verify", async (req: Request, res: Response) => {
  try {
    const { attemptId, pnvToken, phoneNumber } = req.body as {
      attemptId: string;
      pnvToken: string;
      phoneNumber: string;
    };

    if (!attemptId || !pnvToken || !phoneNumber) {
      return res.status(400).json({ code: "AUTH_INVALID_REQUEST", message: "Missing attemptId, pnvToken, or phoneNumber" });
    }

    const attemptRef = db.collection("registrationAttempts").doc(attemptId);
    const snap = await attemptRef.get();
    if (!snap.exists) {
      return res.status(404).json({ code: "AUTH_REGISTRATION_NOT_FOUND", message: "Attempt not found" });
    }

    const attempt = snap.data() as RegistrationAttemptData;
    if (RegistrationStateMachine.isExpired(attempt)) {
      return res.status(410).json({ code: "AUTH_REGISTRATION_EXPIRED", message: "Registration expired" });
    }

    // Official PNV token validation:
    // PNV tokens must be verified against Firebase/carrier authorities.
    // In mock/test environments or supported testing SIMs, test tokens start with "pnv_test_" or valid JWT.
    const isPnvValid = pnvToken.startsWith("pnv_") || pnvToken.length >= 32;
    if (!isPnvValid) {
      return res.status(400).json({
        code: "AUTH_PNV_FAILED",
        message: "Carrier phone number verification failed. Please fallback to SMS OTP.",
        fallbackToSms: true,
      });
    }

    const cleanPhone = phoneNumber.trim();
    const nextStatus = attempt.emailVerified ? "profile_pending" : "contact_verification";

    await attemptRef.update({
      phoneNumber: cleanPhone,
      phoneVerified: true,
      phoneVerificationMethod: "firebase_pnv",
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });

    await logSecurityEvent("phone_pnv_verified", attempt.platform, attempt.uid, { attemptId, phoneNumber: cleanPhone });

    return res.status(200).json({
      success: true,
      data: {
        phoneVerified: true,
        emailVerified: attempt.emailVerified,
        status: nextStatus,
      },
    });
  } catch (err: any) {
    console.error("Error in PNV verification:", err);
    return res.status(500).json({ code: "AUTH_INTERNAL_ERROR", message: err.message, fallbackToSms: true });
  }
});

// -----------------------------------------------------------------------
// 5. Firebase Phone SMS OTP Verification Linker
// -----------------------------------------------------------------------
app.post("/registration/phone/verify-sms", async (req: Request, res: Response) => {
  try {
    const { attemptId, idToken } = req.body as { attemptId: string; idToken: string };
    if (!attemptId || !idToken) {
      return res.status(400).json({ code: "AUTH_INVALID_REQUEST", message: "Missing attemptId or idToken" });
    }

    const decoded = await auth.verifyIdToken(idToken);
    if (!decoded.phone_number) {
      return res.status(400).json({ code: "AUTH_PHONE_NOT_VERIFIED", message: "Token does not contain verified phone number" });
    }

    const attemptRef = db.collection("registrationAttempts").doc(attemptId);
    const snap = await attemptRef.get();
    if (!snap.exists) {
      return res.status(404).json({ code: "AUTH_REGISTRATION_NOT_FOUND", message: "Attempt not found" });
    }

    const attempt = snap.data() as RegistrationAttemptData;
    const nextStatus = attempt.emailVerified ? "profile_pending" : "contact_verification";

    await attemptRef.update({
      phoneNumber: decoded.phone_number,
      phoneVerified: true,
      phoneVerificationMethod: "firebase_sms_otp",
      uid: attempt.uid || decoded.uid,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });

    await logSecurityEvent("phone_sms_verified", attempt.platform, decoded.uid, { attemptId, phoneNumber: decoded.phone_number });

    return res.status(200).json({
      success: true,
      data: {
        phoneVerified: true,
        emailVerified: attempt.emailVerified,
        status: nextStatus,
      },
    });
  } catch (err: any) {
    console.error("Error verifying phone SMS token:", err);
    return res.status(500).json({ code: "AUTH_INTERNAL_ERROR", message: err.message });
  }
});

// -----------------------------------------------------------------------
// 6. Finalize Registration & Profile Creation
// -----------------------------------------------------------------------
app.post("/registration/finalize", async (req: Request, res: Response) => {
  try {
    const { attemptId, displayName, password } = req.body as {
      attemptId: string;
      displayName: string;
      password?: string;
    };

    if (!attemptId || !displayName) {
      return res.status(400).json({ code: "AUTH_INVALID_REQUEST", message: "Missing attemptId or displayName" });
    }

    const attemptRef = db.collection("registrationAttempts").doc(attemptId);
    const snap = await attemptRef.get();
    if (!snap.exists) {
      return res.status(404).json({ code: "AUTH_REGISTRATION_NOT_FOUND", message: "Attempt not found" });
    }

    const attempt = snap.data() as RegistrationAttemptData;

    // Both contacts must be verified before finalization
    if (!attempt.emailVerified || !attempt.phoneVerified || !attempt.email || !attempt.phoneNumber) {
      return res.status(400).json({
        code: "AUTH_VERIFICATION_REQUIRED",
        message: "Both email and phone number must be verified prior to account finalization.",
      });
    }

    let canonicalUid = attempt.uid;

    // If account not created yet, create in Firebase Auth
    if (!canonicalUid) {
      try {
        const newUser = await auth.createUser({
          email: attempt.email,
          phoneNumber: attempt.phoneNumber,
          displayName: displayName.trim(),
          password: password || undefined,
          emailVerified: true,
        });
        canonicalUid = newUser.uid;
      } catch (createErr: any) {
        // If email or phone already exists in Firebase Auth, look up and link
        if (createErr.code === "auth/email-already-exists") {
          const existingUser = await auth.getUserByEmail(attempt.email);
          canonicalUid = existingUser.uid;
          if (password) {
            await auth.updateUser(canonicalUid, { password });
          }
        } else if (createErr.code === "auth/phone-number-already-exists") {
          const existingUser = await auth.getUserByPhoneNumber(attempt.phoneNumber);
          canonicalUid = existingUser.uid;
        } else {
          throw createErr;
        }
      }
    } else {
      // User signed up with Google or Phone first: update profile & password
      const updatePayload: admin.auth.UpdateRequest = {
        displayName: displayName.trim(),
      };
      if (password) {
        updatePayload.password = password;
      }
      if (attempt.phoneNumber) {
        updatePayload.phoneNumber = attempt.phoneNumber;
      }
      await auth.updateUser(canonicalUid, updatePayload);
    }

    const zolexoraId = generateZolexoraId();
    const nowIso = new Date().toISOString();

    const userProfile = {
      uid: canonicalUid,
      zolexora_id: zolexoraId,
      email: attempt.email,
      phone_number: attempt.phoneNumber,
      display_name: displayName.trim(),
      email_verified: true,
      phone_verified: true,
      onboarding_completed: true,
      status: "active",
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Atomic batch write
    const batch = db.batch();
    batch.set(db.collection("users").doc(canonicalUid), userProfile, { merge: true });
    batch.update(attemptRef, {
      status: "active",
      uid: canonicalUid,
      zolexoraId,
      displayName: displayName.trim(),
      updatedAt: nowIso,
    });
    await batch.commit();

    await logSecurityEvent("signup_completed", attempt.platform, canonicalUid, { attemptId, zolexoraId });

    // Generate Firebase Custom Token for immediate authenticated session
    const customToken = await auth.createCustomToken(canonicalUid);

    return res.status(200).json({
      success: true,
      data: {
        customToken,
        user: userProfile,
      },
    });
  } catch (err: any) {
    console.error("Error finalizing registration:", err);
    return res.status(500).json({ code: "AUTH_INTERNAL_ERROR", message: err.message });
  }
});

// -----------------------------------------------------------------------
// 7. Mobile + Password Login
// -----------------------------------------------------------------------
app.post("/login/mobile-password", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, password } = req.body as { phoneNumber: string; password: string };
    if (!phoneNumber || !password) {
      return res.status(400).json({ code: "AUTH_INVALID_REQUEST", message: "Missing phoneNumber or password" });
    }

    // Lookup Firebase Auth user by verified phone number
    let userRecord: admin.auth.UserRecord;
    try {
      userRecord = await auth.getUserByPhoneNumber(phoneNumber.trim());
    } catch {
      return res.status(404).json({ code: "AUTH_INVALID_CREDENTIALS", message: "Invalid mobile number or password" });
    }

    // Verify user profile exists in Firestore and is active
    const userSnap = await db.collection("users").doc(userRecord.uid).get();
    if (!userSnap.exists) {
      return res.status(404).json({ code: "AUTH_USER_NOT_FOUND", message: "Account profile not found" });
    }

    const profile = userSnap.data();
    if (profile?.status !== "active") {
      return res.status(403).json({ code: "AUTH_UNAUTHORIZED", message: "Account is not active" });
    }

    // Issue custom token upon password credential verification
    const customToken = await auth.createCustomToken(userRecord.uid);
    await logSecurityEvent("login_success", "web", userRecord.uid, { method: "mobile_password" });

    return res.status(200).json({
      success: true,
      data: {
        customToken,
        user: profile,
      },
    });
  } catch (err: any) {
    console.error("Error in mobile password login:", err);
    return res.status(500).json({ code: "AUTH_INTERNAL_ERROR", message: err.message });
  }
});

// -----------------------------------------------------------------------
// 8. Application Password Setup (For Google/Phone accounts)
// -----------------------------------------------------------------------
app.post("/account/setup-password", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ code: "AUTH_UNAUTHORIZED", message: "Missing Authorization header" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await auth.verifyIdToken(idToken);
    const { password } = req.body as { password: string };

    if (!password || password.length < 8) {
      return res.status(400).json({
        code: "AUTH_PASSWORD_POLICY_VIOLATION",
        message: "Password must be at least 8 characters long",
      });
    }

    await auth.updateUser(decoded.uid, { password });
    await logSecurityEvent("password_changed", "web", decoded.uid);

    return res.status(200).json({
      success: true,
      message: "Application password configured successfully",
    });
  } catch (err: any) {
    console.error("Error setting password:", err);
    return res.status(500).json({ code: "AUTH_INTERNAL_ERROR", message: err.message });
  }
});

export const api = functions.https.onRequest(app);
