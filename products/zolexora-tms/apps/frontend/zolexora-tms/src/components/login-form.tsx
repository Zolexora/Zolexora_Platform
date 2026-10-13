import { ZolexoraSignIn } from "@zolexora/user-auth-firebase";

/**
 * Drop-in TMS Sign-In Form.
 * Directly consumes the centralized @zolexora/user-auth-firebase package.
 * Any updates to authentication flows, styles, providers, or security rules in
 * platform/Authentication/User Auth/Firebase automatically reflect here
 * without requiring changes to the TMS codebase.
 */
export function LoginForm() {
  return (
    <ZolexoraSignIn
      brandName="Zolexora TMS"
      brandTagline="Transport Management System & Logistics OS"
      theme="dark"
      requiresOrg={true}
      onboardingEndpoint="/api/v1/onboarding"
      redirectUrl="/dashboard"
    />
  );
}
