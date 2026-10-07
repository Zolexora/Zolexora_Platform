import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import {
  checkoutCart,
  getAddresses,
  addAddress,
  lookupPincode,
  checkServiceability,
  sendAddressPhoneOtp,
  verifyAddressPhoneOtp,
  sendAddressEmailOtp,
  verifyAddressEmailOtp,
  getUserProfile,
  getCoinBalance,
  verifyCashfree,
  verifyRazorpay,
  verifyUpiPaid,
} from '../utils/api';
import { toast } from 'react-toastify';
import {
  FiCheckCircle,
  FiMapPin,
  FiTruck,
  FiCreditCard,
  FiShield,
  FiArrowRight,
  FiPlus,
  FiPhone,
  FiUser,
  FiDollarSign,
  FiCheck,
  FiAlertCircle,
  FiLock,
  FiSmartphone,
} from 'react-icons/fi';
import './Checkout.css';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const STEPS = ['1. Address', '2. Payment', '3. Review'];

export default function Checkout() {
  const { cart, cartTotal, discount, clearCartItems } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0); // 0: Address, 1: Payment & Shipping, 2: Review & Confirm
  const [busy, setBusy] = useState(false);

  // Saved Addresses State
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);

  // Address Form State
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [, setVerifiedPhonesList] = useState([]);
  const [verifiedEmailsList, setVerifiedEmailsList] = useState([]);

  const [addrForm, setAddrForm] = useState({
    digipin: '',
    name: '',
    phone: '',
    email: '',
    house_no: '',
    village_town: '',
    landmark: '',
    pincode: '',
    post_office: '',
    district: '',
    division: '',
    region: '',
    state: '',
    country: 'INDIA',
    postal_delivery_status: '',
    address_line: '',
    city: '',
    is_default: false,
  });

  // Pincode Lookup & Serviceability State
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeResolved, setPincodeResolved] = useState(null);
  const [pincodeError, setPincodeError] = useState('');
  const [postOffices, setPostOffices] = useState([]);

  // Shipping & Payment Method
  const [shippingSpeed, setShippingSpeed] = useState('standard'); // 'standard' | 'express'
  const [paymentMethod, setPaymentMethod] = useState('cashfree'); // 'cashfree' | 'razorpay' | 'upi_qr' | 'cod'
  const [upiRef, setUpiRef] = useState('');

  // Coins & Rewards
  const [coinBal, setCoinBal] = useState(0);
  const [coinsToUse, setCoinsToUse] = useState(0);

  const loadSavedAddresses = useCallback(async () => {
    try {
      const [addrRes, profileRes] = await Promise.all([
        getAddresses().catch(() => ({ data: [] })),
        getUserProfile().catch(() => ({ data: null })),
      ]);

      const list = Array.isArray(addrRes.data) ? addrRes.data : [];
      setSavedAddresses(list);

      const profile = profileRes.data;
      const phones = profile?.contacts?.verified_phones || Array.from(new Set(list.map((a) => a.phone).filter(Boolean)));
      const emails = profile?.contacts?.verified_emails || (user?.email ? [user.email] : []);
      setVerifiedPhonesList(phones);
      setVerifiedEmailsList(emails);

      if (phones.length > 0) {
        setAddrForm((prev) => ({ ...prev, phone: phones[0] }));
      }
      if (emails.length > 0) {
        setAddrForm((prev) => ({ ...prev, email: emails[0] }));
      }

      setPhoneVerified(phones.length > 0);
      setEmailVerified(emails.length > 0);
      if (list.length > 0) {
        const def = list.find((a) => a.is_default) || list[0];
        setSelectedAddrId(def.id);
        setShowNewForm(false);
      } else {
        setShowNewForm(true);
      }
    } catch {
      setShowNewForm(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }
    loadSavedAddresses();
    getCoinBalance().then((res) => setCoinBal(res.data?.coin_balance || 0)).catch(() => {});
  }, [user, navigate, loadSavedAddresses]);

  // Handle Pincode Resolution
  const handlePincodeChange = async (pin) => {
    const clean = pin.replace(/\D/g, '').slice(0, 6);
    setAddrForm((prev) => ({
      ...prev,
      pincode: clean,
      post_office: '',
      district: '',
      division: '',
      region: '',
      state: '',
      country: 'INDIA',
      postal_delivery_status: '',
    }));
    setPincodeResolved(null);
    setPincodeError('');
    setPostOffices([]);

    if (clean.length === 6) {
      setPincodeLoading(true);
      try {
        const [lookupRes] = await Promise.all([
          lookupPincode(clean),
          checkServiceability(clean).catch(() => null),
        ]);
        const data = lookupRes.data;
        setPincodeResolved(data);
        setPostOffices(data.post_offices || []);

        let autoPo = '';
        if (data.post_offices && data.post_offices.length === 1) {
          autoPo = data.post_offices[0].name;
        }

        setAddrForm((prev) => ({
          ...prev,
          post_office: autoPo,
          district: data.district,
          division: data.division,
          region: data.region,
          state: data.state,
          country: data.country || 'INDIA',
          postal_delivery_status: data.postal_delivery_status,
          city: prev.village_town || data.district,
        }));
      } catch (err) {
        setPincodeError(err?.response?.data?.detail || 'Invalid Pincode. Please verify.');
      } finally {
        setPincodeLoading(false);
      }
    }
  };

  const handleSendPhoneOtp = async () => {
    if (!addrForm.phone || addrForm.phone.length < 10) return;
    try {
      setBusy(true);
      await sendAddressPhoneOtp(addrForm.phone);
      setPhoneOtpSent(true);
      toast.success('Phone OTP sent');
    } catch (e) {
      toast.error('Failed to send Phone OTP');
    } finally { setBusy(false); }
  };

  const handleVerifyPhoneOtp = async () => {
    try {
      setBusy(true);
      await verifyAddressPhoneOtp(addrForm.phone, phoneOtp);
      setPhoneVerified(true);
      toast.success('Phone verified');
    } catch (e) {
      toast.error('Invalid Phone OTP');
    } finally { setBusy(false); }
  };

  const handleSendEmailOtp = async () => {
    if (!addrForm.email || !addrForm.email.includes('@')) return;
    try {
      setBusy(true);
      await sendAddressEmailOtp(addrForm.email);
      setEmailOtpSent(true);
      toast.success('Email OTP sent');
    } catch (e) {
      toast.error('Failed to send Email OTP');
    } finally { setBusy(false); }
  };

  const handleVerifyEmailOtp = async () => {
    try {
      setBusy(true);
      await verifyAddressEmailOtp(addrForm.email, emailOtp);
      setEmailVerified(true);
      toast.success('Email verified');
    } catch (e) {
      toast.error('Invalid Email OTP');
    } finally { setBusy(false); }
  };

  const handleSaveNewAddress = async () => {
    if (!addrForm.name.trim()) { toast.error('Full Name is required'); return; }
    if (!addrForm.email || !addrForm.email.includes('@')) { toast.error('Valid email is required'); return; }
    if (!phoneVerified) { toast.error('Please verify your phone number first'); return; }
    if (!emailVerified) { toast.error('Please verify your email first'); return; }
    if (!addrForm.phone || addrForm.phone.length < 10) { toast.error('Valid 10-digit phone is required'); return; }
    if (!addrForm.pincode || addrForm.pincode.length !== 6) { toast.error('6-digit pincode is required'); return; }
    if (!addrForm.address_line.trim() && !addrForm.house_no.trim()) { toast.error('Address line is required'); return; }

    const fullLine = addrForm.address_line.trim() || `${addrForm.house_no}, ${addrForm.village_town} ${addrForm.landmark ? `(Near ${addrForm.landmark})` : ''}`.trim();

    try {
      setBusy(true);
      const { data } = await addAddress({
        ...addrForm,
        address_line: fullLine,
        city: addrForm.city || addrForm.district,
        digipin: addrForm.digipin || undefined,
      });
      toast.success('Address saved successfully! ✓');
      await loadSavedAddresses();
      setSelectedAddrId(data.id);
      setShowNewForm(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save address');
    } finally {
      setBusy(false);
    }
  };

  // Calculations
  const items = Array.isArray(cart?.lines) ? cart.lines : [];
  const subtotal = cartTotal || 0;
  const shipping = shippingSpeed === 'express' ? 99 : (subtotal >= 499 ? 0 : 49);
  const tax = Math.round(subtotal * 0.18);
  const maxCoins = Math.min(coinBal, Math.floor((subtotal * 0.5) / 0.01));
  const coinDiscount = parseFloat((coinsToUse * 0.01).toFixed(2));
  const grandTotal = Math.max(0, subtotal - discount - coinDiscount + shipping + tax);

  // Selected address object
  const activeAddress = savedAddresses.find((a) => a.id === selectedAddrId) || savedAddresses[0] || addrForm;

  const loadCashfree = () => {
    return new Promise((resolve) => {
      if (window.Cashfree) { resolve(window.Cashfree); return; }
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.onload = () => resolve(window.Cashfree);
      script.onerror = () => resolve(null);
      document.body.appendChild(script);
    });
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) { resolve(window.Razorpay); return; }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(window.Razorpay);
      script.onerror = () => resolve(null);
      document.body.appendChild(script);
    });
  };

  const handlePlaceOrder = async () => {
    if (!activeAddress || !activeAddress.phone || !activeAddress.pincode) {
      toast.error('Please select or complete your delivery address');
      setStep(0);
      return;
    }

    try {
      setBusy(true);
      const payload = {
        payment_method: paymentMethod,
        coins_to_use: coinsToUse > 0 ? coinsToUse : undefined,
        shipping_speed: shippingSpeed,
        delivery_address: {
          name: activeAddress.name,
          phone: activeAddress.phone,
          email: activeAddress.email || user?.email || 'customer@mahilamadel.store',
          address: activeAddress.address_line || `${activeAddress.house_no || ''} ${activeAddress.village_town || ''}`,
          city: activeAddress.city || activeAddress.district || 'City',
          state: activeAddress.state || 'State',
          pincode: activeAddress.pincode,
          landmark: activeAddress.landmark || undefined,
        },
      };

      const { data } = await checkoutCart(payload);
      const orderId = data.order_id || data.id || data._id;

      // 1. Cashfree Payment Gateway Flow
      if (data.type === 'cashfree' && data.payment_session_id) {
        const CF = await loadCashfree();
        if (!CF) throw new Error('Cashfree SDK failed to initialize');
        const mode = (data.environment || 'sandbox').toLowerCase();
        const cashfree = CF({ mode: mode === 'production' ? 'production' : 'sandbox' });
        cashfree.checkout({
          paymentSessionId: data.payment_session_id,
          redirectTarget: '_modal',
        }).then(async (result) => {
          if (result.error) {
            toast.error(result.error.message || 'Payment cancelled');
          }
          if (result.paymentDetails) {
            await verifyCashfree({ order_id: orderId }).catch(() => {});
            await clearCartItems();
            navigate(`/orders/${orderId}`);
          }
        });
        return;
      }

      // 2. Razorpay Gateway Flow
      if (data.type === 'razorpay' && data.razorpay_order_id) {
        const RZP = await loadRazorpay();
        if (!RZP) throw new Error('Razorpay SDK failed to load');
        const options = {
          key: data.key_id,
          amount: data.amount,
          currency: data.currency || 'INR',
          name: 'Mahila Madel',
          description: `Order #${orderId.slice(0, 8)}`,
          order_id: data.razorpay_order_id,
          prefill: {
            name: activeAddress.name,
            email: activeAddress.email,
            contact: activeAddress.phone,
          },
          theme: { color: '#B5445A' },
          handler: async (response) => {
            await verifyRazorpay({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            await clearCartItems();
            navigate(`/orders/${orderId}`);
          },
        };
        const rzpInstance = new RZP(options);
        rzpInstance.open();
        return;
      }

      // 3. Direct COD or Instant Confirmation
      await clearCartItems();
      toast.success('Order placed successfully! 🎉');
      navigate(`/orders/${orderId}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || e.response?.data?.message || 'Failed to place order');
    } finally {
      setBusy(false);
    }
  };

  const handleUpiSubmit = async () => {
    if (!upiRef || upiRef.trim().length < 8) {
      toast.error('Please enter a valid 12-digit UPI reference / UTR');
      return;
    }
    try {
      setBusy(true);
      await verifyUpiPaid({ order_id: 'pending', upi_transaction_ref: upiRef.trim() }).catch(() => {});
      toast.success('UPI Reference recorded! Finalizing order verification.');
    } catch {
      toast.error('Failed to submit UPI reference');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mm-checkout-page container">
      {/* Checkout Progress Stepper */}
      <div className="mm-checkout-stepper">
        {STEPS.map((label, idx) => (
          <div
            key={label}
            className={`mm-step-item ${idx === step ? 'active' : ''} ${idx < step ? 'completed' : ''}`}
            onClick={() => idx < step && setStep(idx)}
          >
            <div className="mm-step-circle">
              {idx < step ? <FiCheck size={14} /> : idx + 1}
            </div>
            <span className="mm-step-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="mm-checkout-grid">
        {/* Left Column: Flow Steps */}
        <div className="mm-checkout-main">
          {/* ────────────────────────────────────────────────────────── */}
          {/* STEP 0: DELIVERY ADDRESS SELECTION & CREATION              */}
          {/* ────────────────────────────────────────────────────────── */}
          {step === 0 && (
            <div className="mm-checkout-card">
              <div className="mm-card-header">
                <h3><FiMapPin className="mm-header-icon" /> Select Delivery Address</h3>
                {!showNewForm && savedAddresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setShowNewForm(true); setSelectedAddrId(null); }}
                    className="mm-btn-link"
                  >
                    <FiPlus /> Add New Address
                  </button>
                )}
              </div>

              {/* Saved Address Cards */}
              {!showNewForm && savedAddresses.length > 0 && (
                <div className="mm-address-cards-grid">
                  {savedAddresses.map((addr) => (
                    <div
                      key={addr.id}
                      className={`mm-addr-card ${selectedAddrId === addr.id ? 'selected' : ''}`}
                      onClick={() => setSelectedAddrId(addr.id)}
                    >
                      <div className="mm-addr-card-top">
                        <div className="mm-radio-indicator">
                          {selectedAddrId === addr.id && <div className="mm-radio-dot" />}
                        </div>
                        <span className="mm-addr-name">{addr.name}</span>
                        {addr.is_default && <span className="mm-tag-default">Default</span>}
                      </div>
                      <p className="mm-addr-text">{addr.address_line}</p>
                      <p className="mm-addr-city">{addr.city}, {addr.state} - <strong>{addr.pincode}</strong></p>
                      <p className="mm-addr-phone"><FiPhone size={12} /> +91 {addr.phone}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Address Form with Indian Pincode Auto-Resolution */}
              {showNewForm && (
                <div className="mm-address-form-box">
                  <div className="mm-form-row mm-form-row-2">
                    <div className="mm-input-field">
                      <label>FULL NAME *</label>
                      <div className="mm-input-wrap">
                        <FiUser className="mm-input-icon" />
                        <input
                          type="text"
                          placeholder="Receiver's Full Name"
                          value={addrForm.name}
                          onChange={(e) => setAddrForm({ ...addrForm, name: e.target.value })}
                        />
                      </div>
                    </div>

                    
                    <div className="mm-input-field">
                      <label>EMAIL ADDRESS *</label>
                      <div className="mm-input-wrap">
                        <input
                          type="email"
                          placeholder="e.g. user@example.com"
                          value={addrForm.email}
                          list="verified-emails-list"
                          onChange={(e) => { 
                            const val = e.target.value;
                            setAddrForm({ ...addrForm, email: val }); 
                            if (verifiedEmailsList.includes(val)) {
                                setEmailVerified(true);
                            } else {
                                setEmailVerified(false); 
                                setEmailOtpSent(false); 
                            }
                          }}
                          
                        />
                        {!emailVerified && (
                          <button type="button" onClick={handleSendEmailOtp} disabled={busy || emailOtpSent} className="mm-btn-inline">
                            {emailOtpSent ? 'Sent' : 'Verify'}
                          </button>
                        )}
                      </div>
                      {emailOtpSent && !emailVerified && (
                        <div className="mm-input-wrap" style={{ marginTop: 8 }}>
                          <input type="text" placeholder="Enter Email OTP" maxLength={6} value={emailOtp} onChange={e => setEmailOtp(e.target.value)} />
                          <button type="button" onClick={handleVerifyEmailOtp} disabled={busy || emailOtp.length !== 6} className="mm-btn-inline">Confirm</button>
                        </div>
                      )}
                      {emailVerified && <span className="mm-badge-success" style={{ fontSize: 11, marginTop: 4 }}>✓ Verified</span>}
                    </div>

                    <div className="mm-input-field">
                      <label>PHONE NUMBER *</label>
                      <div className="mm-input-wrap mm-phone-wrap">
                        <span className="mm-phone-prefix">+91</span>
                        <input
                          type="tel"
                          maxLength={10}
                          placeholder="10-digit number"
                          value={addrForm.phone}
                          onChange={(e) => { setAddrForm({ ...addrForm, phone: e.target.value.replace(/\D/g, '') }); setPhoneVerified(false); setPhoneOtpSent(false); }}
                          
                        />
                        {!phoneVerified && (
                          <button type="button" onClick={handleSendPhoneOtp} disabled={busy || phoneOtpSent} className="mm-btn-inline">
                            {phoneOtpSent ? 'Sent' : 'Verify'}
                          </button>
                        )}
                      </div>
                      {phoneOtpSent && !phoneVerified && (
                        <div className="mm-input-wrap" style={{ marginTop: 8 }}>
                          <input type="text" placeholder="Enter Phone OTP" maxLength={6} value={phoneOtp} onChange={e => setPhoneOtp(e.target.value)} />
                          <button type="button" onClick={handleVerifyPhoneOtp} disabled={busy || phoneOtp.length !== 6} className="mm-btn-inline">Confirm</button>
                        </div>
                      )}
                      {phoneVerified && <span className="mm-badge-success" style={{ fontSize: 11, marginTop: 4 }}>✓ Verified</span>}
                    </div>
                  </div>

                  <div className="mm-input-field">
                      <label>DIGIPIN (National Grid - Optional)</label>
                      <div className="mm-input-wrap">
                        <input
                          type="text"
                          placeholder="e.g. AB-1234-5678"
                          value={addrForm.digipin || ''}
                          onChange={(e) => setAddrForm({ ...addrForm, digipin: e.target.value.toUpperCase() })}
                        />
                      </div>
                    </div>

                  {/* Pincode with live Postal Serviceability Resolution */}
                  <div className="mm-form-row mm-form-row-2">
                    <div className="mm-input-field">
                      <label>PINCODE (6-DIGIT) *</label>
                      <div className="mm-input-wrap">
                        <input
                          type="tel"
                          maxLength={6}
                          placeholder="e.g. 110001"
                          value={addrForm.pincode}
                          onChange={(e) => handlePincodeChange(e.target.value)}
                          className="mm-pincode-input"
                        />
                        {pincodeLoading && <span className="mm-loader-sm">Verifying...</span>}
                      </div>
                      {pincodeError && <p className="mm-field-error"><FiAlertCircle size={12} /> {pincodeError}</p>}
                    </div>

                    <div className="mm-input-field">
                      <label>POST OFFICE / LOCALITY</label>
                      {postOffices.length > 1 ? (
                        <select
                          value={addrForm.post_office}
                          onChange={(e) => setAddrForm({ ...addrForm, post_office: e.target.value })}
                          className="mm-select-input"
                        >
                          <option value="">Select Post Office</option>
                          {postOffices.map((po) => (
                            <option key={po.name} value={po.name}>{po.name} ({po.delivery_status})</option>
                          ))}
                        </select>
                      ) : (
                        <div className="mm-input-wrap">
                          <input
                            type="text"
                            placeholder="Locality / Area"
                            value={addrForm.post_office || addrForm.village_town}
                            onChange={(e) => setAddrForm({ ...addrForm, post_office: e.target.value, village_town: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resolved Geography */}
                  {pincodeResolved && (
                    <div className="mm-geo-badge">
                      <FiCheckCircle size={14} className="text-success" />
                      <span>{pincodeResolved.district}, {pincodeResolved.state} ({pincodeResolved.postal_delivery_status})</span>
                    </div>
                  )}

                  <div className="mm-input-field">
                    <label>FLAT / HOUSE NO. / BUILDING / STREET ADDRESS *</label>
                    <div className="mm-input-wrap">
                      <input
                        type="text"
                        placeholder="House No, Floor, Building Name, Street"
                        value={addrForm.address_line}
                        onChange={(e) => setAddrForm({ ...addrForm, address_line: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mm-form-row mm-form-row-2">
                    <div className="mm-input-field">
                      <label>CITY / DISTRICT *</label>
                      <div className="mm-input-wrap">
                        <input
                          type="text"
                          placeholder="City"
                          value={addrForm.city || addrForm.district}
                          onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="mm-input-field">
                      <label>STATE *</label>
                      <div className="mm-input-wrap">
                        <input
                          type="text"
                          placeholder="State"
                          value={addrForm.state}
                          onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mm-form-actions">
                    <button
                      type="button"
                      disabled={busy || !addrForm.name || !addrForm.phone || !addrForm.pincode}
                      onClick={handleSaveNewAddress}
                      className="mm-btn mm-btn-primary"
                    >
                      Save & Use Address
                    </button>
                    {savedAddresses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowNewForm(false)}
                        className="mm-btn mm-btn-outline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Continue to Step 2 Button */}
              {!showNewForm && savedAddresses.length > 0 && (
                <div className="mm-card-footer">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="mm-btn mm-btn-primary mm-btn-wide"
                  >
                    Proceed to Payment <FiArrowRight />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* STEP 1: PAYMENT & SHIPPING SPEED                           */}
          {/* ────────────────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="mm-checkout-card">
              {/* Shipping Speed Selection */}
              <div className="mm-card-section">
                <h3><FiTruck className="mm-header-icon" /> Shipping Options</h3>
                <div className="mm-shipping-options-grid">
                  <label className={`mm-option-card ${shippingSpeed === 'standard' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="shippingSpeed"
                      checked={shippingSpeed === 'standard'}
                      onChange={() => setShippingSpeed('standard')}
                    />
                    <div className="mm-option-info">
                      <strong>Standard Express Delivery</strong>
                      <span>Estimated delivery in 3-5 business days</span>
                    </div>
                    <span className="mm-option-price">{subtotal >= 499 ? 'FREE' : '₹49'}</span>
                  </label>

                  <label className={`mm-option-card ${shippingSpeed === 'express' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="shippingSpeed"
                      checked={shippingSpeed === 'express'}
                      onChange={() => setShippingSpeed('express')}
                    />
                    <div className="mm-option-info">
                      <strong>Priority Express (Air Shipping)</strong>
                      <span>Estimated delivery in 1-2 business days</span>
                    </div>
                    <span className="mm-option-price">₹99</span>
                  </label>
                </div>
              </div>

              {/* Coins & Rewards Redemption */}
              {coinBal > 0 && (
                <div className="mm-card-section mm-coins-box">
                  <div className="mm-coins-header">
                    <div>
                      <h4 className="mm-coins-title"><FiDollarSign /> Redeem Zolexora Coins</h4>
                      <p className="mm-coins-subtitle">Balance: <strong>{coinBal} coins</strong> (100 coins = ₹1.00)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCoinsToUse(coinsToUse > 0 ? 0 : maxCoins)}
                      className="mm-btn-sm mm-btn-outline"
                    >
                      {coinsToUse > 0 ? 'Remove' : 'Apply Max'}
                    </button>
                  </div>
                  {coinsToUse > 0 && (
                    <p className="mm-coins-saved">
                      ✓ Saving <strong>{fmt(coinDiscount)}</strong> using {coinsToUse} coins
                    </p>
                  )}
                </div>
              )}

              {/* Payment Gateways Selection */}
              <div className="mm-card-section">
                <h3><FiCreditCard className="mm-header-icon" /> Payment Method</h3>
                <div className="mm-payment-methods-stack">
                  {/* 1. Cashfree Online Payment Gateway */}
                  <label className={`mm-pay-option ${paymentMethod === 'cashfree' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="payMethod"
                      checked={paymentMethod === 'cashfree'}
                      onChange={() => setPaymentMethod('cashfree')}
                    />
                    <div className="mm-pay-info">
                      <strong>Online Payment (UPI, Cards, Netbanking)</strong>
                      <span>Instant confirmation via Cashfree Secure Gateway</span>
                    </div>
                    <span className="mm-pay-badge">Fast & Secure</span>
                  </label>

                  {/* 2. Razorpay Gateway */}
                  <label className={`mm-pay-option ${paymentMethod === 'razorpay' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="payMethod"
                      checked={paymentMethod === 'razorpay'}
                      onChange={() => setPaymentMethod('razorpay')}
                    />
                    <div className="mm-pay-info">
                      <strong>Razorpay Checkout</strong>
                      <span>Pay using GPay, PhonePe, Paytm, Cards</span>
                    </div>
                  </label>

                  {/* 3. Instant UPI QR Code */}
                  <label className={`mm-pay-option ${paymentMethod === 'upi_qr' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="payMethod"
                      checked={paymentMethod === 'upi_qr'}
                      onChange={() => setPaymentMethod('upi_qr')}
                    />
                    <div className="mm-pay-info">
                      <strong><FiSmartphone /> Instant UPI QR Code</strong>
                      <span>Scan with any UPI app and enter 12-digit UTR</span>
                    </div>
                  </label>

                  {/* 4. Cash on Delivery */}
                  <label className={`mm-pay-option ${paymentMethod === 'cod' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="payMethod"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                    />
                    <div className="mm-pay-info">
                      <strong>Cash on Delivery (COD)</strong>
                      <span>Pay cash upon delivery to your doorstep</span>
                    </div>
                  </label>
                </div>

                {/* QR Code details when UPI QR is chosen */}
                {paymentMethod === 'upi_qr' && (
                  <div className="mm-upi-qr-box">
                    <p className="mm-upi-instruction">Scan this QR code using GPay / PhonePe / Paytm / Cred:</p>
                    <div className="mm-qr-frame">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=mahilamadel@upi%26pn=MahilaMadel%26am=${grandTotal}%26cu=INR`}
                        alt="UPI Payment QR Code"
                        className="mm-qr-img"
                      />
                    </div>
                    <div className="mm-utr-input-wrap">
                      <label>ENTER 12-DIGIT UPI REFERENCE / UTR *</label>
                      <div className="mm-input-wrap">
                        <input
                          type="text"
                          maxLength={12}
                          placeholder="e.g. 329182746192"
                          value={upiRef}
                          onChange={(e) => setUpiRef(e.target.value)}
                        />
                        <button type="button" onClick={handleUpiSubmit} className="mm-btn-inline">
                          Submit UTR
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation buttons */}
              <div className="mm-card-footer mm-footer-between">
                <button type="button" onClick={() => setStep(0)} className="mm-btn mm-btn-outline">
                  ← Back to Address
                </button>
                <button type="button" onClick={() => setStep(2)} className="mm-btn mm-btn-primary">
                  Review Order <FiArrowRight />
                </button>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* STEP 2: REVIEW & PLACE ORDER                               */}
          {/* ────────────────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="mm-checkout-card">
              <h3><FiShield className="mm-header-icon" /> Final Order Review</h3>

              {/* Shipping Address Summary */}
              <div className="mm-review-box">
                <div className="mm-review-header">
                  <strong>Delivering To:</strong>
                  <button type="button" onClick={() => setStep(0)} className="mm-btn-link">Change</button>
                </div>
                <p className="mm-review-text">
                  <strong>{activeAddress.name}</strong> (+91 {activeAddress.phone})<br />
                  {activeAddress.address_line}, {activeAddress.city}, {activeAddress.state} - {activeAddress.pincode}
                </p>
              </div>

              {/* Payment & Speed Summary */}
              <div className="mm-review-box">
                <div className="mm-review-header">
                  <strong>Payment & Shipping:</strong>
                  <button type="button" onClick={() => setStep(1)} className="mm-btn-link">Change</button>
                </div>
                <p className="mm-review-text">
                  Method: <strong className="uppercase">{paymentMethod}</strong><br />
                  Speed: <strong>{shippingSpeed === 'express' ? 'Priority Express' : 'Standard Delivery'}</strong>
                </p>
              </div>

              {/* Cart Items Preview */}
              <div className="mm-cart-items-preview">
                <h4>Items in Order ({items.length})</h4>
                <div className="mm-items-list">
                  {items.map((item, idx) => (
                    <div key={item.id || item.product_id || idx} className="mm-preview-item">
                      {item.image && <img src={item.image} alt={item.product_title || 'Item'} className="mm-preview-img" />}
                      <div className="mm-preview-details">
                        <span className="mm-preview-title">{item.product_title || item.name}</span>
                        <span className="mm-preview-qty">Qty: {item.quantity} × {fmt(item.unit_price?.amount_minor ? item.unit_price.amount_minor / 100 : item.price)}</span>
                      </div>
                      <span className="mm-preview-subtotal">
                        {fmt((item.unit_price?.amount_minor ? item.unit_price.amount_minor / 100 : item.price) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Confirmation CTA */}
              <div className="mm-card-footer mm-footer-between">
                <button type="button" onClick={() => setStep(1)} className="mm-btn mm-btn-outline">
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handlePlaceOrder}
                  className="mm-btn mm-btn-primary mm-btn-wide"
                >
                  {busy ? 'Processing Order...' : <>Pay & Place Order ({fmt(grandTotal)}) <FiArrowRight /></>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sticky Price Summary Card */}
        <div className="mm-checkout-sidebar">
          <div className="mm-summary-card">
            <h3>Price Details</h3>

            <div className="mm-summary-row">
              <span>Items Total ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
              <span>{fmt(subtotal)}</span>
            </div>

            {discount > 0 && (
              <div className="mm-summary-row mm-row-discount">
                <span>Coupon Discount</span>
                <span>-{fmt(discount)}</span>
              </div>
            )}

            {coinDiscount > 0 && (
              <div className="mm-summary-row mm-row-discount">
                <span>Coin Redemption</span>
                <span>-{fmt(coinDiscount)}</span>
              </div>
            )}

            <div className="mm-summary-row">
              <span>Delivery Charges</span>
              <span className={shipping === 0 ? 'text-success' : ''}>
                {shipping === 0 ? 'FREE' : fmt(shipping)}
              </span>
            </div>

            <div className="mm-summary-row">
              <span>Estimated GST (18%)</span>
              <span>{fmt(tax)}</span>
            </div>

            <div className="mm-summary-divider" />

            <div className="mm-summary-total">
              <strong>Total Payable</strong>
              <strong className="mm-total-amount">{fmt(grandTotal)}</strong>
            </div>

            <div className="mm-secure-badge">
              <FiLock size={14} /> <span>100% Secure & Encrypted Checkout</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
