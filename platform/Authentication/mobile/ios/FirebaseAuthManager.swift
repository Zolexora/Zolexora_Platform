import Foundation
import FirebaseAuth
import FirebaseFirestore

public struct AuthUser: Codable {
    public let uid: String
    public let zolexoraId: String
    public let email: String?
    public let phoneNumber: String?
    public let displayName: String?
    public let emailVerified: Bool
    public let phoneVerified: Bool
    public let onboardingCompleted: Bool
}

public enum AuthResult<T> {
    case success(T)
    case pendingVerification(attemptId: String, step: String, message: String)
    case error(code: String, message: String)
}

/**
 * iOS Native Firebase Unified Authentication Manager
 * Handles Google Sign-In, Firebase Phone Auth (SMS OTP), Email OTP, and Registration State Machine
 */
public class FirebaseAuthManager: NSObject {
    public static let shared = FirebaseAuthManager()

    private let auth = Auth.auth()
    private let db = Firestore.firestore()
    public var backendBaseUrl: String = "https://api.auth.zolexora.com"

    private override init() {
        super.init()
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 1. Google Sign-In
    // ────────────────────────────────────────────────────────────────────────────
    public func signInWithGoogle(idToken: String, accessToken: String) async -> AuthResult<AuthUser> {
        let credential = GoogleAuthProvider.credential(withIDToken: idToken, accessToken: accessToken)
        do {
            let authData = try await auth.signIn(with: credential)
            let user = authData.user

            // Check Firestore for completed profile
            let doc = try await db.collection("users").document(user.uid).getDocument()
            if doc.exists, let data = doc.data(), (data["onboarding_completed"] as? Bool) == true {
                let authUser = AuthUser(
                    uid: user.uid,
                    zolexoraId: data["zolexora_id"] as? String ?? "",
                    email: user.email,
                    phoneNumber: data["phone_number"] as? String ?? user.phoneNumber,
                    displayName: user.displayName,
                    emailVerified: user.isEmailVerified,
                    phoneVerified: data["phone_verified"] as? Bool ?? false,
                    onboardingCompleted: true
                )
                return .success(authUser)
            }

            // Start registration attempt bound to Google UID
            let startRes = try await postJson(endpoint: "/registration/start", body: [
                "signupMethod": "google",
                "platform": "ios",
                "email": user.email ?? "",
                "uid": user.uid
            ])

            if let attemptId = startRes["attemptId"] as? String {
                return .pendingVerification(
                    attemptId: attemptId,
                    step: "collect_phone",
                    message: "Please verify your mobile number to complete registration"
                )
            }
            return .error(code: "AUTH_START_FAILED", message: "Failed to initialize registration attempt")
        } catch {
            return .error(code: "AUTH_GOOGLE_ERROR", message: error.localizedDescription)
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 2. Email Sign-In & Password
    // ────────────────────────────────────────────────────────────────────────────
    public func signInWithEmail(email: String, password: String) async -> AuthResult<AuthUser> {
        do {
            let authData = try await auth.signIn(withEmail: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), password: password)
            let user = authData.user

            let doc = try await db.collection("users").document(user.uid).getDocument()
            let data = doc.data() ?? [:]
            let authUser = AuthUser(
                uid: user.uid,
                zolexoraId: data["zolexora_id"] as? String ?? "",
                email: user.email,
                phoneNumber: data["phone_number"] as? String ?? user.phoneNumber,
                displayName: user.displayName,
                emailVerified: user.isEmailVerified,
                phoneVerified: data["phone_verified"] as? Bool ?? false,
                onboardingCompleted: data["onboarding_completed"] as? Bool ?? true
            )
            return .success(authUser)
        } catch {
            return .error(code: "AUTH_INVALID_CREDENTIALS", message: error.localizedDescription)
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 3. iOS Native Firebase Phone Auth (SMS OTP)
    // ────────────────────────────────────────────────────────────────────────────
    public func startPhoneVerification(phoneNumber: String) async throws -> String {
        return try await PhoneAuthProvider.provider().verifyPhoneNumber(phoneNumber, uiDelegate: nil)
    }

    public func verifyPhoneCode(verificationID: String, verificationCode: String) async throws -> AuthDataResult {
        let credential = PhoneAuthProvider.provider().credential(withVerificationID: verificationID, verificationCode: verificationCode)
        return try await auth.signIn(with: credential)
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 4. Mobile + Password Login
    // ────────────────────────────────────────────────────────────────────────────
    public func signInWithMobilePassword(phoneNumber: String, password: String) async -> AuthResult<AuthUser> {
        do {
            let res = try await postJson(endpoint: "/login/mobile-password", body: [
                "phoneNumber": phoneNumber,
                "password": password
            ])

            guard let success = res["success"] as? Bool, success,
                  let data = res["data"] as? [String: Any],
                  let customToken = data["customToken"] as? String,
                  let userObj = data["user"] as? [String: Any] else {
                let msg = res["message"] as? String ?? "Mobile login failed"
                return .error(code: "AUTH_LOGIN_FAILED", message: msg)
            }

            let fbResult = try await auth.signIn(withCustomToken: customToken)
            let user = fbResult.user

            let authUser = AuthUser(
                uid: user.uid,
                zolexoraId: userObj["zolexora_id"] as? String ?? "",
                email: userObj["email"] as? String,
                phoneNumber: userObj["phone_number"] as? String,
                displayName: userObj["display_name"] as? String,
                emailVerified: true,
                phoneVerified: true,
                onboardingCompleted: true
            )
            return .success(authUser)
        } catch {
            return .error(code: "AUTH_MOBILE_LOGIN_ERROR", message: error.localizedDescription)
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 5. Registration State Machine Backend Calls
    // ────────────────────────────────────────────────────────────────────────────
    public func sendEmailOtp(attemptId: String, email: String) async throws -> [String: Any] {
        return try await postJson(endpoint: "/registration/email/send-otp", body: [
            "attemptId": attemptId,
            "email": email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        ])
    }

    public func verifyEmailOtp(attemptId: String, otp: String) async throws -> [String: Any] {
        return try await postJson(endpoint: "/registration/email/verify-otp", body: [
            "attemptId": attemptId,
            "otp": otp.trimmingCharacters(in: .whitespacesAndNewlines)
        ])
    }

    public func finalizeRegistration(attemptId: String, displayName: String, password: String? = nil) async -> AuthResult<AuthUser> {
        do {
            var body: [String: Any] = [
                "attemptId": attemptId,
                "displayName": displayName.trimmingCharacters(in: .whitespacesAndNewlines)
            ]
            if let pass = password { body["password"] = pass }

            let res = try await postJson(endpoint: "/registration/finalize", body: body)
            guard let success = res["success"] as? Bool, success,
                  let data = res["data"] as? [String: Any],
                  let customToken = data["customToken"] as? String,
                  let userObj = data["user"] as? [String: Any] else {
                let msg = res["message"] as? String ?? "Registration finalization failed"
                return .error(code: "AUTH_FINALIZE_FAILED", message: msg)
            }

            let fbResult = try await auth.signIn(withCustomToken: customToken)
            let user = fbResult.user

            let authUser = AuthUser(
                uid: user.uid,
                zolexoraId: userObj["zolexora_id"] as? String ?? "",
                email: userObj["email"] as? String,
                phoneNumber: userObj["phone_number"] as? String,
                displayName: displayName,
                emailVerified: true,
                phoneVerified: true,
                onboardingCompleted: true
            )
            return .success(authUser)
        } catch {
            return .error(code: "AUTH_FINALIZE_ERROR", message: error.localizedDescription)
        }
    }

    private func postJson(endpoint: String, body: [String: Any]) async throws -> [String: Any] {
        guard let url = URL(string: "\(backendBaseUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")))\(endpoint)") else {
            throw URLError(.badURL)
        }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: req)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        return json ?? [:]
    }
}
