/**
 * Login page for the Business Manager.
 *
 * Uses the Auth Service employee login flow (Track 2).
 * No password storage in Orbit — defers entirely to Auth Service.
 *
 * Flow:
 * 1. User enters their employee credentials.
 * 2. Auth Service responds with signed_in | choose_business | mfa_required.
 * 3. On success, session is stored and user is redirected to dashboard.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "../../store/auth.store.js";
import type {
  BusinessSession,
  EmployeeSignInResult,
} from "@zolexora/auth-client/business-session";
import { AuthServiceError } from "@zolexora/auth-client/business-session";

const AUTH_URL = import.meta.env.VITE_AUTH_SERVICE_URL ?? "";
const PRODUCT = import.meta.env.VITE_ORBIT_PRODUCT_ID ?? "orbit";

async function employeeSignIn(
  email: string,
  password: string,
): Promise<EmployeeSignInResult> {
  const res = await fetch(`${AUTH_URL}/api/v1/auth/employee/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, product: PRODUCT }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new AuthServiceError(
      data.message ?? "Sign-in failed",
      data.code ?? "SIGN_IN_FAILED",
      res.status,
    );
  }
  return data as EmployeeSignInResult;
}

async function openBusinessSession(
  loginTicket: string,
  orgId: string,
): Promise<BusinessSession> {
  const res = await fetch(`${AUTH_URL}/api/v1/auth/org-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login_ticket: loginTicket, org_id: orgId, product: PRODUCT }),
  });
  const data = await res.json();
  if (!res.ok) throw new AuthServiceError(data.message ?? "Failed", data.code ?? "SESSION_ERROR", res.status);
  return data as BusinessSession;
}

type Step = "credentials" | "choose_business" | "mfa";

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuthStore();
  const [step, setStep] = useState<Step>("credentials");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginTicket, setLoginTicket] = useState("");
  const [businesses, setBusinesses] = useState<
    { zolexora_org_id: string; name: string }[]
  >([]);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await employeeSignIn(email, password);
      if (result.status === "signed_in") {
        setSession(result.session);
        navigate("/dashboard");
      } else if (result.status === "choose_business") {
        setLoginTicket(result.login_ticket);
        setBusinesses(result.businesses);
        setStep("choose_business");
      } else if (result.status === "mfa_required") {
        setLoginTicket(result.mfa_ticket);
        setStep("mfa");
      }
    } catch (err) {
      toast.error(err instanceof AuthServiceError ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleChooseBusiness = async (orgId: string) => {
    setLoading(true);
    try {
      const session = await openBusinessSession(loginTicket, orgId);
      setSession(session);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err instanceof AuthServiceError ? err.message : "Failed to open session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-indigo-600 items-center justify-center text-white text-2xl font-bold shadow-lg mb-3">
            O
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Orbit</h1>
          <p className="text-sm text-slate-500 mt-1">Business Manager</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          {step === "credentials" && (
            <>
              <h2 className="text-lg font-semibold text-slate-900 mb-5">
                Sign in to your business
              </h2>
              <form onSubmit={handleCredentials} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Work email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </>
          )}

          {step === "choose_business" && (
            <>
              <h2 className="text-lg font-semibold text-slate-900 mb-1">
                Choose your business
              </h2>
              <p className="text-sm text-slate-500 mb-5">
                You belong to multiple businesses. Select one to continue.
              </p>
              <div className="space-y-2">
                {businesses.map((biz) => (
                  <button
                    key={biz.zolexora_org_id}
                    onClick={() => handleChooseBusiness(biz.zolexora_org_id)}
                    disabled={loading}
                    className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-colors disabled:opacity-60"
                  >
                    <p className="text-sm font-medium text-slate-900">{biz.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {biz.zolexora_org_id}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "mfa" && (
            <div className="text-center py-4">
              <p className="text-sm text-slate-600">
                MFA verification is handled by Zolexora Auth Service.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Ticket: {loginTicket.slice(0, 12)}…
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Zolexora Orbit — Powered by Aarambh Technologies
        </p>
      </div>
    </div>
  );
}
