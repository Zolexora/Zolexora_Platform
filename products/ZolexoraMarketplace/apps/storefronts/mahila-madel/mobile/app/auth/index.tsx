import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { authApi } from "../../src/lib/api";
import { useAuthStore } from "../../src/store";
import Toast from "react-native-toast-message";


type Step = "login" | "register" | "forgot";

export default function AuthScreen() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [step, setStep]       = useState<Step>("login");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [forgotEmail, setForgotEmail]   = useState("");
  const [forgotSent, setForgotSent]     = useState(false);
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleLogin = async () => {
    if (!form.email || !form.password) { Toast.show({ type:"error", text1:"Fill all fields" }); return; }
    setLoading(true);
    try {
      const res = await authApi.login(form.email, form.password);
      await login(res.session_token, res.user);
      Toast.show({ type:"success", text1:`Welcome back, ${res.user.name}!` });
      router.back();
    } catch (e: any) { Toast.show({ type:"error", text1: e?.response?.data?.detail || "Login failed" }); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password) { Toast.show({ type:"error", text1:"Fill all fields" }); return; }
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
    <KeyboardAvoidingView style={ss.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={ss.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInUp.duration(500)} style={ss.logoBox}>
          <Image source={require("../../assets/icon.png")} style={ss.logoMark} resizeMode="contain" />
          <Text style={ss.logo}>Mahila Madel</Text>
          <Text style={ss.logoSub}>
            {step === "forgot" ? "Reset password" :
             step === "register" ? "Create account" : "Welcome back"}
          </Text>
        </Animated.View>

        {/* Tab switcher */}
        {step !== "forgot" && (
          <Animated.View entering={FadeInDown.delay(80)} style={ss.tabs}>
            {(["login","register"] as const).map(t => (
              <TouchableOpacity key={t} style={[ss.tab, step===t && ss.tabActive]} onPress={() => setStep(t)}>
                <Text style={[ss.tabText, step===t && ss.tabTextActive]}>{t==="login"?"Sign In":"Register"}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(150)} style={ss.form}>

          {/* LOGIN */}
          {step === "login" && (
            <>
              <View style={ss.field}><Mail size={16} color="#AAA" style={ss.icon}/>
                <TextInput style={ic} value={form.email} onChangeText={set("email")} placeholder="Email" placeholderTextColor="#CCC" keyboardType="email-address" autoCapitalize="none"/></View>
              <View style={ss.field}><Lock size={16} color="#AAA" style={ss.icon}/>
                <TextInput style={ic} value={form.password} onChangeText={set("password")} placeholder="Password" placeholderTextColor="#CCC" secureTextEntry={!showPw}/>
                <TouchableOpacity onPress={() => setShowPw(!showPw)}>{showPw?<EyeOff size={16} color="#AAA"/>:<Eye size={16} color="#AAA"/>}</TouchableOpacity></View>
              <TouchableOpacity onPress={() => { setForgotEmail(form.email); setStep("forgot"); }}>
                <Text style={ss.forgotLink}>Forgot password?</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ss.btn} onPress={handleLogin} disabled={loading}>
                <Text style={ss.btnText}>{loading ? "Signing in..." : "Sign In"}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* REGISTER */}
          {step === "register" && (
            <>
              <View style={ss.field}><User size={16} color="#AAA" style={ss.icon}/>
                <TextInput style={ic} value={form.name} onChangeText={set("name")} placeholder="Full name" placeholderTextColor="#CCC"/></View>
              <View style={ss.field}><Mail size={16} color="#AAA" style={ss.icon}/>
                <TextInput style={ic} value={form.email} onChangeText={set("email")} placeholder="Email" placeholderTextColor="#CCC" keyboardType="email-address" autoCapitalize="none"/></View>
              <View style={ss.field}><Lock size={16} color="#AAA" style={ss.icon}/>
                <TextInput style={ic} value={form.password} onChangeText={set("password")} placeholder="Password (min 8 chars + digit)" placeholderTextColor="#CCC" secureTextEntry={!showPw}/>
                <TouchableOpacity onPress={() => setShowPw(!showPw)}>{showPw?<EyeOff size={16} color="#AAA"/>:<Eye size={16} color="#AAA"/>}</TouchableOpacity></View>
              <TouchableOpacity style={ss.btn} onPress={handleRegister} disabled={loading}>
                <Text style={ss.btnText}>{loading ? "Creating..." : "Create Account"}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* FORGOT PASSWORD */}
          {step === "forgot" && (
            forgotSent ? (
              <>
                <View style={ss.successBox}>
                  <Text style={ss.successTitle}>📬 Check your inbox</Text>
                  <Text style={ss.successSub}>A password reset link was sent to{"\n"}<Text style={{ fontWeight:"800" }}>{forgotEmail}</Text></Text>
                  <Text style={ss.successSub}>Also check your spam folder.</Text>
                </View>
                <TouchableOpacity style={ss.btn} onPress={() => { setStep("login"); setForgotSent(false); }}>
                  <Text style={ss.btnText}>Back to Sign In</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={ss.forgotDesc}>Enter your email and we'll send a password reset link.</Text>
                <View style={ss.field}><Mail size={16} color="#AAA" style={ss.icon}/>
                  <TextInput style={ic} value={forgotEmail} onChangeText={setForgotEmail} placeholder="Email address" placeholderTextColor="#CCC" keyboardType="email-address" autoCapitalize="none"/></View>
                <TouchableOpacity style={ss.btn} onPress={handleForgot} disabled={loading}>
                  <Text style={ss.btnText}>{loading ? "Sending..." : "Send Reset Link"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStep("login")} style={ss.resendBtn}>
                  <Text style={ss.resendText}>← Back to sign in</Text>
                </TouchableOpacity>
              </>
            )
          )}
        </Animated.View>
        <View style={{ height:40 }}/>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ss = StyleSheet.create({
  container:     { flex:1, backgroundColor:"#FAFAF8" },
  scroll:        { flexGrow:1, paddingHorizontal:24, paddingTop:60 },
  logoBox:       { alignItems:"center", marginBottom:32 },
  logoMark:      { width:72, height:58, borderRadius:12, marginBottom:8 },
  logo:          { fontSize:32, fontWeight:"900", color:"#111" },
  logoSub:       { fontSize:14, color:"#888", marginTop:4 },
  tabs:          { flexDirection:"row", backgroundColor:"#F0F0F0", borderRadius:14, padding:3, marginBottom:24 },
  tab:           { flex:1, paddingVertical:10, borderRadius:12, alignItems:"center" },
  tabActive:     { backgroundColor:"#fff" },
  tabText:       { fontSize:14, fontWeight:"700", color:"#888" },
  tabTextActive: { color:"#111" },
  form:          { gap:14 },
  googleBtn:     { height:50, backgroundColor:"#fff", borderRadius:16, borderWidth:1.5, borderColor:"#E0E0E0", alignItems:"center", justifyContent:"center" },
  googleText:    { fontSize:15, fontWeight:"700", color:"#111" },
  divider:       { flexDirection:"row", alignItems:"center", gap:10 },
  divLine:       { flex:1, height:1, backgroundColor:"#E8E8E8" },
  divText:       { fontSize:12, color:"#BBB", fontWeight:"600" },
  field:         { flexDirection:"row", alignItems:"center", backgroundColor:"#fff", borderRadius:16, paddingHorizontal:14, height:52, borderWidth:1.5, borderColor:"#F0F0F0" },
  icon:          { marginRight:10 },
  input:         { flex:1, fontSize:15, color:"#111" },
  forgotLink:    { fontSize:13, color:"#FFB800", fontWeight:"700", textAlign:"right" },
  roleRow:       { flexDirection:"row", gap:12 },
  roleBtn:       { flex:1, paddingVertical:12, borderRadius:16, backgroundColor:"#fff", borderWidth:2, borderColor:"#F0F0F0", alignItems:"center" },
  roleBtnActive: { borderColor:"#FFB800", backgroundColor:"#FFFBEB" },
  roleText:      { fontSize:13, fontWeight:"700", color:"#888" },
  roleTextActive:{ color:"#111" },
  btn:           { backgroundColor:"#FFB800", borderRadius:18, height:54, alignItems:"center", justifyContent:"center", marginTop:4 },
  btnText:       { fontSize:16, fontWeight:"900", color:"#111" },
  resendBtn:     { alignItems:"center", paddingVertical:8 },
  resendText:    { fontSize:14, fontWeight:"700", color:"#FFB800" },
  forgotDesc:    { fontSize:14, color:"#888", textAlign:"center", lineHeight:20 },
  successBox:    { backgroundColor:"#F0FDF4", borderRadius:18, padding:20, alignItems:"center", gap:8 },
  successTitle:  { fontSize:18, fontWeight:"900", color:"#111" },
  successSub:    { fontSize:13, color:"#555", textAlign:"center", lineHeight:20 },
});
