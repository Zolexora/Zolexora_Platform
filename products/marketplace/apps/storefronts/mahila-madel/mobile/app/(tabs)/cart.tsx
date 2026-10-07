import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet,
  ActivityIndicator, TextInput, ScrollView, Alert, Linking, Clipboard,
} from "react-native";
import { useRouter } from "expo-router";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, Coins, QrCode, CreditCard, CheckCircle, Copy, Smartphone } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { cartApi, coinsApi } from "../../src/lib/api";
import { useAuthStore, useCartStore } from "../../src/store";
import Toast from "react-native-toast-message";

type PayMethod = "razorpay" | "upi" | "coins";
type Step = "cart" | "address" | "payment" | "upi_pending" | "done";

interface Addr { name:string; phone:string; email:string; address:string; city:string; state:string; pincode:string; }

export default function CartScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { setCount } = useCartStore();
  const [items, setItems]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [coinBal, setCoinBal]       = useState(0);
  const [coinsToUse, setCoinsToUse] = useState(0);
  const [payMethod, setPayMethod]   = useState<PayMethod>("razorpay");
  const [busy, setBusy]             = useState(false);
  const [step, setStep]             = useState<Step>("cart");
  const [upiData, setUpiData]       = useState<any>(null);
  const [utr, setUtr]               = useState("");
  const [orderId, setOrderId]       = useState("");
  const [addr, setAddr] = useState<Addr>({ name:"", phone:"", email:"", address:"", city:"", state:"", pincode:"" });

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const [cartData, coinData] = await Promise.all([cartApi.get(), coinsApi.balance()]);
      setItems(cartData); setCount(cartData.length); setCoinBal(coinData.coin_balance);
    } catch {} finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    load();
    if (user) setAddr(a => ({ ...a, name:user.name||"", email:user.email||"" }));
  }, [user]);

  const subtotal     = items.reduce((s,i) => s + i.product.price * i.quantity, 0);
  const delivery     = subtotal >= 499 ? 0 : 49;
  const maxCoins     = Math.min(coinBal, Math.floor((subtotal * 0.5) / 0.01));
  const coinDiscount = parseFloat((coinsToUse * 0.01).toFixed(2));
  const total        = Math.max(0, subtotal - coinDiscount) + delivery;

  const updateQty = async (product_id: string, qty: number) => {
    try {
      await cartApi.update(product_id, qty);
      if (qty <= 0) { setItems(p => p.filter(i => i.product_id !== product_id)); setCount(items.length - 1); }
      else setItems(p => p.map(i => i.product_id === product_id ? { ...i, quantity:qty } : i));
    } catch {}
  };

  // ── Address validation ──────────────────────────────────────────────────────
  const proceedToPayment = () => {
    const req: Array<keyof Addr> = ["name","phone","email","address","city","state","pincode"];
    const miss = req.find(k => !addr[k].trim());
    if (miss) { Toast.show({ type:"error", text1:`Please fill in: ${miss}` }); return; }
    if (!/^[6-9]\d{9}$/.test(addr.phone)) { Toast.show({ type:"error", text1:"Enter valid 10-digit mobile number" }); return; }
    setStep("payment");
  };

  // ── Checkout ────────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    setBusy(true);
    try {
      const res = await cartApi.checkout({
        coins_to_use: coinsToUse,
        payment_method: payMethod,
        delivery_address: addr,
      });

      if (res.type === "coins") { setOrderId(res.order_id); setStep("done"); load(); return; }

      if (res.type === "upi") {
        setUpiData(res); setOrderId(res.order_id); setStep("upi_pending");
        // Try to open UPI deep-link on device
        Linking.canOpenURL(res.upi_link).then(can => { if (can) Linking.openURL(res.upi_link); });
        return;
      }

      if (res.type === "razorpay") {
        // Razorpay React Native SDK — install separately: @razorpay/razorpay-expo
        // For now, show the payment link / alert
        Alert.alert(
          "Complete Payment",
          `Pay ₹${res.amount} via Razorpay.\n\nOrder ID: ${res.razorpay_order_id}`,
          [{ text:"OK" }]
        );
        Toast.show({ type:"info", text1:"Open Razorpay to complete payment" });
        return;
      }

      setOrderId(res.order_id || ""); setStep("done"); load();
    } catch (e: any) {
      Toast.show({ type:"error", text1: e?.response?.data?.detail || "Checkout failed" });
    } finally { setBusy(false); }
  };

  // ── UPI UTR submit ──────────────────────────────────────────────────────────
  const submitUtr = async () => {
    if (!utr.trim() || utr.trim().length < 6) { Toast.show({ type:"error", text1:"Enter valid UTR / Transaction Reference" }); return; }
    setBusy(true);
    try {
      await cartApi.upiPaid(orderId, utr.trim());
      setStep("done"); load();
      Toast.show({ type:"success", text1:"Payment submitted!", text2:"Pending verification — usually a few hours" });
    } catch (e: any) {
      Toast.show({ type:"error", text1: e?.response?.data?.detail || "Failed to submit" });
    } finally { setBusy(false); }
  };

  if (!user) return (
    <View style={ss.centered}>
      <ShoppingBag size={48} color="#E0E0E0"/>
      <Text style={ss.emptyTitle}>Sign in to view cart</Text>
      <TouchableOpacity style={ss.primaryBtn} onPress={() => router.push("/auth")}><Text style={ss.primaryBtnText}>Sign In</Text></TouchableOpacity>
    </View>
  );

  if (loading) return <View style={ss.centered}><ActivityIndicator color="#FFB800" size="large"/></View>;

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (step === "done") return (
    <View style={ss.centered}>
      <View style={ss.successIcon}><CheckCircle size={40} color="#22C55E"/></View>
      <Text style={ss.successTitle}>{upiData ? "Payment Submitted!" : "Order Placed! 🎉"}</Text>
      <Text style={ss.successSub}>Order #{orderId.slice(0,8).toUpperCase()}</Text>
      {upiData && <Text style={ss.upiNote}>Your payment is pending verification. We'll confirm within a few hours.</Text>}
      <TouchableOpacity style={ss.primaryBtn} onPress={() => { setStep("cart"); setUpiData(null); setUtr(""); router.push("/(tabs)/orders"); }}>
        <Text style={ss.primaryBtnText}>View Orders</Text>
      </TouchableOpacity>
    </View>
  );

  // ── UPI PENDING ───────────────────────────────────────────────────────────
  if (step === "upi_pending" && upiData) return (
    <ScrollView style={ss.container} contentContainerStyle={{ padding:20 }} showsVerticalScrollIndicator={false}>
      <Text style={ss.pageTitle}>Pay via UPI</Text>
      <Text style={ss.pageSub}>Amount: <Text style={{ fontWeight:"900", color:"#111" }}>₹{upiData.amount?.toLocaleString("en-IN")}</Text></Text>

      <View style={ss.upiCard}>
        <Text style={ss.upiIdLabel}>UPI ID</Text>
        <View style={ss.upiIdRow}>
          <Text style={ss.upiId}>{upiData.upi_id}</Text>
          <TouchableOpacity onPress={() => { Clipboard.setString(upiData.upi_id); Toast.show({ type:"success", text1:"Copied!" }); }}>
            <Copy size={16} color="#999"/>
          </TouchableOpacity>
        </View>
        <Text style={ss.upiMerchant}>{upiData.merchant_name}</Text>
        <TouchableOpacity style={ss.openUpiBtn} onPress={() => Linking.openURL(upiData.upi_link)}>
          <Smartphone size={16} color="#111"/>
          <Text style={ss.openUpiBtnText}>Open UPI App (GPay / PhonePe / Paytm)</Text>
        </TouchableOpacity>
      </View>

      <View style={ss.instructBox}>
        <Text style={ss.instructTitle}>After paying:</Text>
        <Text style={ss.instructText}>1. Copy the UTR / Transaction Reference from your UPI app</Text>
        <Text style={ss.instructText}>2. Paste it below and tap "I have paid"</Text>
        <Text style={ss.instructText}>3. We'll verify and confirm your order within a few hours</Text>
      </View>

      <Text style={ss.fieldLabel}>UTR / Transaction Reference</Text>
      <TextInput value={utr} onChangeText={setUtr} placeholder="12-digit UTR (e.g. 415123456789)"
        placeholderTextColor="#CCC" style={ss.utrInput} keyboardType="number-pad"/>
      <Text style={ss.fieldHint}>Find this in your UPI app → Transaction History</Text>

      <TouchableOpacity style={[ss.primaryBtn, (!utr.trim()||busy) && ss.btnDisabled]} onPress={submitUtr} disabled={!utr.trim()||busy}>
        <Text style={ss.primaryBtnText}>{busy?"Submitting...":"I have paid — Submit UTR"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { setStep("cart"); setUpiData(null); setUtr(""); }} style={ss.backLink}>
        <Text style={ss.backLinkText}>← Back to cart</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ── PAYMENT ───────────────────────────────────────────────────────────────
  if (step === "payment") return (
    <ScrollView style={ss.container} contentContainerStyle={{ padding:20 }} showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={() => setStep("address")} style={ss.backLink}><Text style={ss.backLinkText}>← Back</Text></TouchableOpacity>
      <Text style={ss.pageTitle}>Payment Method</Text>

      <View style={{ gap:12, marginBottom:20 }}>
        {[
          { id:"razorpay", label:"Card / Net Banking", sub:"Visa, Mastercard, wallets via Razorpay", emoji:"💳" },
          { id:"upi",      label:"UPI / QR Code",      sub:"Pay directly — manual verify within hours", emoji:"📱" },
          ...(total===0 ? [{ id:"coins", label:"Pay with Coins", sub:"Your coins cover the full amount", emoji:"🪙" }] : []),
        ].map((opt: any) => (
          <TouchableOpacity key={opt.id} style={[ss.payOption, payMethod===opt.id && ss.payOptionActive]}
            onPress={() => setPayMethod(opt.id)}>
            <Text style={{ fontSize:24 }}>{opt.emoji}</Text>
            <View style={{ flex:1 }}>
              <Text style={ss.payLabel}>{opt.label}</Text>
              <Text style={ss.paySub}>{opt.sub}</Text>
            </View>
            <View style={[ss.radio, payMethod===opt.id && ss.radioActive]}/>
          </TouchableOpacity>
        ))}
      </View>

      {/* Coin discount */}
      {coinBal > 0 && payMethod !== "coins" && (
        <View style={ss.coinBox}>
          <Text style={ss.coinTitle}>💰 Use coins for discount ({coinBal} available)</Text>
          {[0, Math.min(50,maxCoins), Math.min(100,maxCoins), Math.min(200,maxCoins)]
            .filter((v,i,a) => a.indexOf(v)===i && v<=maxCoins).map(v => (
            <TouchableOpacity key={v} style={[ss.coinOpt, coinsToUse===v && ss.coinOptActive]} onPress={() => setCoinsToUse(v)}>
              <Text style={[ss.coinOptText, coinsToUse===v && ss.coinOptTextActive]}>
                {v===0 ? "No coins" : `${v} coins (-₹${(v*0.01).toFixed(0)})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Summary */}
      <View style={ss.summaryBox}>
        <View style={ss.summaryRow}><Text style={ss.summaryLabel}>Subtotal</Text><Text style={ss.summaryVal}>₹{subtotal.toLocaleString("en-IN")}</Text></View>
        {coinDiscount>0 && <View style={ss.summaryRow}><Text style={[ss.summaryLabel,{color:"#22C55E"}]}>Coin discount</Text><Text style={{color:"#22C55E",fontWeight:"700"}}>-₹{coinDiscount.toFixed(0)}</Text></View>}
        <View style={ss.summaryRow}><Text style={ss.summaryLabel}>Delivery</Text><Text style={[ss.summaryVal, delivery===0 && {color:"#22C55E"}]}>{delivery===0?"FREE":`₹${delivery}`}</Text></View>
        <View style={[ss.summaryRow,{borderTopWidth:1,borderTopColor:"#F0F0F0",paddingTop:10,marginTop:4}]}>
          <Text style={[ss.summaryLabel,{fontWeight:"800",color:"#111"}]}>Total</Text>
          <Text style={[ss.summaryVal,{fontWeight:"900",fontSize:18}]}>₹{total.toLocaleString("en-IN")}</Text>
        </View>
      </View>

      <TouchableOpacity style={[ss.primaryBtn, busy && ss.btnDisabled]} onPress={handleCheckout} disabled={busy}>
        <Text style={ss.primaryBtnText}>
          {busy ? "Processing..." :
           payMethod==="upi"      ? `Pay ₹${total.toLocaleString("en-IN")} via UPI` :
           payMethod==="razorpay" ? `Pay ₹${total.toLocaleString("en-IN")}` :
                                    "Place Order (Free)"}
        </Text>
      </TouchableOpacity>
      <View style={{ height:40 }}/>
    </ScrollView>
  );

  // ── ADDRESS ───────────────────────────────────────────────────────────────
  if (step === "address") {
    const F = ({ label, k, type="default", ph="" }: { label:string; k:keyof Addr; type?:any; ph?:string }) => (
      <View style={{ marginBottom:14 }}>
        <Text style={ss.fieldLabel}>{label}</Text>
        <TextInput value={addr[k]} onChangeText={v => setAddr(a=>({...a,[k]:v}))} placeholder={ph}
          placeholderTextColor="#CCC" keyboardType={type} style={ss.addrInput}/>
      </View>
    );
    return (
      <ScrollView style={ss.container} contentContainerStyle={{ padding:20 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => setStep("cart")} style={ss.backLink}><Text style={ss.backLinkText}>← Back</Text></TouchableOpacity>
        <Text style={ss.pageTitle}>Delivery Address</Text>
        <View style={ss.addrCard}>
          <View style={ss.addrRow}><View style={{flex:1}}><F label="Full Name *" k="name" ph="Your name"/></View><View style={{width:12}}/><View style={{flex:1}}><F label="Phone *" k="phone" type="phone-pad" ph="10-digit mobile"/></View></View>
          <F label="Email *" k="email" type="email-address" ph="you@email.com"/>
          <F label="Address *" k="address" ph="House no., Street, Area"/>
          <View style={ss.addrRow}><View style={{flex:1}}><F label="City *" k="city" ph="City"/></View><View style={{width:12}}/><View style={{flex:1}}><F label="State *" k="state" ph="State"/></View></View>
          <F label="Pincode *" k="pincode" type="number-pad" ph="6-digit"/>
        </View>
        <TouchableOpacity style={ss.primaryBtn} onPress={proceedToPayment}>
          <Text style={ss.primaryBtnText}>Continue to Payment</Text>
          <ArrowRight size={16} color="#111"/>
        </TouchableOpacity>
        <View style={{ height:40 }}/>
      </ScrollView>
    );
  }

  // ── CART ──────────────────────────────────────────────────────────────────
  if (items.length === 0) return (
    <View style={ss.centered}>
      <ShoppingBag size={48} color="#E0E0E0"/>
      <Text style={ss.emptyTitle}>Your cart is empty</Text>
      <TouchableOpacity style={ss.primaryBtn} onPress={() => router.push("/(tabs)/shop")}><Text style={ss.primaryBtnText}>Start Shopping</Text></TouchableOpacity>
    </View>
  );

  return (
    <View style={ss.container}>
      <View style={ss.header}><Text style={ss.title}>Cart</Text><Text style={ss.count}>{items.length} items</Text></View>
      <FlatList data={items} keyExtractor={i=>i.id} contentContainerStyle={{ padding:16, paddingBottom:220, gap:12 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index*50)} style={ss.cartItem}>
            <TouchableOpacity onPress={() => router.push(`/product/${item.product_id}`)}>
              {item.product?.images?.[0]
                ? <Image source={{ uri:item.product.images[0] }} style={ss.itemImg}/>
                : <View style={[ss.itemImg, {backgroundColor:"#F5F5F5",alignItems:"center",justifyContent:"center"}]}><Text>📦</Text></View>}
            </TouchableOpacity>
            <View style={ss.itemInfo}>
              <Text style={ss.itemTitle} numberOfLines={2}>{item.product?.title}</Text>
              <Text style={ss.itemPrice}>₹{item.product?.price?.toLocaleString("en-IN")}</Text>
              <View style={ss.qtyRow}>
                <TouchableOpacity style={ss.qtyBtn} onPress={() => updateQty(item.product_id, item.quantity-1)}><Minus size={13} color="#111"/></TouchableOpacity>
                <Text style={ss.qtyText}>{item.quantity}</Text>
                <TouchableOpacity style={ss.qtyBtn} onPress={() => updateQty(item.product_id, item.quantity+1)}><Plus size={13} color="#111"/></TouchableOpacity>
                <TouchableOpacity onPress={() => updateQty(item.product_id, 0)} style={{ marginLeft:"auto" }}><Trash2 size={15} color="#EF4444"/></TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}
        ListFooterComponent={
          <View style={{ gap:12, marginTop:8 }}>
            <View style={ss.summaryBox}>
              <View style={ss.summaryRow}><Text style={ss.summaryLabel}>Subtotal</Text><Text style={ss.summaryVal}>₹{subtotal.toLocaleString("en-IN")}</Text></View>
              <View style={ss.summaryRow}><Text style={ss.summaryLabel}>Delivery</Text><Text style={[ss.summaryVal, delivery===0&&{color:"#22C55E"}]}>{delivery===0?"FREE":`₹${delivery}`}</Text></View>
              <View style={[ss.summaryRow,{borderTopWidth:1,borderTopColor:"#F0F0F0",paddingTop:10,marginTop:4}]}>
                <Text style={[ss.summaryLabel,{fontWeight:"800",color:"#111"}]}>Estimated Total</Text>
                <Text style={[ss.summaryVal,{fontWeight:"900",fontSize:17}]}>₹{(subtotal+delivery).toLocaleString("en-IN")}</Text>
              </View>
            </View>
            <TouchableOpacity style={ss.primaryBtn} onPress={() => setStep("address")}><Text style={ss.primaryBtnText}>Checkout <ArrowRight size={16} color="#111"/></Text></TouchableOpacity>
            <View style={{ height:60 }}/>
          </View>
        }
      />
    </View>
  );
}

const ss = StyleSheet.create({
  container: { flex:1, backgroundColor:"#FAFAF8" },
  centered:  { flex:1, alignItems:"center", justifyContent:"center", gap:14, padding:24 },
  header:    { flexDirection:"row", alignItems:"baseline", gap:8, paddingHorizontal:20, paddingTop:56, paddingBottom:14, backgroundColor:"#fff", borderBottomWidth:1, borderBottomColor:"#F0F0F0" },
  title:     { fontSize:22, fontWeight:"900", color:"#111" },
  count:     { fontSize:13, color:"#AAA", fontWeight:"600" },
  pageTitle: { fontSize:22, fontWeight:"900", color:"#111", marginBottom:6 },
  pageSub:   { fontSize:14, color:"#888", marginBottom:20 },
  backLink:  { paddingVertical:8, marginBottom:4 },
  backLinkText:{ fontSize:14, fontWeight:"700", color:"#FFB800" },
  cartItem:  { flexDirection:"row", gap:12, backgroundColor:"#fff", borderRadius:18, padding:12 },
  itemImg:   { width:76, height:76, borderRadius:14, resizeMode:"cover" },
  itemInfo:  { flex:1, gap:4 },
  itemTitle: { fontSize:13, fontWeight:"700", color:"#111", lineHeight:17 },
  itemPrice: { fontSize:15, fontWeight:"900", color:"#111" },
  qtyRow:    { flexDirection:"row", alignItems:"center", gap:8 },
  qtyBtn:    { width:28, height:28, backgroundColor:"#F5F5F3", borderRadius:8, alignItems:"center", justifyContent:"center" },
  qtyText:   { fontSize:14, fontWeight:"800", color:"#111", minWidth:20, textAlign:"center" },
  summaryBox:{ backgroundColor:"#fff", borderRadius:18, padding:16, gap:8 },
  summaryRow:{ flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  summaryLabel:{ fontSize:13, color:"#888" },
  summaryVal:{ fontSize:13, fontWeight:"700", color:"#111" },
  primaryBtn:{ backgroundColor:"#FFB800", borderRadius:18, height:54, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8 },
  primaryBtnText:{ fontSize:15, fontWeight:"900", color:"#111" },
  btnDisabled:{ opacity:0.5 },
  emptyTitle:{ fontSize:16, fontWeight:"800", color:"#555" },
  payOption: { flexDirection:"row", alignItems:"center", gap:12, backgroundColor:"#fff", borderRadius:18, padding:14, borderWidth:2, borderColor:"#F0F0F0" },
  payOptionActive:{ borderColor:"#FFB800", backgroundColor:"#FFFBEB" },
  payLabel:  { fontSize:14, fontWeight:"700", color:"#111" },
  paySub:    { fontSize:11, color:"#888", marginTop:1 },
  radio:     { width:18, height:18, borderRadius:9, borderWidth:2, borderColor:"#DDD" },
  radioActive:{ backgroundColor:"#FFB800", borderColor:"#FFB800" },
  coinBox:   { backgroundColor:"#FFF8E1", borderRadius:18, padding:14, marginBottom:16, borderWidth:1.5, borderColor:"#FFE082" },
  coinTitle: { fontSize:13, fontWeight:"700", color:"#111", marginBottom:10 },
  coinOpt:   { paddingHorizontal:12, paddingVertical:7, borderRadius:20, backgroundColor:"#fff", borderWidth:1.5, borderColor:"#E0E0E0", marginBottom:6 },
  coinOptActive:{ backgroundColor:"#FFB800", borderColor:"#FFB800" },
  coinOptText:{ fontSize:12, fontWeight:"700", color:"#666" },
  coinOptTextActive:{ color:"#111" },
  upiCard:   { backgroundColor:"#fff", borderRadius:20, padding:20, gap:10, marginBottom:16, borderWidth:1.5, borderColor:"#F0F0F0" },
  upiIdLabel:{ fontSize:11, color:"#AAA", fontWeight:"700", textTransform:"uppercase" },
  upiIdRow:  { flexDirection:"row", alignItems:"center", gap:10 },
  upiId:     { flex:1, fontSize:18, fontWeight:"900", color:"#111", fontFamily:"monospace" },
  upiMerchant:{ fontSize:12, color:"#888" },
  openUpiBtn:{ flexDirection:"row", alignItems:"center", gap:8, backgroundColor:"#111", borderRadius:14, padding:14, justifyContent:"center" },
  openUpiBtnText:{ fontSize:13, fontWeight:"800", color:"#fff" },
  instructBox:{ backgroundColor:"#EFF6FF", borderRadius:16, padding:14, marginBottom:16 },
  instructTitle:{ fontSize:13, fontWeight:"800", color:"#1D4ED8", marginBottom:6 },
  instructText:{ fontSize:12, color:"#3B82F6", marginBottom:4 },
  fieldLabel:{ fontSize:11, fontWeight:"700", color:"#888", marginBottom:6, textTransform:"uppercase" },
  fieldHint: { fontSize:11, color:"#BBB", marginTop:4, marginBottom:16 },
  utrInput:  { backgroundColor:"#fff", borderRadius:14, paddingHorizontal:14, height:50, fontSize:16, fontFamily:"monospace", color:"#111", borderWidth:1.5, borderColor:"#F0F0F0" },
  addrCard:  { backgroundColor:"#fff", borderRadius:20, padding:16, marginBottom:16 },
  addrRow:   { flexDirection:"row" },
  addrInput: { backgroundColor:"#F5F5F3", borderRadius:12, paddingHorizontal:12, height:46, fontSize:14, color:"#111" },
  successIcon:{ width:80, height:80, backgroundColor:"#F0FDF4", borderRadius:40, alignItems:"center", justifyContent:"center" },
  successTitle:{ fontSize:22, fontWeight:"900", color:"#111" },
  successSub:{ fontSize:13, color:"#888" },
  upiNote:   { fontSize:12, color:"#D97706", backgroundColor:"#FFF7ED", borderRadius:12, padding:12, textAlign:"center", lineHeight:18 },
});
