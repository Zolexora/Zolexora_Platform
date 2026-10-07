import { getApiClient } from "./client";
import type { AuthResponse, LoginRequest, RegisterRequest, User } from "./types";

export const auth = {
  register:       (data: RegisterRequest)                         => getApiClient().post("/auth/register", data).then(r => r.data),
  resendOtp:      (email: string)                                 => getApiClient().post("/auth/resend-otp", { email }).then(r => r.data),
  verifyOtp:      (email: string, otp: string)                    => getApiClient().post<AuthResponse>("/auth/verify-register", { email, otp }).then(r => r.data),
  login:          (data: LoginRequest)                            => getApiClient().post<AuthResponse>("/auth/login", data).then(r => r.data),
  forgotPassword: (email: string)                                => getApiClient().post("/auth/forgot-password", { email }).then(r => r.data),
  resetPassword:  (token: string, new_password: string)          => getApiClient().post("/auth/reset-password", { token, new_password }).then(r => r.data),
  firebase:       (id_token: string, registration_name?: string) => getApiClient().post<AuthResponse>("/auth/firebase", { id_token, registration_name }).then(r => r.data),
  me:             ()                                             => getApiClient().get<User>("/auth/me").then(r => r.data),
  logout:         ()                                             => getApiClient().post("/auth/logout").then(r => r.data),
};

// Legacy named exports for backward compatibility
export const register       = auth.register;
export const verifyRegister = (email: string, otp: string) => auth.verifyOtp(email, otp);
export const resendOtp      = auth.resendOtp;
export const login          = auth.login;
export const getMe          = auth.me;
export const logout         = auth.logout;
