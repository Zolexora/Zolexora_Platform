import { ZolexoraOnboarding } from "@zolexora/user-auth-firebase";

/**
 * Drop-in TMS Organization Onboarding Form.
 * Directly consumes the centralized @zolexora/user-auth-firebase package.
 * Any updates to organization onboarding flows, styles, or validation in
 * platform/Authentication/User Auth/Firebase automatically reflect here
 * without requiring changes to the TMS codebase.
 */
export function OnboardingForm() {
  return (
    <ZolexoraOnboarding
      brandName="Zolexora TMS"
      brandTagline="Complete Workspace Onboarding"
      theme="dark"
      requiresOrg={true}
      onboardingEndpoint="/api/v1/onboarding"
      redirectUrl="/dashboard"
    />
  );
}
