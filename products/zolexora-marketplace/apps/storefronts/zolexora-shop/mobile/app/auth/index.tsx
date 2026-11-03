import { SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { MobileSignIn } from "@zolexora/marketplace-mobile-sign-in";
import { useAuthStore } from "../../src/store";

/** Sign in with a Zolexora account (auth service, Track 1). */
export default function AuthScreen() {
  const router = useRouter();
  const { fetchMe } = useAuthStore();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FAFAF8" }}>
      <MobileSignIn brand="Zolexora Shop" accent="#C9A84C" onSignedIn={async () => { await fetchMe(); router.replace("/"); }} />
    </SafeAreaView>
  );
}
