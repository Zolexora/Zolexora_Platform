"use client";
import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/lib/api";
import { Search, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

const PAY_CLS:Record<string,string> = {
  paid:"bg-green-50 text-green-700", awaiting_verification:"bg-amber-50 text-amber-700",
  pending:"bg-gray-100 text-gray-600", failed:"bg-red-50 text-red-600",
};
const PAY_LABEL:Record<string,string> = {
  paid:"Paid", awaiting_verification:"⏳ Verify", pending:"Pending", failed:"Failed",
};
const STS_CLS:Record<string,string> = {
  pending:"bg-amber-50 text-amber-700", processing:"bg-blue-50 text-blue-700",
  shipped:"bg-purple-50 text-purple-700", delivered:"bg-green-50 text-green-700",
  cancelled:"bg-red-50 text-red-600",
};

function VerifyModal({order,onClose,onDone}:{order:any;onClose:()=>void;onDone:()=>void}) {
  const [busy,setBusy]=useState(false);
  const [note,setNote]=useState("");
  const act=async(approve:boolean)=>{
    setBusy(true);
    try{await adminApi.verifyUpi(order.id,approve,note||undefined);toast.success(approve?"✅ Approved!":"❌ Rejected");onDone();}
    catch(e:any){toast.error(e?.response?.data?.detail||"Failed");}
    finally{setBusy(false);}
  };
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><Clock size={18} className="text-amber-600"/></div>
          <div><h2 className="font-bold text-base">Verify UPI Payment</h2><p className="text-xs text-gray-500">Order #{order.id.slice(0,8).toUpperCase()}</p></div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-4">
          {[["Buyer",order.buyer_name],["Amount",`₹${order.total_paid?.toLocaleString("en-IN")}`],["UTR / Ref",order.upi_transaction_ref||"—"],["Items",`${order.items?.length} item(s)`]].map(([l,v])=>(
            <div key={l} className="flex justify-between"><span className="text-gray-500">{l}</span><span className="font-semibold text-right">{v}</span></div>
          ))}
        </div>
        <div className="bg-blue-50 rounded-xl p-3 mb-4 text-xs text-blue-800">
          <p className="font-semibold mb-1">How to verify:</p>
          <p>Check your UPI app / bank — confirm ₹{order.total_paid?.toLocaleString("en-IN")} received with UTR <code className="font-mono bg-blue-100 px-1 rounded">{order.upi_transaction_ref}</code></p>
        </div>
        <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Admin note (optional)" rows={2}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-gold mb-4"/>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={()=>act(false)} disabled={busy} className="h-11 rounded-xl border-2 border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2"><XCircle size={16}/>Reject</button>
          <button onClick={()=>act(true)}  disabled={busy} className="h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"><CheckCircle size={16}/>Approve</button>
        </div>
        <button onClick={onClose} className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600 py-1">Cancel</button>
      </motion.div>
    </div>
  );
}

