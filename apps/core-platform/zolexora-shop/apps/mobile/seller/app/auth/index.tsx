import { useState } from "react";
import { SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { MobileSignIn, MobileStaffSignIn, setActiveOrganizationId } from "@zolexora/shop-mobile-sign-in";

/** Like TMS: owners use their Zolexora account (Track 1) and then choose or create an
 *  organisation; staff sign in to their organisation with its ZX-ORG id (Track 2). */
export default function AuthScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<"owner" | "staff">("owner");
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FAFAF8" }}>
      <View style={{ flexDirection: "row", margin: 16, marginBottom: 0, padding: 4, borderRadius: 10, backgroundColor: "#F3F4F6" }}>
        {([["owner", "Business owner"], ["staff", "Staff"]] as const).map(([key, label]) => (
          <TouchableOpacity key={key} onPress={() => setTab(key)}
            style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: "center", backgroundColor: tab === key ? "#fff" : "transparent" }}>
            <Text style={{ fontWeight: "700", color: tab === key ? "#111827" : "#6B7280" }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === "owner"
        ? <MobileSignIn brand="Zolexora Seller" accent="#FFB800" onSignedIn={() => router.replace("/organisations")} />
        : <MobileStaffSignIn brand="Zolexora Seller" accent="#FFB800"
            onSignedIn={() => void setActiveOrganizationId(null).then(() => router.replace("/"))} />}
    </SafeAreaView>
  );
}
