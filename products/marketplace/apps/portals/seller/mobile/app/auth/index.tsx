import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react-native";
import { authApi } from "../../src/lib/api";
import { useAuthStore } from "../../src/store";
import Toast from "react-native-toast-message";

type Step = "login" | "register" | "forgot";

export default function SellerAuthScreen() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [step, setStep]     = useState<Step>("login");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [forgotEmail, setForgotEmail]   = useState("");
  const [forgotSent, setForgotSent]     = useState(false);
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await authApi.login({ email: form.email, password: form.password });
      if (res.user.role !== "seller" && res.user.role !== "admin") {
        Toast.show({ type:"error", text1:"Seller account required" }); return;
      }
      await login(res.user);
      router.replace("/(tabs)");
    } catch (e: any) { Toast.show({ type:"error", text1: e?.response?.data?.detail || "Login failed" }); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (form.password.length < 8) { Toast.show({ type:"error", text1:"Password must be ≥8 characters" }); return; }
    setLoading(true);
    try {
      await authApi.register(form);
      Toast.show({ type:"success", text1:"Verification code sent" });
    } catch (e: any) { Toast.show({ type:"error", text1: e?.response?.data?.detail || "Failed" }); }
    finally { setLoading(false); }
  };

  const handleForgot = async () => {
    if (!forgotEmail) { Toast.show({ type:"error", text1:"Enter your email" }); return; }
    setLoading(true);
    try {
      await authApi.forgotPassword(forgotEmail);
      setForgotSent(true);
    } catch { Toast.show({ type:"error", text1:"Something went wrong" }); }
    finally { setLoading(false); }
  };

  const ic = ss.input;

  return (
    <KeyboardAvoidingView style={ss.container} behavior={Platform.OS==="ios"?"padding":"height"}>
      <ScrollView contentContainerStyle={ss.scroll} keyboardShouldPersistTaps="handled">
        <View style={ss.logoBox}>
          <Image source={require("../../assets/icon.png")} style={ss.logoMark} resizeMode="contain" />
          <Text style={ss.logo}>Zolexora</Text>
          <Text style={ss.logoSub}>SELLER PORTAL</Text>
        </View>

        {step !== "forgot" && (
          <View style={ss.tabs}>
            {(["login","register"] as const).map(t => (
              <TouchableOpacity key={t} style={[ss.tab, step===t && ss.tabActive]} onPress={() => setStep(t)}>
                <Text style={[ss.tabText, step===t && ss.tabTextActive]}>{t==="login"?"Sign In":"Register"}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={ss.form}>
          {/* LOGIN */}
          {step === "login" && (<>
            <View style={ss.field}><Mail size={15} color="rgba(255,255,255,0.3)" style={ss.fi}/>
              <TextInput style={ic} value={form.email} onChangeText={set("email")} placeholder="Email" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="email-address" autoCapitalize="none"/></View>
            <View style={ss.field}><Lock size={15} color="rgba(255,255,255,0.3)" style={ss.fi}/>
              <TextInput style={ic} value={form.password} onChangeText={set("password")} placeholder="Password" placeholderTextColor="rgba(255,255,255,0.2)" secureTextEntry={!showPw}/>
              <TouchableOpacity onPress={() => setShowPw(!showPw)}>{showPw?<EyeOff size={15} color="rgba(255,255,255,0.3)"/>:<Eye size={15} color="rgba(255,255,255,0.3)"/>}</TouchableOpacity></View>
            <TouchableOpacity onPress={() => { setForgotEmail(form.email); setStep("forgot"); }}>
              <Text style={ss.forgotLink}>Forgot password?</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ss.btn} onPress={handleLogin} disabled={loading}>
              <Text style={ss.btnText}>{loading?"Signing in...":"Sign In"}</Text>
            </TouchableOpacity>
          </>)}

          {/* REGISTER */}
          {step === "register" && (<>
            <View style={ss.field}><User size={15} color="rgba(255,255,255,0.3)" style={ss.fi}/>
              <TextInput style={ic} value={form.name} onChangeText={set("name")} placeholder="Your name" placeholderTextColor="rgba(255,255,255,0.2)"/></View>
            <View style={ss.field}><Mail size={15} color="rgba(255,255,255,0.3)" style={ss.fi}/>
              <TextInput style={ic} value={form.email} onChangeText={set("email")} placeholder="Email" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="email-address" autoCapitalize="none"/></View>
            <View style={ss.field}><Lock size={15} color="rgba(255,255,255,0.3)" style={ss.fi}/>
              <TextInput style={ic} value={form.password} onChangeText={set("password")} placeholder="Password (min 8 chars + digit)" placeholderTextColor="rgba(255,255,255,0.2)" secureTextEntry={!showPw}/>
              <TouchableOpacity onPress={() => setShowPw(!showPw)}>{showPw?<EyeOff size={15} color="rgba(255,255,255,0.3)"/>:<Eye size={15} color="rgba(255,255,255,0.3)"/>}</TouchableOpacity></View>
            <TouchableOpacity style={ss.btn} onPress={handleRegister} disabled={loading}>
              <Text style={ss.btnText}>{loading?"Creating...":"Create Seller Account"}</Text>
            </TouchableOpacity>
          </>)}

          {/* FORGOT */}
          {step === "forgot" && (
            forgotSent ? (<>
              <View style={ss.successBox}>
                <Text style={ss.successTitle}>📬 Reset link sent!</Text>
                <Text style={ss.successSub}>Check <Text style={{color:"#FFB800"}}>{forgotEmail}</Text> for the reset link. Also check spam.</Text>
              </View>
              <TouchableOpacity style={ss.btn} onPress={() => { setStep("login"); setForgotSent(false); }}>
                <Text style={ss.btnText}>Back to Sign In</Text>
              </TouchableOpacity>
            </>) : (<>
              <Text style={ss.forgotDesc}>Enter your seller email to receive a password reset link.</Text>
              <View style={ss.field}><Mail size={15} color="rgba(255,255,255,0.3)" style={ss.fi}/>
                <TextInput style={ic} value={forgotEmail} onChangeText={setForgotEmail} placeholder="Seller email" placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="email-address" autoCapitalize="none"/></View>
              <TouchableOpacity style={ss.btn} onPress={handleForgot} disabled={loading}>
                <Text style={ss.btnText}>{loading?"Sending...":"Send Reset Link"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep("login")} style={ss.backBtn}>
                <Text style={ss.backText}>← Back to sign in</Text>
              </TouchableOpacity>
            </>)
          )}
        </View>
        <View style={{ height:60 }}/>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ss = StyleSheet.create({
  container:    { flex:1, backgroundColor:"#111" },
  scroll:       { flexGrow:1, paddingHorizontal:24, paddingTop:80 },
  logoBox:      { alignItems:"center", marginBottom:36 },
  logoMark:     { width:72, height:58, borderRadius:12, marginBottom:8 },
  logo:         { fontSize:32, fontWeight:"900", color:"#fff" },
  logoSub:      { fontSize:11, color:"rgba(255,255,255,0.3)", fontWeight:"700", letterSpacing:4, marginTop:4 },
  tabs:         { flexDirection:"row", backgroundColor:"rgba(255,255,255,0.06)", borderRadius:14, padding:3, marginBottom:20 },
  tab:          { flex:1, paddingVertical:10, borderRadius:12, alignItems:"center" },
  tabActive:    { backgroundColor:"rgba(255,255,255,0.1)" },
  tabText:      { fontSize:14, fontWeight:"700", color:"rgba(255,255,255,0.3)" },
  tabTextActive:{ color:"#fff" },
  googleBtn:    { height:50, backgroundColor:"rgba(255,255,255,0.08)", borderRadius:14, borderWidth:1, borderColor:"rgba(255,255,255,0.1)", alignItems:"center", justifyContent:"center", marginBottom:16 },
  googleText:   { fontSize:15, fontWeight:"700", color:"#fff" },
  divider:      { flexDirection:"row", alignItems:"center", gap:10, marginBottom:16 },
  divLine:      { flex:1, height:1, backgroundColor:"rgba(255,255,255,0.08)" },
  divText:      { fontSize:12, color:"rgba(255,255,255,0.2)", fontWeight:"600" },
  form:         { gap:14 },
  field:        { flexDirection:"row", alignItems:"center", backgroundColor:"rgba(255,255,255,0.06)", borderRadius:16, paddingHorizontal:14, height:52, borderWidth:1, borderColor:"rgba(255,255,255,0.08)" },
  fi:           { marginRight:10 },
  input:        { flex:1, fontSize:15, color:"#fff" },
  forgotLink:   { fontSize:13, color:"#FFB800", fontWeight:"700", textAlign:"right" },
  btn:          { backgroundColor:"#FFB800", borderRadius:18, height:54, alignItems:"center", justifyContent:"center", marginTop:4 },
  btnText:      { fontSize:16, fontWeight:"900", color:"#111" },
  backBtn:      { alignItems:"center", paddingVertical:8 },
  backText:     { fontSize:14, fontWeight:"700", color:"#FFB800" },
  forgotDesc:   { fontSize:13, color:"rgba(255,255,255,0.4)", textAlign:"center", lineHeight:20 },
  successBox:   { backgroundColor:"rgba(255,184,0,0.08)", borderRadius:18, padding:20, alignItems:"center", gap:8, borderWidth:1, borderColor:"rgba(255,184,0,0.15)" },
  successTitle: { fontSize:18, fontWeight:"900", color:"#fff" },
  successSub:   { fontSize:13, color:"rgba(255,255,255,0.5)", textAlign:"center", lineHeight:20 },
});
