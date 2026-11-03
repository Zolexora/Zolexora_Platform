import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { setActiveOrganizationId } from "@zolexora/marketplace-mobile-sign-in";
import { authApi, sellerOrgApi } from "../../src/lib/api";
import { useAuthStore } from "../../src/store";

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);

/** Owners choose one of their seller organisations or create another (like TMS). */
export default function OrganisationsScreen() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [orgs, setOrgs] = useState<any[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const me = await authApi.me();
    if (me.zolexora_org_id) { router.replace("/"); return; } // staff: their linked organisation
    const mine = await sellerOrgApi.listMy();
    setOrgs(mine);
    setCreating(mine.length === 0);
  };
  useEffect(() => { load().catch(() => router.replace("/auth")); }, []);

  const open = async (org: any) => {
    if (org.status !== "ACTIVE") { setMessage(`${org.name} is awaiting verification. Complete it on the seller website.`); return; }
    await setActiveOrganizationId(org.id);
    router.replace("/");
  };
  const create = async () => {
    setBusy(true); setMessage(null);
    try {
      const org = await sellerOrgApi.create({ name: name.trim(), slug: slugify(name) || `seller-${Date.now()}` });
      await setActiveOrganizationId(org.id);
      setName("");
      await load();
      setMessage("Organisation created. Complete business verification on the seller website to start selling.");
    } catch (e: any) {
      setMessage(e?.response?.data?.detail || "Could not create the organisation.");
    } finally { setBusy(false); }
  };

  if (!orgs) return <SafeAreaView style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></SafeAreaView>;
  const btn = { borderRadius: 10, padding: 14, alignItems: "center" as const, marginTop: 10 };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FAFAF8" }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", textAlign: "center" }}>
          {creating ? (orgs.length ? "Create another organisation" : "Create your organisation") : "Choose an organisation"}
        </Text>
        {message && <Text style={{ color: "#374151", fontSize: 13, marginTop: 12 }}>{message}</Text>}
        {creating ? <>
          <TextInput value={name} onChangeText={setName} placeholder="Business name"
            style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, marginTop: 20, backgroundColor: "#fff" }} />
          <TouchableOpacity disabled={busy || name.trim().length < 2} onPress={create}
            style={{ ...btn, backgroundColor: "#FFB800", opacity: busy || name.trim().length < 2 ? 0.6 : 1 }}>
            <Text style={{ fontWeight: "700" }}>{busy ? "Creating…" : "Create organisation"}</Text>
          </TouchableOpacity>
          {orgs.length > 0 && <TouchableOpacity onPress={() => setCreating(false)} style={btn}><Text>Back to my organisations</Text></TouchableOpacity>}
        </> : <>
          {orgs.map((org) => (
            <TouchableOpacity key={org.id} onPress={() => void open(org)}
              style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, marginTop: 12, backgroundColor: "#fff" }}>
              <Text style={{ fontWeight: "700" }}>{org.name}</Text>
              <Text style={{ fontSize: 12, color: "#6B7280" }}>{org.status === "ACTIVE" ? "Active" : `Verification: ${org.verification_status}`}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setCreating(true)} style={{ ...btn, borderWidth: 1, borderColor: "#D1D5DB" }}>
            <Text style={{ fontWeight: "700" }}>+ Create another organisation</Text>
          </TouchableOpacity>
        </>}
        <TouchableOpacity onPress={() => void logout().then(() => router.replace("/auth"))} style={btn}>
          <Text style={{ color: "#6B7280", textDecorationLine: "underline" }}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
