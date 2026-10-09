import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile, addAddress, deleteAddress, sendAddressPhoneOtp, verifyAddressPhoneOtp, sendAddressEmailOtp, verifyAddressEmailOtp } from '../utils/api';
import { toast } from 'react-toastify';
import './Profile.css';

export default function Profile() {
  const { user, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('info');
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', password: '', newPassword: '' });
  const [addrForm, setAddrForm] = useState({ name: '', email: '', phone: '', digipin: '', address: '', city: '', state: '', pincode: '', type: 'Home' });
  const [saving, setSaving] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(true);
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true);
  const [showAddrForm, setShowAddrForm] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ name: form.name, email: form.email, phone: form.phone, ...(form.newPassword && { password: form.newPassword }) });
      await refreshProfile();
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  const handleSendPhoneOtp = async () => {
    if (!addrForm.phone) return;
    try {
      await sendAddressPhoneOtp(addrForm.phone);
      setPhoneOtpSent(true);
      toast.success('Phone OTP sent');
    } catch { toast.error('Failed to send Phone OTP'); }
  };

  const handleVerifyPhoneOtp = async () => {
    try {
      await verifyAddressPhoneOtp(addrForm.phone, phoneOtp);
      setPhoneVerified(true);
      toast.success('Phone verified');
    } catch { toast.error('Invalid Phone OTP'); }
  };

  const handleSendEmailOtp = async () => {
    if (!addrForm.email) return;
    try {
      await sendAddressEmailOtp(addrForm.email);
      setEmailOtpSent(true);
      toast.success('Email OTP sent');
    } catch { toast.error('Failed to send Email OTP'); }
  };

  const handleVerifyEmailOtp = async () => {
    try {
      await verifyAddressEmailOtp(addrForm.email, emailOtp);
      setEmailVerified(true);
      toast.success('Email verified');
    } catch { toast.error('Invalid Email OTP'); }
  };

  const handleAddAddr = async (e) => {
    if (!phoneVerified) { e.preventDefault(); toast.error("Please verify phone number"); return; }
    if (!emailVerified) { e.preventDefault(); toast.error("Please verify email address"); return; }
    e.preventDefault();
    try {
      await addAddress(addrForm);
      await refreshProfile();
      setShowAddrForm(false);
      setAddrForm({ name: '', email: '', phone: '', digipin: '', address: '', city: '', state: '', pincode: '', type: 'Home' });
      toast.success('Address added!');
    } catch (err) { toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to add address'); }
  };

  const handleDeleteAddr = async (id) => {
    if (!window.confirm('Delete this address?')) return;
    try {
      await deleteAddress(id);
      await refreshProfile();
      toast.info('Address removed');
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="profile-page container">
      <div className="profile-layout">
        <aside className="profile-sidebar card">
          <div className="profile-avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <p className="profile-name">{user?.name}</p>
          <p className="profile-email">{user?.email}</p>
          <nav className="profile-nav">
            {[
              { key: 'info', label: 'Personal Info', icon: '👤' },
              { key: 'address', label: 'Addresses', icon: '📍' },
              { key: 'security', label: 'Password', icon: '🔒' },
            ].map(t => (
              <button key={t.key} className={`pnav-item ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="profile-main card">
          {activeTab === 'info' && (
            <div>
              <h2>Personal Information</h2>
              <form onSubmit={handleProfileSave}>
                <div className="form-row-2">
                  <div className="form-group"><label className="form-label">Full Name</label><input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210" /></div>
                </div>
                <div className="form-group"><label className="form-label">Email Address</label><input className="form-control" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h2>Change Password</h2>
              <form onSubmit={handleProfileSave}>
                <div className="form-group"><label className="form-label">New Password</label><input type="password" className="form-control" value={form.newPassword} onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))} placeholder="Min 6 characters" /></div>
                <button type="submit" className="btn btn-primary" disabled={saving || !form.newPassword}>{saving ? 'Saving...' : 'Update Password'}</button>
              </form>
            </div>
          )}

          {activeTab === 'address' && (
            <div>
              <div className="profile-section-head">
                <h2>Saved Addresses</h2>
                <button className="btn btn-outline btn-sm" onClick={() => {
                  setShowAddrForm(p => !p);
                  setPhoneVerified(false);
                  setEmailVerified(false);
                  setPhoneOtpSent(false);
                  setEmailOtpSent(false);
                }}>+ Add New</button>
              </div>

              {showAddrForm && (
                <form onSubmit={handleAddAddr} className="addr-form card" style={{ padding: 16, marginBottom: 20 }}>
                  <h4 style={{ marginBottom: 12 }}>New Address</h4>
                  <div className="form-row-2">
                    <div className="form-group"><label className="form-label">Name</label><input className="form-control" value={addrForm.name} onChange={e => setAddrForm(f => ({ ...f, name: e.target.value }))} required /></div>
                    <div className="form-group"><label className="form-label">Email</label>
                      <div style={{display:'flex',gap:5}}>
                        <input className="form-control" value={addrForm.email} list="profile-verified-emails" onChange={e => {
                          const val = e.target.value;
                          setAddrForm(f => ({ ...f, email: val })); 
                          const knownEmails = user?.addresses?.map(a => a.email).filter(Boolean) || [];
                          if (user?.email) knownEmails.push(user.email);
                          if (knownEmails.includes(val)) {
                              setEmailVerified(true);
                          } else {
                              setEmailVerified(false); setEmailOtpSent(false);
                          }
                        }}  required />
                        {!emailVerified && <button type="button" className="btn btn-outline btn-sm" onClick={handleSendEmailOtp}>{emailOtpSent ? 'Sent' : 'Verify'}</button>}
                      </div>
                      {emailOtpSent && !emailVerified && <div style={{display:'flex',gap:5,marginTop:5}}>
                        <input className="form-control" placeholder="OTP" maxLength={6} value={emailOtp} onChange={e => setEmailOtp(e.target.value)} />
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleVerifyEmailOtp}>OK</button>
                      </div>}
                    </div>
                    <div className="form-group"><label className="form-label">Phone</label>
                      <div style={{display:'flex',gap:5}}>
                        <input className="form-control" value={addrForm.phone} list="profile-verified-phones" onChange={e => {
                          const val = e.target.value;
                          setAddrForm(f => ({ ...f, phone: val })); 
                          const knownPhones = user?.addresses?.map(a => a.phone).filter(Boolean) || [];
                          if (user?.phone) knownPhones.push(user.phone);
                          if (knownPhones.includes(val)) {
                              setPhoneVerified(true);
                          } else {
                              setPhoneVerified(false); setPhoneOtpSent(false);
                          }
                        }}  required />
                        {!phoneVerified && <button type="button" className="btn btn-outline btn-sm" onClick={handleSendPhoneOtp}>{phoneOtpSent ? 'Sent' : 'Verify'}</button>}
                      </div>
                      {phoneOtpSent && !phoneVerified && <div style={{display:'flex',gap:5,marginTop:5}}>
                        <input className="form-control" placeholder="OTP" maxLength={6} value={phoneOtp} onChange={e => setPhoneOtp(e.target.value)} />
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleVerifyPhoneOtp}>OK</button>
                      </div>}
                    </div>
                  </div>
                  <div className="form-row-2">
                      <div className="form-group"><label className="form-label">Address</label><input className="form-control" value={addrForm.address} onChange={e => setAddrForm(f => ({ ...f, address: e.target.value }))} required /></div>
                      <div className="form-group"><label className="form-label">DIGIPIN (Optional)</label><input className="form-control" placeholder="e.g. AB-1234-5678" value={addrForm.digipin || ''} onChange={e => setAddrForm(f => ({ ...f, digipin: e.target.value.toUpperCase() }))} /></div>
                    </div>
                  <div className="form-row-3">
                    <div className="form-group"><label className="form-label">City</label><input className="form-control" value={addrForm.city} onChange={e => setAddrForm(f => ({ ...f, city: e.target.value }))} required /></div>
                    <div className="form-group"><label className="form-label">State</label><input className="form-control" value={addrForm.state} onChange={e => setAddrForm(f => ({ ...f, state: e.target.value }))} required /></div>
                    <div className="form-group"><label className="form-label">Pincode</label><input className="form-control" value={addrForm.pincode} onChange={e => setAddrForm(f => ({ ...f, pincode: e.target.value }))} required /></div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <div style={{ display: 'flex', gap: 12 }}>
                      {['Home', 'Work'].map(t => (
                        <label key={t} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
                          <input type="radio" name="atype" checked={addrForm.type === t} onChange={() => setAddrForm(f => ({ ...f, type: t }))} /> {t}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" className="btn btn-primary btn-sm">Save Address</button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddrForm(false)}>Cancel</button>
                  </div>
                </form>
              )}

              {user?.addresses?.length === 0 ? (
                <p className="text-muted" style={{ fontSize: 14 }}>No saved addresses yet.</p>
              ) : (
                <div className="addresses-list">
                  {user?.addresses?.map(a => (
                    <div key={a._id} className="addr-card">
                      <div className="addr-type-badge"><span className="badge badge-primary">{a.type}</span></div>
                      <p className="fw-500">{a.name} · {a.phone}</p>
                      <p className="fs-13">{a.address}</p>
                      <p className="fs-13">{a.city}, {a.state} - {a.pincode}</p>
                      <button className="addr-del-btn" onClick={() => handleDeleteAddr(a._id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