export default function AdminOrdersPage() {
  const [allOrders,setAll]=useState<any[]>([]);
  const [pendingUpi,setPending]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [tab,setTab]=useState<"all"|"upi">("all");
  const [verifyOrder,setVerify]=useState<any>(null);
  const [spinning,setSpinning]=useState(false);

  const load=useCallback(async(silent=false)=>{
    if(!silent)setLoading(true); else setSpinning(true);
    try{const[a,u]=await Promise.all([adminApi.orders(),adminApi.pendingUpi()]);setAll(a);setPending(u);}
    catch{toast.error("Failed to load orders");}
    finally{setLoading(false);setSpinning(false);}
  },[]);

  useEffect(()=>{load();},[]);

  const orders=(tab==="upi"?pendingUpi:allOrders).filter(o=>{
    if(!search)return true;
    return o.buyer_name?.toLowerCase().includes(search.toLowerCase())||
           o.id?.toLowerCase().includes(search.toLowerCase())||
           o.upi_transaction_ref?.toLowerCase().includes(search.toLowerCase());
  });

  const totalRev=allOrders.filter(o=>o.payment_status==="paid").reduce((s,o)=>s+(o.total_paid||0),0);

  return(
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div><h1 className="font-display text-2xl font-bold text-ink">Orders</h1>
          <p className="text-ink-muted text-sm mt-0.5">{allOrders.length} total · ₹{totalRev.toLocaleString("en-IN")} collected</p></div>
        <button onClick={()=>load(true)} disabled={spinning} className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-gold hover:border-gold transition-all disabled:opacity-50">
          <RefreshCw size={15} className={spinning?"animate-spin":""}/>
        </button>
      </div>

      {pendingUpi.length>0&&(
        <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center"><AlertTriangle size={17} className="text-amber-700"/></div>
            <div><p className="font-bold text-amber-900 text-sm">{pendingUpi.length} UPI payment{pendingUpi.length>1?"s":""} need verification</p>
              <p className="text-amber-700 text-xs">Check your UPI app and approve or reject below</p></div>
          </div>
          <button onClick={()=>setTab("upi")} className="h-9 px-4 bg-amber-700 text-white rounded-xl text-xs font-bold hover:bg-amber-800 whitespace-nowrap">Verify Now</button>
        </motion.div>
      )}

      <div className="flex gap-2 flex-wrap">
        {[{id:"all",label:"All Orders",count:allOrders.length},{id:"upi",label:"⏳ UPI Pending",count:pendingUpi.length}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as any)}
            className={`h-9 px-5 rounded-xl text-sm font-semibold transition-all ${tab===t.id?t.id==="upi"?"bg-amber-600 text-white":"bg-ink text-white":"bg-white border border-gray-200 text-ink-muted"}`}>
            {t.label} <span className="ml-1 opacity-60 text-xs">{t.count}</span>
            {t.id==="upi"&&t.count>0&&<span className="ml-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full inline-flex items-center justify-center">{t.count}</span>}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-3 top-3 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="h-9 pl-9 pr-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-gold w-52"/>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Order","Buyer","Amount","Method","Payment","Status","Date",...(tab==="upi"?["UTR","Action"]:[])]
                .map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading?[...Array(6)].map((_,i)=><tr key={i}><td colSpan={tab==="upi"?9:7} className="px-4 py-3"><div className="h-7 bg-gray-100 rounded animate-pulse"/></td></tr>)
              :orders.length===0?<tr><td colSpan={tab==="upi"?9:7} className="px-4 py-16 text-center text-gray-400">{tab==="upi"?"🎉 No pending UPI verifications":"No orders found"}</td></tr>
              :orders.map((o,i)=>(
                <tr key={o.id} className={`hover:bg-gray-50/50 transition-colors ${o.payment_status==="awaiting_verification"?"bg-amber-50/20":""}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">#{o.id.slice(0,8).toUpperCase()}</td>
                  <td className="px-4 py-3"><p className="font-medium text-xs text-ink">{o.buyer_name}</p><p className="text-[10px] text-gray-400">{o.seller_name}</p></td>
                  <td className="px-4 py-3 font-bold text-xs">₹{o.total_paid?.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${o.payment_method==="upi"?"bg-green-50 text-green-700":o.payment_method==="razorpay"?"bg-blue-50 text-blue-700":"bg-amber-50 text-amber-700"}`}>{o.payment_method}</span></td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PAY_CLS[o.payment_status]||"bg-gray-100 text-gray-600"}`}>{PAY_LABEL[o.payment_status]||o.payment_status}</span></td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-2 py-1 rounded-full capitalize ${STS_CLS[o.status]||"bg-gray-100 text-gray-600"}`}>{o.status}</span></td>
                  <td className="px-4 py-3 text-[11px] text-gray-400 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"2-digit"})}</td>
                  {tab==="upi"&&<><td className="px-4 py-3 font-mono text-xs">{o.upi_transaction_ref||"—"}</td>
                  <td className="px-4 py-3"><button onClick={()=>setVerify(o)} className="h-8 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors">Verify</button></td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orders.length>0&&<div className="px-4 py-3 border-t border-gray-50 flex justify-between"><span className="text-xs text-gray-400">{orders.length} shown</span>
          <span className="text-xs font-semibold text-gray-600">Collected: ₹{orders.filter(o=>o.payment_status==="paid").reduce((s,o)=>s+(o.total_paid||0),0).toLocaleString("en-IN")}</span></div>}
      </div>

      <AnimatePresence>
        {verifyOrder&&<VerifyModal order={verifyOrder} onClose={()=>setVerify(null)} onDone={()=>{setVerify(null);load(true);}}/>}
      </AnimatePresence>
    </div>
  );
}
