"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { productsApi, api } from "@/lib/api";
import { useAuthStore } from "@/store";
import {
  Upload, X, Plus, Loader2, ArrowLeft, Globe, Tag, 
  Package, Truck, Eye, Check, RefreshCw, HelpCircle
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = ["Electronics", "Fashion", "Home & Living", "Beauty", "Sports", "Food", "Other"];

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuthStore();
  const [busy, setBusy]         = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [images, setImages]     = useState<string[]>([]);
  
  // Shopify Polaris-inspired form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    original_price: "",
    cost_per_item: "",
    category: "Electronics",
    stock: "999",
    sku: "",
    barcode: "",
    weight: "",
    weight_unit: "kg",
    length: "",
    width: "",
    height: "",
    status: "Active", // Active, Draft, Archived
    product_type: "",
    vendor: user?.company_name || user?.name || "Zolexora Seller",
    storefront_ids: ["zolexora-shop", "mahila-madel"],
  });

  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Dirty state tracking (for Shopify's unsaved changes bar)
  const [isDirty, setIsDirty] = useState(false);
  const initialFormState = useRef(form);
  const initialImagesState = useRef<string[]>([]);
  const initialTagsState = useRef<string[]>([]);

  useEffect(() => {
    if (!id) return;
    api.get(`/products/${id}`).then((res) => {
      const data = res.data;
      const loadedForm = {
        ...form,
        title: data.title || "",
        description: data.description || "",
        price: data.price?.amount_minor ? (data.price.amount_minor / 100).toString() : "",
        original_price: data.original_price?.amount_minor ? (data.original_price.amount_minor / 100).toString() : "",
        category: data.category || "Other",
        stock: data.stock?.toString() || "0",
        status: data.is_active ? "Active" : "Draft",
        storefront_ids: data.storefront_ids || [data.storefront_id],
      };
      setForm(loadedForm);
      setImages(data.images || []);
      initialFormState.current = loadedForm;
      initialImagesState.current = data.images || [];
    }).catch(() => {
      toast.error("Failed to load product");
    }).finally(() => setLoadingData(false));
  }, [id]);

  useEffect(() => {
    if (loadingData) return;
    const isFormChanged = JSON.stringify(form) !== JSON.stringify(initialFormState.current);
    const isImagesChanged = JSON.stringify(images) !== JSON.stringify(initialImagesState.current);
    const isTagsChanged = JSON.stringify(tags) !== JSON.stringify(initialTagsState.current);
    setIsDirty(isFormChanged || isImagesChanged || isTagsChanged);
  }, [form, images, tags, loadingData]);

  const f = (k: keyof typeof form) => (e: any) => {
    setForm(p => ({ ...p, [k]: e.target.value }));
  };

  // Calculations for Pricing Card
  const priceNum = parseFloat(form.price) || 0;
  const costNum = parseFloat(form.cost_per_item) || 0;
  const profit = priceNum - costNum;
  const margin = priceNum > 0 ? Math.round((profit / priceNum) * 100) : 0;

  // Add Tags
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = tagInput.trim().replace(/,/g, "");
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Discard changes
  const handleDiscard = () => {
    setForm(initialFormState.current);
    setImages(initialImagesState.current);
    setTags(initialTagsState.current);
    setIsDirty(false);
    toast.success("Changes discarded");
  };

  // Upload images linked to the product
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    try {
      for (const file of files) {
        const res = await productsApi.uploadImage(id, file);
        setImages(prev => [...prev, res.image_url]);
      }
      toast.success(`${files.length} image(s) uploaded successfully`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast.error(Array.isArray(detail) ? detail[0]?.msg : (detail || "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  // Save / Update product
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Product Title is required");
      return;
    }
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) {
      toast.error("Valid selling price is required");
      return;
    }

    setBusy(true);
    try {
      const originalPrice = parseFloat(form.original_price);
      
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        price: { amount_minor: Math.round(price * 100), currency: "INR" },
        original_price: isNaN(originalPrice) ? undefined : { amount_minor: Math.round(originalPrice * 100), currency: "INR" },
        category: form.category as any,
        stock: parseInt(form.stock, 10) || 0,
        is_active: form.status === "Active",
        storefront_ids: form.storefront_ids,
      };

      await productsApi.update(id, payload as any);

      toast.success("Product updated!");
      
      // Update initial values to reset dirty check
      initialFormState.current = form;
      initialImagesState.current = images;
      initialTagsState.current = tags;
      setIsDirty(false);

      router.push("/products");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast.error(Array.isArray(detail) ? detail[0]?.msg : (detail || "Failed to save product"));
    } finally {
      setBusy(false);
    }
  };

  const inputClass = "w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm text-[#202223] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#008060] focus:border-[#008060] transition-shadow";
  const textareaClass = "w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-[#202223] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#008060] focus:border-[#008060] transition-shadow resize-none";

  return (
    <div className="bg-[#f6f6f7] min-h-screen pb-16 font-sans text-[#202223]">
      
      {/* Sticky Polaris Unsaved Changes Bar */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 bg-[#1c1d1f] text-white px-6 py-3 flex items-center justify-between border-b border-[#2d2e30] shadow-lg"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-medium text-gray-300">Unsaved changes</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDiscard}
                className="px-4 py-1.5 rounded-lg bg-transparent hover:bg-[#2d2e30] text-sm font-medium border border-[#3e4042] transition-colors"
                disabled={busy}
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="px-4 py-1.5 rounded-lg bg-[#008060] hover:bg-[#006e52] text-sm font-semibold transition-colors flex items-center gap-1.5 text-white"
                disabled={busy}
              >
                {busy && <Loader2 size={12} className="animate-spin" />}
                Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`max-w-5xl mx-auto px-6 py-8 ${isDirty ? "mt-12" : ""}`}>
        
        {/* Header Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/products" className="w-9 h-9 rounded-lg border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors">
              <ArrowLeft size={16} className="text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-[#202223] flex items-center gap-2">
                Edit Product
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">Update your product title, images, and shipping configurations</p>
            </div>
          </div>
          
          {/* Default actions if dirty bar is not active */}
          {!isDirty && (
            <div className="flex items-center gap-3">
              <Link href="/products" className="px-4 py-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-sm font-medium transition-colors">
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="px-4 py-2 rounded-lg bg-[#008060] hover:bg-[#006e52] text-sm font-semibold text-white transition-colors flex items-center gap-1.5"
                disabled={busy}
              >
                {busy && <Loader2 size={12} className="animate-spin" />}
                Save
              </button>
            </div>
          )}
        </div>

        {/* Two-Column Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Column (Left/Center) - 2/3 Width */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Title & Description Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={f("title")}
                  placeholder="Short sleeve t-shirt, wireless charger..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                  <span>Description</span>
                  <span className="text-[10px] text-gray-400 font-normal">Rich description helps conversions</span>
                </label>
                
                {/* Text Formatting Toolbar Mock */}
                <div className="flex items-center gap-1 px-3 py-1.5 border border-b-0 border-gray-300 rounded-t-lg bg-gray-50 text-gray-500 text-xs font-mono">
                  <span className="px-1.5 py-0.5 hover:bg-gray-200 rounded cursor-pointer font-bold">B</span>
                  <span className="px-1.5 py-0.5 hover:bg-gray-200 rounded cursor-pointer italic">I</span>
                  <span className="px-1.5 py-0.5 hover:bg-gray-200 rounded cursor-pointer underline">U</span>
                  <span className="w-[1px] h-3 bg-gray-300 mx-1" />
                  <span className="px-1.5 py-0.5 hover:bg-gray-200 rounded cursor-pointer">List</span>
                  <span className="px-1.5 py-0.5 hover:bg-gray-200 rounded cursor-pointer">Link</span>
                  <span className="px-1.5 py-0.5 hover:bg-gray-200 rounded cursor-pointer">Img</span>
                </div>
                
                <textarea
                  value={form.description}
                  onChange={f("description") as any}
                  placeholder="Provide product details, specs, sizes, and care instructions..."
                  rows={6}
                  className={`${textareaClass} rounded-t-none`}
                />
              </div>
            </div>

            {/* Media Upload Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-[#202223]">Media</h2>
                <span className="text-[11px] text-[#008060] font-semibold flex items-center gap-0.5">
                  <Globe size={12} /> Cloudinary CDN active
                </span>
              </div>

              {images.length > 0 ? (
                <div className="grid grid-cols-4 gap-3">
                  {images.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-lg border border-gray-200 overflow-hidden group bg-gray-50 shadow-sm">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages(p => p.filter((_, j) => j !== i))}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-white hover:bg-red-50 text-red-500 rounded-full border border-gray-200 flex items-center justify-center shadow transition-all opacity-0 group-hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-1.5 left-1.5 bg-[#e2f1e8] text-[#008060] text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#a3dcb8]">
                          Primary
                        </span>
                      )}
                    </div>
                  ))}
                  <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-[#008060] flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50 group">
                    {uploading ? (
                      <Loader2 size={24} className="text-[#008060] animate-spin" />
                    ) : (
                      <>
                        <Upload size={24} className="text-gray-400 group-hover:text-[#008060] transition-colors mb-1" />
                        <span className="text-[11px] text-gray-400 group-hover:text-[#008060] font-semibold transition-colors">Add file</span>
                      </>
                    )}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
                  </label>
                </div>
              ) : (
                <label className="border-2 border-dashed border-gray-300 hover:border-[#008060] rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50 group text-center">
                  {uploading ? (
                    <div className="flex flex-col items-center py-4">
                      <Loader2 size={32} className="text-[#008060] animate-spin mb-2" />
                      <span className="text-sm font-medium text-gray-500">Uploading files to CDN...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center mb-3 text-gray-400 group-hover:text-[#008060] transition-colors">
                        <Upload size={20} />
                      </div>
                      <span className="text-sm font-semibold text-[#202223] mb-1">Upload files or drag here</span>
                      <span className="text-xs text-gray-500 mb-3">Accepts images, videos, or animated GIFs up to 8MB</span>
                      <span className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors shadow-sm text-gray-700">Add files</span>
                    </>
                  )}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
                </label>
              )}
            </div>

            {/* Pricing Card with dynamic margin calculation */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-[#202223]">Pricing</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Price (₹) *</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={f("price")}
                    placeholder="₹ 0.00"
                    min="0"
                    step="0.01"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                    Compare-at price (₹)
                    <span title="Original price before discount">
                      <HelpCircle size={12} className="text-gray-400 cursor-help" />
                    </span>
                  </label>
                  <input
                    type="number"
                    value={form.original_price}
                    onChange={f("original_price")}
                    placeholder="₹ 0.00"
                    min="0"
                    step="0.01"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="w-full h-[1px] bg-gray-100 my-4" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                    Cost per item (₹)
                    <span title="For profit and margin analytics">
                      <HelpCircle size={12} className="text-gray-400 cursor-help" />
                    </span>
                  </label>
                  <input
                    type="number"
                    value={form.cost_per_item}
                    onChange={f("cost_per_item")}
                    placeholder="₹ 0.00"
                    min="0"
                    step="0.01"
                    className={inputClass}
                  />
                </div>
                
                {/* Financial Health / Margin widget */}
                <div className="flex flex-col justify-end">
                  {priceNum > 0 && costNum > 0 ? (
                    <div className="bg-[#f1f8f5] border border-[#a3dcb8] rounded-lg p-3 text-xs text-[#008060]">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-gray-500">Margin:</span>
                        <span className={`font-bold ${margin < 15 ? 'text-red-500' : 'text-[#008060]'}`}>{margin}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-500">Profit:</span>
                        <span className="font-bold">₹{profit.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500 flex items-center justify-center text-center h-[54px]">
                      Enter price and cost to see margin statistics
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Inventory Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-[#202223] flex items-center gap-1.5">
                <Package size={16} className="text-gray-500" /> Inventory
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">SKU (Stock Keeping Unit)</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={f("sku")}
                    placeholder="e.g. WH-PRO-01"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Barcode (ISBN, UPC, GTIN)</label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={f("barcode")}
                    placeholder="e.g. 1901980838"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="w-full h-[1px] bg-gray-100 my-4" />

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Available Quantity *</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={form.stock}
                    onChange={f("stock")}
                    placeholder="999"
                    min="0"
                    className={`${inputClass} w-32`}
                  />
                  <span className="text-xs text-gray-400">Items currently physically in stock</span>
                </div>
              </div>
            </div>

            {/* Shipping & Delivery dimensions (Used by Zolexora Parallel Courier Booker) */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-[#202223] flex items-center gap-1.5">
                <Truck size={16} className="text-gray-500" /> Shipping
              </h2>
              <p className="text-xs text-gray-400 mt-1">Weight and dimensions are evaluated in parallel across 7 couriers (Delhivery, Shiprocket, Blue Dart, etc.) during checkout booking.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Weight</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={form.weight}
                      onChange={f("weight")}
                      placeholder="0.0"
                      min="0"
                      step="0.01"
                      className={`${inputClass} flex-1`}
                    />
                    <select
                      value={form.weight_unit}
                      onChange={f("weight_unit")}
                      className="w-20 h-10 px-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none"
                    >
                      <option>kg</option>
                      <option>g</option>
                    </select>
                  </div>
                </div>
                
                {/* Dimensions */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Dimensions (L × W × H) (cm)</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={form.length}
                      onChange={f("length")}
                      placeholder="L"
                      min="0"
                      className="w-16 h-10 px-2 rounded-lg border border-gray-300 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#008060]"
                    />
                    <span className="text-gray-400 text-xs">×</span>
                    <input
                      type="number"
                      value={form.width}
                      onChange={f("width")}
                      placeholder="W"
                      min="0"
                      className="w-16 h-10 px-2 rounded-lg border border-gray-300 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#008060]"
                    />
                    <span className="text-gray-400 text-xs">×</span>
                    <input
                      type="number"
                      value={form.height}
                      onChange={f("height")}
                      placeholder="H"
                      min="0"
                      className="w-16 h-10 px-2 rounded-lg border border-gray-300 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#008060]"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Sidebar Column (Right) - 1/3 Width */}
          <div className="space-y-6">
            
            {/* Product Status Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-[#202223]">Product status</h2>
              <div>
                <select
                  value={form.status}
                  onChange={f("status")}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#008060]"
                >
                  <option>Active</option>
                  <option>Draft</option>
                  <option>Archived</option>
                </select>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  form.status === "Active" ? "bg-[#008060]" : form.status === "Draft" ? "bg-gray-400" : "bg-red-500"
                }`} />
                <span className="text-xs text-gray-500 font-medium">
                  {form.status === "Active" ? "Visible to buyers on storefront" : form.status === "Draft" ? "Hidden from storefront" : "Permanently archived"}
                </span>
              </div>
            </div>

            {/* Publishing channels Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-[#202223]">Publishing</h2>
              <p className="text-xs text-gray-500">Sales channels and apps</p>
              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.storefront_ids.includes("zolexora-shop")} onChange={(e) => {
                    const ids = e.target.checked ? [...form.storefront_ids, "zolexora-shop"] : form.storefront_ids.filter(id => id !== "zolexora-shop");
                    setForm(p => ({ ...p, storefront_ids: ids }));
                  }} className="rounded text-[#008060] focus:ring-[#008060]" />
                  <Globe size={14} className={form.storefront_ids.includes("zolexora-shop") ? "text-[#008060]" : "text-gray-400"} />
                  <span>Zolexora Shop</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.storefront_ids.includes("mahila-madel")} onChange={(e) => {
                    const ids = e.target.checked ? [...form.storefront_ids, "mahila-madel"] : form.storefront_ids.filter(id => id !== "mahila-madel");
                    setForm(p => ({ ...p, storefront_ids: ids }));
                  }} className="rounded text-[#008060] focus:ring-[#008060]" />
                  <Package size={14} className={form.storefront_ids.includes("mahila-madel") ? "text-[#008060]" : "text-gray-400"} />
                  <span>Mahila Madel</span>
                </label>
              </div>
            </div>

            {/* Product Organization Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-[#202223]">Product organization</h2>
              
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Category (Taxonomy) *</label>
                <select
                  value={form.category}
                  onChange={f("category")}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#008060]"
                >
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Product type</label>
                <input
                  type="text"
                  value={form.product_type}
                  onChange={f("product_type")}
                  placeholder="e.g. Earphones"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Vendor (Seller)</label>
                <input
                  type="text"
                  value={form.vendor}
                  disabled
                  className={`${inputClass} bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Tags</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder="Press enter to add tags"
                    className={inputClass}
                  />
                </div>
                
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-700 font-medium">
                        {tag}
                        <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-red-500">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Google SEO Listing Preview Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-[#202223] flex items-center justify-between">
                <span>Search engine listing</span>
                <span className="text-[10px] text-[#008060] font-bold flex items-center gap-0.5">
                  <Eye size={12} /> Google preview
                </span>
              </h2>
              <div className="space-y-1">
                {/* Search snippet title */}
                <h3 className="text-base text-[#1a0dab] font-normal hover:underline cursor-pointer break-all line-clamp-1 leading-snug">
                  {form.title.trim() || "Untitled Product | Zolexora Store"}
                </h3>
                {/* Search snippet URL */}
                <p className="text-xs text-[#006621] break-all line-clamp-1">
                  https://zolexora.com/products/{(form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "url-handle")}
                </p>
                {/* Search snippet description */}
                <p className="text-xs text-[#545454] leading-relaxed break-all line-clamp-2">
                  {form.description.trim() || "No description provided. Start typing in the details card to see how it looks in google search indexes."}
                </p>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
