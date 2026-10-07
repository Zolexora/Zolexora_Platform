"use client";

import React, { useEffect, useState } from "react";
import { usersApi, authApi, UserProfileDetails, Address } from "@/lib/api";
import { User, Mail, Phone, MapPin, Plus, CheckCircle, Shield, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add Address Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState("");
  const [formErr, setFormErr] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    house_no: "",
    village_town: "",
    landmark: "",
    pincode: "",
    post_office: "",
    district: "",
    division: "",
    region: "",
    state: "",
    country: "INDIA",
    postal_delivery_status: "",
    digipin: "",
    address_line: "",
    city: "",
    is_default: false,
    phone_otp: "",
    email_otp: "",
  });

  // Pincode Resolution State
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeResolved, setPincodeResolved] = useState<any>(null);
  const [pincodeError, setPincodeError] = useState("");
  const [postOffices, setPostOffices] = useState<any[]>([]);
  const [serviceability, setServiceability] = useState<any>(null);

  // OTP & Selection Mode States
  const [phoneMode, setPhoneMode] = useState<"select" | "custom">("select");
  const [emailMode, setEmailMode] = useState<"select" | "custom">("select");
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);

  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const handlePincodeChange = async (pin: string) => {
    const clean = pin.replace(/\D/g, "").slice(0, 6);
    setFormData(prev => ({
      ...prev,
      pincode: clean,
      post_office: "",
      district: "",
      division: "",
      region: "",
      state: "",
      country: "INDIA",
      postal_delivery_status: "",
    }));
    setPincodeResolved(null);
    setPincodeError("");
    setPostOffices([]);
    setServiceability(null);

    if (clean.length === 6) {
      setPincodeLoading(true);
      try {
        const [data, serv] = await Promise.all([
          usersApi.lookupPincode(clean),
          usersApi.checkServiceability(clean).catch(() => null),
        ]);
        setPincodeResolved(data);
        setPostOffices(data.post_offices);
        setServiceability(serv);

        let autoPo = "";
        if (data.post_offices.length === 1) {
          autoPo = data.post_offices[0].name;
        }

        setFormData(prev => ({
          ...prev,
          post_office: autoPo,
          district: data.district,
          division: data.division,
          region: data.region,
          state: data.state,
          country: data.country || "INDIA",
          postal_delivery_status: data.postal_delivery_status,
          city: prev.village_town || data.district,
        }));
      } catch (err: any) {
        setPincodeError(err?.response?.data?.detail || "Pincode not found or invalid. Please check.");
      } finally {
        setPincodeLoading(false);
      }
    }
  };

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await usersApi.getProfile();
      setProfile(data);
      if (data.contacts.verified_phones.length > 0) {
        setPhoneMode("select");
        setFormData(prev => ({ ...prev, phone: data.contacts.verified_phones[0] }));
        setPhoneVerified(true);
      } else {
        setPhoneMode("custom");
        setPhoneVerified(false);
      }
      if (data.contacts.primary_email) {
        setEmailMode("select");
        setFormData(prev => ({ ...prev, email: data.contacts.primary_email }));
        setEmailVerified(true);
      } else {
        setEmailMode("custom");
        setEmailVerified(false);
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push("/auth?redirect=/profile");
        return;
      }
      setError("Failed to load profile details");
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    if (!formData.phone || formData.phone.length < 10) {
      setFormErr("Please enter a valid phone number first");
      return;
    }
    setSendingPhoneOtp(true);
    setFormErr("");
    try {
      const res = await usersApi.sendAddressPhoneOtp(formData.phone);
      setPhoneOtpSent(true);
      setPhoneVerified(false);
      setFormMsg(res.message || "OTP sent to phone");
    } catch (err: any) {
      setFormErr(err?.response?.data?.detail || "Failed to send phone OTP");
    } finally {
      setSendingPhoneOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!formData.phone_otp || formData.phone_otp.length < 6) {
      setFormErr("Enter 6-digit OTP");
      return;
    }
    setVerifyingPhone(true);
    setFormErr("");
    try {
      const res = await usersApi.verifyAddressPhoneOtp(formData.phone, formData.phone_otp);
      setPhoneVerified(true);
      setFormMsg(res.message || "Phone verified successfully! ✓");

      // Auto-save to contacts list and select for this address
      if (profile) {
        const updatedPhones = Array.from(new Set([formData.phone, ...profile.contacts.verified_phones]));
        setProfile({
          ...profile,
          contacts: {
            ...profile.contacts,
            primary_phone: profile.contacts.primary_phone || formData.phone,
            is_phone_verified: true,
            verified_phones: updatedPhones,
          },
        });
      }
      setPhoneMode("select");
      setPhoneOtpSent(false);
    } catch (err: any) {
      setFormErr(err?.response?.data?.detail || "Invalid phone OTP");
    } finally {
      setVerifyingPhone(false);
    }
  };

  const handleSendEmailOtp = async () => {
    const targetEmail = formData.email || profile?.contacts.primary_email;
    if (!targetEmail || !targetEmail.includes("@")) {
      setFormErr("Please enter a valid email address first");
      return;
    }
    setSendingEmailOtp(true);
    setFormErr("");
    try {
      const res = await usersApi.sendAddressEmailOtp(targetEmail);
      setEmailOtpSent(true);
      setEmailVerified(false);
      setFormMsg(res.message || "Verification code sent to email");
    } catch (err: any) {
      setFormErr(err?.response?.data?.detail || "Failed to send email verification code");
    } finally {
      setSendingEmailOtp(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    const targetEmail = formData.email || profile?.contacts.primary_email || "";
    if (!formData.email_otp || formData.email_otp.length < 6) {
      setFormErr("Enter 6-digit code");
      return;
    }
    setVerifyingEmail(true);
    setFormErr("");
    try {
      const res = await usersApi.verifyAddressEmailOtp(targetEmail, formData.email_otp);
      setEmailVerified(true);
      setFormMsg(res.message || "Email verified successfully! ✓");

      // Auto-save to contacts list and select for this address
      if (profile) {
        const updatedEmails = Array.from(new Set([targetEmail, ...profile.contacts.verified_emails]));
        setProfile({
          ...profile,
          contacts: {
            ...profile.contacts,
            verified_emails: updatedEmails,
          },
        });
      }
      setEmailMode("select");
      setEmailOtpSent(false);
    } catch (err: any) {
      setFormErr(err?.response?.data?.detail || "Invalid email code");
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormErr("");
    setFormMsg("");

    if (!formData.house_no || !formData.village_town || !formData.pincode) {
      setFormErr("Please fill in House No., Village/Town, and a valid 6-digit Pincode");
      setSubmitting(false);
      return;
    }

    if (postOffices.length > 1 && !formData.post_office) {
      setFormErr("Please select a Post Office from the dropdown list");
      setSubmitting(false);
      return;
    }

    try {
      await usersApi.addAddress({
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        house_no: formData.house_no,
        village_town: formData.village_town,
        landmark: formData.landmark || undefined,
        post_office: formData.post_office || undefined,
        district: formData.district || undefined,
        division: formData.division || undefined,
        region: formData.region || undefined,
        state: formData.state || "INDIA",
        country: formData.country || "INDIA",
        postal_delivery_status: formData.postal_delivery_status || undefined,
        digipin: formData.digipin || undefined,
        address_line: `${formData.house_no}, ${formData.village_town}${formData.landmark ? ', ' + formData.landmark : ''}`,
        city: formData.village_town || formData.district || "TOWN",
        pincode: formData.pincode,
        is_default: formData.is_default,
        phone_otp: formData.phone_otp || undefined,
        email_otp: formData.email_otp || undefined,
      });

      setShowAddForm(false);
      setFormData({
        name: "",
        phone: "",
        email: "",
        house_no: "",
        village_town: "",
        landmark: "",
        pincode: "",
        post_office: "",
        district: "",
        division: "",
        region: "",
        state: "",
        country: "INDIA",
        postal_delivery_status: "",
        digipin: "",
        address_line: "",
        city: "",
        is_default: false,
        phone_otp: "",
        email_otp: "",
      });
      setPincodeResolved(null);
      setPostOffices([]);
      setServiceability(null);
      setPhoneOtpSent(false);
      setEmailOtpSent(false);
      await loadProfile();
    } catch (err: any) {
      setFormErr(err?.response?.data?.detail || "Failed to add address");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;
    try {
      await usersApi.deleteAddress(id);
      await loadProfile();
    } catch {
      alert("Failed to delete address");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C1C1C]" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] p-8 max-w-3xl mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-4 text-sm">{error || "User not found"}</div>
        <Link href="/" className="text-sm font-semibold underline text-[#1C1C1C]">Return Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="p-2 hover:bg-black/5 rounded-full transition">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-[#1C1C1C] tracking-tight">Account & Profile</h1>
              <p className="text-xs text-gray-500">Manage verified contact channels and delivery addresses</p>
            </div>
          </div>

          <button
            onClick={() => authApi.logout().then(() => router.push("/"))}
            className="text-xs font-bold text-red-600 hover:text-red-700 px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition"
          >
            Sign Out
          </button>
        </div>

        {/* User Identity Card */}
        <div className="bg-white border border-[#E8E5DF] rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-full bg-[#1C1C1C] text-[#FFB800] flex items-center justify-center font-black text-xl">
              {profile.name ? profile.name[0].toUpperCase() : "U"}
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1C1C1C]">{profile.name}</h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full capitalize">
                  {profile.role}
                </span>
                <span className="text-xs text-gray-400">Coins: {profile.coin_balance}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═════════ SECTION 1: CONTACTS ═════════ */}
        <div className="bg-white border border-[#E8E5DF] rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[#E8E5DF] pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Shield size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C]">Contacts</h3>
                <p className="text-xs text-gray-500">Only verified emails and mobile numbers are stored</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Email */}
            <div className="p-4 rounded-xl border border-gray-100 bg-[#FAFAF8] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                  <Mail size={14} /> Primary Email
                </span>
                {profile.contacts.is_email_verified ? (
                  <span className="flex items-center text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                    <CheckCircle size={12} className="mr-1" /> Verified
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    Pending Verification
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-[#1C1C1C] truncate">{profile.contacts.primary_email}</p>
            </div>

            {/* Mobile Numbers (Optional for now) */}
            <div className="p-4 rounded-xl border border-gray-100 bg-[#FAFAF8] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                  <Phone size={14} /> Mobile Numbers <span className="text-[10px] text-gray-400 font-normal">(optional for now)</span>
                </span>
                {profile.contacts.is_phone_verified ? (
                  <span className="flex items-center text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                    <CheckCircle size={12} className="mr-1" /> Verified
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-gray-400">Optional</span>
                )}
              </div>
              {profile.contacts.verified_phones.length > 0 ? (
                <div className="space-y-1">
                  {profile.contacts.verified_phones.map((phone, idx) => (
                    <p key={idx} className="text-sm font-bold text-[#1C1C1C] flex items-center justify-between">
                      <span>{phone}</span>
                      <span className="text-[10px] text-green-600 font-semibold">Active</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No phone number attached yet</p>
              )}
            </div>
          </div>
        </div>

        {/* ═════════ SECTION 2: ADDRESSES ═════════ */}
        <div className="bg-white border border-[#E8E5DF] rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[#E8E5DF] pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <MapPin size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C]">Addresses</h3>
                <p className="text-xs text-gray-500">Delivery addresses with email & mobile verification</p>
              </div>
            </div>

            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setFormErr("");
                setFormMsg("");
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#1C1C1C] text-[#FFB800] text-xs font-bold rounded-xl hover:bg-black transition shadow-sm"
            >
              <Plus size={14} />
              <span>{showAddForm ? "Cancel" : "Add Address"}</span>
            </button>
          </div>

          {/* Add Address Form Modal / Expandable */}
          {showAddForm && (
            <form onSubmit={handleAddAddress} className="p-5 border border-amber-200 bg-amber-50/40 rounded-xl space-y-4">
              <h4 className="text-sm font-black text-[#1C1C1C]">New Delivery Address</h4>

              {formErr && <div className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg">{formErr}</div>}
              {formMsg && <div className="text-xs font-semibold text-green-700 bg-green-50 p-2.5 rounded-lg">{formMsg}</div>}

              <div className="space-y-4">
                {/* 1. Recipient Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">RECIPIENT NAME *</label>
                  <input
                    required
                    type="text"
                    placeholder="FULL NAME"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                    className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black uppercase font-medium"
                  />
                </div>

                {/* 2. Mandatory Address Entry Order */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Field 1: HOUSE NO. / BUILDING */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      1. HOUSE NO. / BUILDING *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="E.G. 123, SHIV SHAKTI APARTMENT / FLAT 302"
                      value={formData.house_no}
                      onChange={(e) => setFormData({ ...formData, house_no: e.target.value.toUpperCase() })}
                      className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black uppercase font-medium"
                    />
                  </div>

                  {/* Field 2: VILLAGE / TOWN */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      2. VILLAGE / TOWN *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="E.G. DADRI / GREATER NOIDA"
                      value={formData.village_town}
                      onChange={(e) => setFormData({ ...formData, village_town: e.target.value.toUpperCase() })}
                      className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black uppercase font-medium"
                    />
                  </div>

                  {/* Field 3: LANDMARK */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      3. LANDMARK <span className="font-normal text-gray-400">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="E.G. NEAR MAIN MARKET / OPP. CITY HOSPITAL"
                      value={formData.landmark}
                      onChange={(e) => setFormData({ ...formData, landmark: e.target.value.toUpperCase() })}
                      className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black uppercase font-medium"
                    />
                  </div>

                  {/* Field 4: PINCODE */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      4. PINCODE * <span className="font-normal text-gray-400">(6-digit Indian PIN)</span>
                    </label>
                    <input
                      required
                      type="text"
                      maxLength={6}
                      placeholder="E.G. 203207"
                      value={formData.pincode}
                      onChange={(e) => handlePincodeChange(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black font-mono font-bold tracking-wider"
                    />
                    {pincodeLoading && (
                      <p className="mt-1 text-[11px] font-bold text-amber-700 animate-pulse">
                        Checking pincode geography & serviceability...
                      </p>
                    )}
                    {pincodeError && (
                      <p className="mt-1 text-[11px] font-bold text-red-600">
                        ✕ {pincodeError}
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. Derived Geographical Information (System Resolved) */}
                {pincodeResolved && (
                  <div className="p-4 bg-white border border-blue-200 rounded-xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <span className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                        <MapPin size={14} className="text-blue-600" /> SYSTEM RESOLVED LOCATION
                      </span>
                      <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        Postal Verified ✓
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <span className="block text-[10px] font-bold text-gray-400">COUNTRY</span>
                        <span className="font-bold text-gray-800">{pincodeResolved.country} ✓</span>
                      </div>
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <span className="block text-[10px] font-bold text-gray-400">STATE</span>
                        <span className="font-bold text-gray-800">{pincodeResolved.state} ✓</span>
                      </div>
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <span className="block text-[10px] font-bold text-gray-400">REGION</span>
                        <span className="font-bold text-gray-800">{pincodeResolved.region || pincodeResolved.district} ✓</span>
                      </div>
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <span className="block text-[10px] font-bold text-gray-400">DIVISION</span>
                        <span className="font-bold text-gray-800">{pincodeResolved.division || pincodeResolved.district} ✓</span>
                      </div>
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <span className="block text-[10px] font-bold text-gray-400">DISTRICT</span>
                        <span className="font-bold text-gray-800">{pincodeResolved.district} ✓</span>
                      </div>
                    </div>

                    {/* Post Office Selection (Strict Dropdown / Auto-Select) */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        POST OFFICE *
                      </label>
                      {postOffices.length > 1 ? (
                        <select
                          required
                          value={formData.post_office}
                          onChange={(e) => setFormData({ ...formData, post_office: e.target.value })}
                          className="w-full text-xs p-2.5 bg-white border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 font-bold text-gray-800"
                        >
                          <option value="">[ SELECT POST OFFICE ▼ ]</option>
                          {postOffices.map((po: any) => (
                            <option key={po.name} value={po.name}>
                              {po.name} ({po.delivery_status})
                            </option>
                          ))}
                        </select>
                      ) : postOffices.length === 1 ? (
                        <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg text-xs font-bold text-blue-900 flex items-center justify-between">
                          <span>{postOffices[0].name}</span>
                          <span className="text-green-700 text-[11px]">Auto-Selected ✓</span>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic">No post offices found for this pincode</p>
                      )}
                    </div>

                    {/* Status & Integration Badges */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                      <div className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                        pincodeResolved.postal_delivery_status === "DELIVERY AVAILABLE"
                          ? "bg-green-50 text-green-800 border border-green-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}>
                        {pincodeResolved.postal_delivery_status === "DELIVERY AVAILABLE" ? (
                          <><CheckCircle size={14} className="text-green-600" /> ✓ DELIVERY AVAILABLE</>
                        ) : (
                          <>✕ DELIVERY NOT AVAILABLE — PLEASE CHANGE PINCODE</>
                        )}
                      </div>

                      <div className="p-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle size={14} className="text-emerald-600" /> ✓ DIGIPIN & GOOGLE VERIFIED
                      </div>

                      {serviceability && (
                        <div className="sm:col-span-2 p-2 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs font-semibold flex items-center justify-between">
                          <span>✓ COURIER SERVICEABLE ({serviceability.provider})</span>
                          <span className="text-[11px] font-bold text-green-700">COD Available ✓</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Contact Details (Phone & Email with Verification) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200">
                  {/* Phone Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-700">Mobile Phone *</label>
                      {profile.contacts.verified_phones.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (phoneMode === "select") {
                              setPhoneMode("custom");
                              setFormData({ ...formData, phone: "", phone_otp: "" });
                              setPhoneVerified(false);
                            } else {
                              setPhoneMode("select");
                              setFormData({ ...formData, phone: profile.contacts.verified_phones[0] || "", phone_otp: "" });
                              setPhoneVerified(true);
                            }
                            setPhoneOtpSent(false);
                          }}
                          className="text-[11px] font-bold text-amber-700 hover:underline"
                        >
                          {phoneMode === "select" ? "+ New Number" : "← Select Verified"}
                        </button>
                      )}
                    </div>

                    {phoneMode === "select" && profile.contacts.verified_phones.length > 0 ? (
                      <select
                        value={formData.phone}
                        onChange={(e) => {
                          if (e.target.value === "__new__") {
                            setPhoneMode("custom");
                            setFormData({ ...formData, phone: "", phone_otp: "" });
                            setPhoneOtpSent(false);
                            setPhoneVerified(false);
                          } else {
                            setFormData({ ...formData, phone: e.target.value, phone_otp: "" });
                            setPhoneVerified(true);
                          }
                        }}
                        className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black font-medium"
                      >
                        {profile.contacts.verified_phones.map((p) => (
                          <option key={p} value={p}>
                            {p} (Verified ✓)
                          </option>
                        ))}
                        <option value="__new__">+ Enter a new mobile number...</option>
                      </select>
                    ) : (
                      <div>
                        <div className="flex gap-2">
                          <input
                            required
                            type="tel"
                            placeholder="10-digit Phone"
                            value={formData.phone}
                            onChange={(e) => {
                              setFormData({ ...formData, phone: e.target.value, phone_otp: "" });
                              setPhoneVerified(false);
                              setPhoneOtpSent(false);
                            }}
                            className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black"
                          />
                          <button
                            type="button"
                            disabled={sendingPhoneOtp}
                            onClick={handleSendPhoneOtp}
                            className="px-2.5 py-1 text-[11px] font-bold bg-[#1C1C1C] text-[#FFB800] rounded-lg whitespace-nowrap hover:bg-black disabled:opacity-50"
                          >
                            {sendingPhoneOtp ? "Sending..." : phoneOtpSent ? "Resend" : "Send OTP"}
                          </button>
                        </div>
                        {phoneOtpSent && !phoneVerified && (
                          <div className="mt-2 flex gap-2">
                            <input
                              type="text"
                              maxLength={6}
                              placeholder="6-digit Phone OTP"
                              value={formData.phone_otp}
                              onChange={(e) => setFormData({ ...formData, phone_otp: e.target.value })}
                              className="w-full text-xs p-2 bg-white border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              disabled={verifyingPhone || formData.phone_otp.length < 6}
                              onClick={handleVerifyPhoneOtp}
                              className="px-3.5 py-1 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg whitespace-nowrap disabled:opacity-50 transition shadow-sm"
                            >
                              {verifyingPhone ? "..." : "Verify"}
                            </button>
                          </div>
                        )}
                        {phoneVerified && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-200">
                            <CheckCircle size={14} className="text-green-600" /> Phone number verified
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Email Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-700">
                        Contact Email <span className="font-normal text-gray-400">(Optional)</span>
                      </label>
                      {profile.contacts.primary_email && (
                        <button
                          type="button"
                          onClick={() => {
                            if (emailMode === "select") {
                              setEmailMode("custom");
                              setFormData({ ...formData, email: "", email_otp: "" });
                              setEmailVerified(false);
                              setEmailOtpSent(false);
                            } else {
                              setEmailMode("select");
                              setFormData({ ...formData, email: profile.contacts.primary_email, email_otp: "" });
                              setEmailVerified(true);
                            }
                          }}
                          className="text-[11px] font-bold text-amber-700 hover:underline"
                        >
                          {emailMode === "select" ? "+ New Email" : "← Select Verified"}
                        </button>
                      )}
                    </div>

                    {emailMode === "select" && profile.contacts.primary_email ? (
                      <select
                        value={formData.email}
                        onChange={(e) => {
                          if (e.target.value === "__new__") {
                            setEmailMode("custom");
                            setFormData({ ...formData, email: "", email_otp: "" });
                            setEmailOtpSent(false);
                            setEmailVerified(false);
                          } else {
                            setFormData({ ...formData, email: e.target.value, email_otp: "" });
                            setEmailVerified(true);
                          }
                        }}
                        className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black font-medium"
                      >
                        <option value={profile.contacts.primary_email}>
                          {profile.contacts.primary_email} (Verified Primary ✓)
                        </option>
                        {profile.contacts.verified_emails
                          .filter((em) => em !== profile.contacts.primary_email)
                          .map((em) => (
                            <option key={em} value={em}>
                              {em} (Verified ✓)
                            </option>
                          ))}
                        <option value="__new__">+ Enter a new email address...</option>
                      </select>
                    ) : (
                      <div>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            placeholder="New email address"
                            value={formData.email}
                            onChange={(e) => {
                              setFormData({ ...formData, email: e.target.value, email_otp: "" });
                              setEmailVerified(false);
                              setEmailOtpSent(false);
                            }}
                            className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black"
                          />
                          <button
                            type="button"
                            disabled={sendingEmailOtp}
                            onClick={handleSendEmailOtp}
                            className="px-2.5 py-1 text-[11px] font-bold bg-[#1C1C1C] text-[#FFB800] rounded-lg whitespace-nowrap hover:bg-black disabled:opacity-50"
                          >
                            {sendingEmailOtp ? "Sending..." : emailOtpSent ? "Resend" : "Send Code"}
                          </button>
                        </div>
                        {emailOtpSent && !emailVerified && (
                          <div className="mt-2 flex gap-2">
                            <input
                              type="text"
                              maxLength={6}
                              placeholder="6-digit Email Code"
                              value={formData.email_otp}
                              onChange={(e) => setFormData({ ...formData, email_otp: e.target.value })}
                              className="w-full text-xs p-2 bg-white border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              disabled={verifyingEmail || formData.email_otp.length < 6}
                              onClick={handleVerifyEmailOtp}
                              className="px-3.5 py-1 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg whitespace-nowrap disabled:opacity-50 transition shadow-sm"
                            >
                              {verifyingEmail ? "..." : "Verify"}
                            </button>
                          </div>
                        )}
                        {emailVerified && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-200">
                            <CheckCircle size={14} className="text-green-600" /> Email address verified
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center pt-2">
                  <label className="flex items-center space-x-2 text-xs font-bold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                      className="rounded border-gray-300 text-black focus:ring-black"
                    />
                    <span>Set as Default Address</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    (pincodeResolved && pincodeResolved.postal_delivery_status !== "DELIVERY AVAILABLE") ||
                    (postOffices.length > 1 && !formData.post_office)
                  }
                  className="px-5 py-2 text-xs font-bold bg-[#1C1C1C] text-[#FFB800] rounded-xl hover:bg-black disabled:opacity-50 transition shadow-sm"
                >
                  {submitting ? "Saving..." : "SAVE ADDRESS"}
                </button>
              </div>
            </form>
          )}

          {/* Address List */}
          {profile.addresses.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No saved addresses found. Click &quot;Add Address&quot; above to add your first delivery address.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.addresses.map((addr: Address) => (
                <div
                  key={addr.id}
                  className={`p-4 rounded-xl border transition ${
                    addr.is_default ? "border-amber-400 bg-amber-50/20" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-[#1C1C1C]">{addr.name}</span>
                        {addr.is_default && (
                          <span className="text-[10px] font-black uppercase tracking-wider bg-[#FFB800] text-[#1C1C1C] px-2 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                        <Phone size={12} /> {addr.phone}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="text-gray-400 hover:text-red-600 p-1 transition"
                      title="Delete address"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <p className="text-xs text-gray-600 mt-2.5 line-clamp-2">{addr.address_line}</p>
                  <p className="text-xs font-medium text-gray-500 mt-0.5">
                    {addr.city}, {addr.state} - {addr.pincode}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
