import SwiftUI

public struct AuthenticationView: View {
    @State private var selectedMode: AuthEntryMode = .select
    @State private var email: String = ""
    @State private var phone: String = ""
    @State private var password: String = ""
    @State private var displayName: String = ""
    @State private var otpCode: String = ""
    @State private var errorMessage: String?
    @State private var isBusy: Bool = false
    @State private var currentAttemptId: String?

    public init() {}

    public enum AuthEntryMode {
        case select
        case emailLogin
        case emailSignup
        case phoneLogin
        case phoneSignup
        case enterOtp
        case completeProfile
    }

    public var body: some View {
        NavigationView {
            ZStack {
                Color(red: 0.04, green: 0.07, blue: 0.12).ignoresSafeArea()

                VStack(spacing: 24) {
                    // Header Brand
                    VStack(spacing: 8) {
                        Image(systemName: "shield.checkered")
                            .font(.system(size: 48))
                            .foregroundColor(Color(red: 0.39, green: 0.40, blue: 0.95))

                        Text("Zolexora Platform")
                            .font(.title2.bold())
                            .foregroundColor(.white)

                        Text("Unified Platform Identity & Access")
                            .font(.subheadline)
                            .foregroundColor(Color.gray)
                    }
                    .padding(.top, 40)

                    if let error = errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                            .padding(.horizontal)
                            .multilineTextAlignment(.center)
                    }

                    // Mode: Select (3 Primary Options)
                    if selectedMode == .select {
                        VStack(spacing: 16) {
                            Button(action: handleGoogleSignIn) {
                                HStack(spacing: 12) {
                                    Image(systemName: "globe")
                                    Text("Continue with Google")
                                        .fontWeight(.semibold)
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 50)
                                .background(Color(red: 0.09, green: 0.13, blue: 0.22))
                                .foregroundColor(.white)
                                .cornerRadius(10)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.gray.opacity(0.3), lineWidth: 1))
                            }

                            Button(action: { selectedMode = .emailLogin; errorMessage = nil }) {
                                HStack(spacing: 12) {
                                    Image(systemName: "envelope.fill")
                                    Text("Continue with Email")
                                        .fontWeight(.semibold)
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 50)
                                .background(Color(red: 0.09, green: 0.13, blue: 0.22))
                                .foregroundColor(.white)
                                .cornerRadius(10)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.gray.opacity(0.3), lineWidth: 1))
                            }

                            Button(action: { selectedMode = .phoneLogin; errorMessage = nil }) {
                                HStack(spacing: 12) {
                                    Image(systemName: "phone.fill")
                                    Text("Continue with Mobile Number")
                                        .fontWeight(.semibold)
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 50)
                                .background(Color(red: 0.09, green: 0.13, blue: 0.22))
                                .foregroundColor(.white)
                                .cornerRadius(10)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.gray.opacity(0.3), lineWidth: 1))
                            }
                        }
                        .padding(.horizontal, 24)
                    }

                    // Email Login / Signup
                    if selectedMode == .emailLogin {
                        VStack(spacing: 16) {
                            TextField("Email address", text: $email)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                                .padding()
                                .background(Color(red: 0.02, green: 0.04, blue: 0.08))
                                .cornerRadius(8)
                                .foregroundColor(.white)

                            SecureField("Password", text: $password)
                                .padding()
                                .background(Color(red: 0.02, green: 0.04, blue: 0.08))
                                .cornerRadius(8)
                                .foregroundColor(.white)

                            Button(action: handleEmailLogin) {
                                Text("Sign In")
                                    .fontWeight(.bold)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 48)
                                    .background(Color(red: 0.39, green: 0.40, blue: 0.95))
                                    .foregroundColor(.white)
                                    .cornerRadius(8)
                            }

                            HStack {
                                Button("Create Account") { selectedMode = .emailSignup }
                                    .font(.footnote)
                                    .foregroundColor(Color.gray)
                                Spacer()
                                Button("Back") { selectedMode = .select }
                                    .font(.footnote)
                                    .foregroundColor(Color.gray)
                            }
                        }
                        .padding(.horizontal, 24)
                    }

                    // Mobile Login
                    if selectedMode == .phoneLogin {
                        VStack(spacing: 16) {
                            TextField("Mobile Number (+1... / +91...)", text: $phone)
                                .keyboardType(.phonePad)
                                .padding()
                                .background(Color(red: 0.02, green: 0.04, blue: 0.08))
                                .cornerRadius(8)
                                .foregroundColor(.white)

                            SecureField("Password", text: $password)
                                .padding()
                                .background(Color(red: 0.02, green: 0.04, blue: 0.08))
                                .cornerRadius(8)
                                .foregroundColor(.white)

                            Button(action: handlePhoneLogin) {
                                Text("Sign In with Mobile")
                                    .fontWeight(.bold)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 48)
                                    .background(Color(red: 0.39, green: 0.40, blue: 0.95))
                                    .foregroundColor(.white)
                                    .cornerRadius(8)
                            }

                            Button("Back") { selectedMode = .select }
                                .font(.footnote)
                                .foregroundColor(Color.gray)
                        }
                        .padding(.horizontal, 24)
                    }

                    Spacer()
                }
            }
            .navigationBarHidden(true)
        }
    }

    private func handleGoogleSignIn() {
        // Triggers Google Sign-In via FirebaseAuthManager
    }

    private func handleEmailLogin() {
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Please enter email and password"
            return
        }
        isBusy = true
        Task {
            let res = await FirebaseAuthManager.shared.signInWithEmail(email: email, password: password)
            isBusy = false
            switch res {
            case .success(let user):
                print("Logged in: \(user.zolexoraId)")
            case .pendingVerification(_, _, let msg):
                errorMessage = msg
            case .error(_, let msg):
                errorMessage = msg
            }
        }
    }

    private func handlePhoneLogin() {
        guard !phone.isEmpty, !password.isEmpty else {
            errorMessage = "Please enter mobile number and password"
            return
        }
        isBusy = true
        Task {
            let res = await FirebaseAuthManager.shared.signInWithMobilePassword(phoneNumber: phone, password: password)
            isBusy = false
            switch res {
            case .success(let user):
                print("Logged in: \(user.zolexoraId)")
            case .pendingVerification(_, _, let msg):
                errorMessage = msg
            case .error(_, let msg):
                errorMessage = msg
            }
        }
    }
}
