import { SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { MobileSignIn } from "@zolexora/marketplace-mobile-sign-in";

/** Sellers sign in with their Zolexora account (auth service, Track 1); seller access is checked by the API. */
export default function AuthScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FAFAF8" }}>
      <MobileSignIn brand="Zolexora Seller" accent="#FFB800" onSignedIn={() => router.replace("/")} />
    </SafeAreaView>
  );
}
