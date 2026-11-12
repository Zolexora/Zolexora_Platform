"use client";
import { useState, useEffect } from "react";
import { shippingApi } from "@/lib/shipping-api";
import { MapPin, Plus, Trash2, CheckCircle, X, Loader2, Edit } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

function LocationModal({ location, onClose, onSave }: { location?: any; onClose: () => void; onSave: (l: any) => void }) {
  const isEdit = !!location?.id;
  const [form, setForm] = useState({
    label: location?.label || "", contact_name: location?.contact_name || "",
    phone: location?.phone || "", email: location?.email || "",
    address_line_1: location?.address_line_1 || "", address_line_2: location?.address_line_2 || "",
    city: location?.city || "", state: location?.state || "",
    pincode: location?.pincode || "", country: "India",
    gst_number: location?.gst_number || "", is_default: location?.is_default || false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const result = isEdit
        ? await shippingApi.updatePickupLocation(location.id, form)
        : await shippingApi.createPickupLocation(form);
      onSave(result);
      toast.success(isEdit ? "Location updated" : "Pickup location added");
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const ic = "w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-display text-lg font-bold text-ink">{isEdit ? "Edit Location" : "Add Pickup Location"}</h2>
          <button onClick={onClose} title="Close" className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Location Label *</label>
              <input required value={form.label} onChange={set("label")} placeholder="e.g. Warehouse Delhi" className={ic} /></div>
            <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Contact Name *</label>
              <input required value={form.contact_name} onChange={set("contact_name")} placeholder="Full name" className={ic} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Phone *</label>
              <input required value={form.phone} onChange={set("phone")} placeholder="10-digit mobile" className={ic} /></div>
            <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Email *</label>
              <input required type="email" value={form.email} onChange={set("email")} placeholder="pickup@store.com" className={ic} /></div>
          </div>
          <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Address Line 1 *</label>
            <input required value={form.address_line_1} onChange={set("address_line_1")} placeholder="Street, building, flat" className={ic} /></div>
          <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Address Line 2</label>
            <input value={form.address_line_2} onChange={set("address_line_2")} placeholder="Landmark, area (optional)" className={ic} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs font-semibold text-ink-muted mb-1 block">City *</label>
              <input required value={form.city} onChange={set("city")} placeholder="Delhi" className={ic} /></div>
            <div><label className="text-xs font-semibold text-ink-muted mb-1 block">State *</label>
              <input required value={form.state} onChange={set("state")} placeholder="Delhi" className={ic} /></div>
            <div><label className="text-xs font-semibold text-ink-muted mb-1 block">Pincode *</label>
              <input required value={form.pincode} onChange={set("pincode")} placeholder="110001" maxLength={6} className={ic} /></div>
          </div>
          <div><label className="text-xs font-semibold text-ink-muted mb-1 block">GST Number (optional)</label>
            <input value={form.gst_number} onChange={set("gst_number")} placeholder="22AAAAA0000A1Z5" className={ic} /></div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
              className="w-4 h-4 accent-gold" />
            <span className="text-sm font-medium text-ink">Set as default pickup location</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-10 border border-gray-200 rounded-xl text-sm font-semibold text-ink-muted hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 h-10 bg-gold hover:bg-gold-dark rounded-xl text-sm font-bold text-ink disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? "Saving..." : isEdit ? "Update" : "Add Location"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function ShippingPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | any>(null);

  useEffect(() => {
    shippingApi.getPickupLocations().then(setLocations).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this pickup location?")) return;
    await shippingApi.deletePickupLocation(id);
    setLocations(ls => ls.filter(l => l.id !== id));
    toast.success("Deleted");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Shipping Setup</h1>
          <p className="text-ink-muted text-sm mt-0.5">Manage your pickup locations. The system auto-selects the best courier when you mark orders ready to ship.</p>
        </div>
        <button onClick={() => setModal("create")} className="h-10 px-5 bg-gold hover:bg-gold-dark rounded-xl flex items-center gap-2 font-bold text-sm text-ink">
          <Plus size={16} /> Add Location
        </button>
      </div>

      {/* How it works */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <h3 className="font-bold text-sm text-amber-900 mb-3">⚡ How auto-shipping works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            { n: "1", text: "Mark order Ready to Ship" },
            { n: "2", text: "System checks all 7 couriers" },
            { n: "3", text: "Picks cheapest courier ≤6 days" },
            { n: "4", text: "Auto-books + generates AWB" },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-amber-900 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</div>
              <p className="text-xs font-medium text-amber-800">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pickup locations */}
      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-28 shimmer rounded-2xl" />)}</div>
      ) : locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100">
          <MapPin size={36} className="text-gray-200 mb-3" />
          <p className="font-semibold text-gray-500">No pickup locations yet</p>
          <p className="text-sm text-ink-muted mt-1 mb-4">Add at least one pickup address to start shipping</p>
          <button onClick={() => setModal("create")} className="h-9 px-5 bg-gold rounded-xl text-sm font-bold text-ink">Add First Location</button>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map((loc, i) => (
            <motion.div key={loc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={`bg-white rounded-2xl border p-5 flex items-start gap-4 ${loc.is_default ? "border-gold/50 bg-amber-50/30" : "border-gray-100"}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${loc.is_default ? "bg-gold/10" : "bg-gray-50"}`}>
                <MapPin size={18} className={loc.is_default ? "text-gold-dark" : "text-gray-400"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-sm text-ink">{loc.label}</p>
                  {loc.is_default && <span className="text-[10px] font-bold bg-gold/20 text-amber-800 px-2 py-0.5 rounded-full">Default</span>}
                </div>
                <p className="text-xs text-ink-muted">{loc.contact_name} · {loc.phone}</p>
                <p className="text-xs text-ink-muted mt-0.5">{loc.address_line_1}, {loc.city}, {loc.state} — {loc.pincode}</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setModal(loc)} title="Edit location" className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
                  <Edit size={13} className="text-ink-muted" />
                </button>
                <button onClick={() => handleDelete(loc.id)} title="Delete location" className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-red-50 hover:border-red-200">
                  <Trash2 size={13} className="text-gray-400 hover:text-red-500" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Courier info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-display text-sm font-bold text-ink mb-3">Integrated Couriers</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { name: "Delhivery", priority: "1st choice" },
            { name: "NimbusPost", priority: "2nd choice" },
            { name: "Shiprocket", priority: "3rd choice" },
            { name: "DTDC", priority: "4th choice" },
            { name: "Blue Dart", priority: "5th choice" },
            { name: "India Post", priority: "6th choice" },
            { name: "Pickrr", priority: "7th choice" },
          ].map(c => (
            <div key={c.name} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl">
              <CheckCircle size={13} className="text-green-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-ink">{c.name}</p>
                <p className="text-[10px] text-ink-muted">{c.priority}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-muted mt-3">Add your API keys in services/marketplace-api/.env to activate each provider. Unconfigured providers are automatically skipped.</p>
      </div>

      <AnimatePresence>
        {modal && (
          <LocationModal location={modal === "create" ? undefined : modal} onClose={() => setModal(null)}
            onSave={(saved) => {
              if (modal === "create") setLocations(ls => [...ls, saved]);
              else setLocations(ls => ls.map(l => l.id === saved.id ? saved : l));
              setModal(null);
            }} />
        )}
      </AnimatePresence>
    </div>
  );
}
