package com.zolexora.auth

import android.app.Activity
import com.google.firebase.auth.AuthCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

data class AuthUser(
    val uid: String,
    val zolexoraId: String,
    val email: String?,
    val phoneNumber: String?,
    val displayName: String?,
    val emailVerified: Boolean,
    val phoneVerified: Boolean,
    val onboardingCompleted: Boolean
)

sealed class AuthResult<out T> {
    data class Success<T>(val data: T) : AuthResult<T>()
    data class PendingVerification(val attemptId: String, val step: String, val message: String) : AuthResult<Nothing>()
    data class Error(val code: String, val message: String) : AuthResult<Nothing>()
}

class FirebaseAuthRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val backendBaseUrl: String,
    private val httpClient: OkHttpClient = OkHttpClient()
) {

    // ────────────────────────────────────────────────────────────────────────────
    // 1. Google Sign-In & Onboarding Check
    // ────────────────────────────────────────────────────────────────────────────
    suspend fun signInWithGoogleCredential(idToken: String): AuthResult<AuthUser> = withContext(Dispatchers.IO) {
        try {
            val credential = GoogleAuthProvider.credential(idToken, null)
            val authResult = auth.signInWithCredential(credential).await()
            val firebaseUser = authResult.user ?: return@withContext AuthResult.Error("AUTH_FAILED", "Firebase user is null")

            // Check Firestore users collection for existing completed onboarding
            val userDoc = firestore.collection("users").document(firebaseUser.uid).get().await()
            if (userDoc.exists() && userDoc.getBoolean("onboarding_completed") == true) {
                val user = AuthUser(
                    uid = firebaseUser.uid,
                    zolexoraId = userDoc.getString("zolexora_id") ?: "",
                    email = firebaseUser.email,
                    phoneNumber = userDoc.getString("phone_number") ?: firebaseUser.phoneNumber,
                    displayName = firebaseUser.displayName,
                    emailVerified = firebaseUser.isEmailVerified,
                    phoneVerified = userDoc.getBoolean("phone_verified") ?: false,
                    onboardingCompleted = true
                )
                return@withContext AuthResult.Success(user)
            }

            // New or incomplete user: start registration attempt bound to this UID
            val startRes = startRegistrationAttempt(
                signupMethod = "google",
                platform = "android",
                email = firebaseUser.email,
                uid = firebaseUser.uid
            )

            AuthResult.PendingVerification(
                attemptId = startRes.optString("attemptId"),
                step = "collect_phone",
                message = "Please verify your mobile number to complete registration"
            )
        } catch (e: Exception) {
            AuthResult.Error("AUTH_GOOGLE_ERROR", e.message ?: "Google sign-in failed")
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 2. Email Login & Signup
    // ────────────────────────────────────────────────────────────────────────────
    suspend fun loginWithEmail(email: String, pass: String): AuthResult<AuthUser> = withContext(Dispatchers.IO) {
        try {
            val res = auth.signInWithEmailAndPassword(email.trim().toLowerCase(), pass).await()
            val fbUser = res.user ?: return@withContext AuthResult.Error("AUTH_FAILED", "User is null")

            val doc = firestore.collection("users").document(fbUser.uid).get().await()
            val user = AuthUser(
                uid = fbUser.uid,
                zolexoraId = doc.getString("zolexora_id") ?: "",
                email = fbUser.email,
                phoneNumber = doc.getString("phone_number") ?: fbUser.phoneNumber,
                displayName = fbUser.displayName,
                emailVerified = fbUser.isEmailVerified,
                phoneVerified = doc.getBoolean("phone_verified") ?: false,
                onboardingCompleted = doc.getBoolean("onboarding_completed") ?: true
            )
            AuthResult.Success(user)
        } catch (e: Exception) {
            AuthResult.Error("AUTH_INVALID_CREDENTIALS", e.message ?: "Invalid email or password")
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 3. Mobile + Password Login
    // ────────────────────────────────────────────────────────────────────────────
    suspend fun loginWithMobilePassword(phoneNumber: String, pass: String): AuthResult<AuthUser> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("phoneNumber", phoneNumber.trim())
                put("password", pass)
            }
            val request = Request.Builder()
                .url("${backendBaseUrl.trimEnd('/')}/login/mobile-password")
                .post(payload.toString().toRequestBody("application/json".toMediaType()))
                .build()

            val response = httpClient.newCall(request).execute()
            val body = response.body?.string() ?: ""
            val json = JSONObject(body)

            if (!response.isSuccessful || !json.optBoolean("success")) {
                return@withContext AuthResult.Error(
                    json.optString("code", "AUTH_LOGIN_FAILED"),
                    json.optString("message", "Login failed")
                )
            }

            val customToken = json.getJSONObject("data").getString("customToken")
            val fbAuthRes = auth.signInWithCustomToken(customToken).await()
            val fbUser = fbAuthRes.user ?: return@withContext AuthResult.Error("AUTH_FAILED", "Session token failed")

            val userObj = json.getJSONObject("data").getJSONObject("user")
            AuthResult.Success(
                AuthUser(
                    uid = fbUser.uid,
                    zolexoraId = userObj.optString("zolexora_id"),
                    email = userObj.optString("email"),
                    phoneNumber = userObj.optString("phone_number"),
                    displayName = userObj.optString("display_name"),
                    emailVerified = true,
                    phoneVerified = true,
                    onboardingCompleted = true
                )
            )
        } catch (e: Exception) {
            AuthResult.Error("AUTH_MOBILE_LOGIN_ERROR", e.message ?: "Mobile login failed")
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 4. Registration Backend State Machine Handlers
    // ────────────────────────────────────────────────────────────────────────────
    suspend fun startRegistrationAttempt(
        signupMethod: String,
        platform: String,
        email: String? = null,
        phoneNumber: String? = null,
        uid: String? = null
    ): JSONObject = withContext(Dispatchers.IO) {
        val payload = JSONObject().apply {
            put("signupMethod", signupMethod)
            put("platform", platform)
            if (email != null) put("email", email)
            if (phoneNumber != null) put("phoneNumber", phoneNumber)
            if (uid != null) put("uid", uid)
        }
        postJson("/registration/start", payload)
    }

    suspend fun sendEmailOtp(attemptId: String, email: String): JSONObject = withContext(Dispatchers.IO) {
        val payload = JSONObject().apply {
            put("attemptId", attemptId)
            put("email", email.trim().toLowerCase())
        }
        postJson("/registration/email/send-otp", payload)
    }

    suspend fun verifyEmailOtp(attemptId: String, otp: String): JSONObject = withContext(Dispatchers.IO) {
        val payload = JSONObject().apply {
            put("attemptId", attemptId)
            put("otp", otp.trim())
        }
        postJson("/registration/email/verify-otp", payload)
    }

    suspend fun finalizeRegistration(
        attemptId: String,
        displayName: String,
        password: String? = null
    ): AuthResult<AuthUser> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("attemptId", attemptId)
                put("displayName", displayName.trim())
                if (password != null) put("password", password)
            }
            val json = postJson("/registration/finalize", payload)
            if (!json.optBoolean("success")) {
                return@withContext AuthResult.Error(
                    json.optString("code", "AUTH_FINALIZE_FAILED"),
                    json.optString("message", "Finalization failed")
                )
            }

            val data = json.getJSONObject("data")
            val customToken = data.getString("customToken")
            val fbAuthRes = auth.signInWithCustomToken(customToken).await()
            val fbUser = fbAuthRes.user ?: return@withContext AuthResult.Error("AUTH_FAILED", "Session token failed")
            val userJson = data.getJSONObject("user")

            AuthResult.Success(
                AuthUser(
                    uid = fbUser.uid,
                    zolexoraId = userJson.getString("zolexora_id"),
                    email = userJson.optString("email"),
                    phoneNumber = userJson.optString("phone_number"),
                    displayName = displayName.trim(),
                    emailVerified = true,
                    phoneVerified = true,
                    onboardingCompleted = true
                )
            )
        } catch (e: Exception) {
            AuthResult.Error("AUTH_FINALIZE_ERROR", e.message ?: "Failed to finalize registration")
        }
    }

    private fun postJson(endpoint: String, payload: JSONObject): JSONObject {
        val request = Request.Builder()
            .url("${backendBaseUrl.trimEnd('/')}$endpoint")
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
            .build()

        val response = httpClient.newCall(request).execute()
        val body = response.body?.string() ?: "{}"
        return JSONObject(body)
    }
}
