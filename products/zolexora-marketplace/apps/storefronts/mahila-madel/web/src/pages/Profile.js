import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile, getAddresses, addAddress, deleteAddress } from '../utils/api';
import { toast } from 'react-toastify';
import './Profile.css';

const EMPTY_ADDRESS = { name: '', email: '', phone: '', digipin: '', address_line: '', city: '', state: '', pincode: '' };

export default function Profile() {
  const { user, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('info');
  const [name, setName] = useState(user?.name || '');
  const [addresses, setAddresses] = useState([]);
  const [addrForm, setAddrForm] = useState(EMPTY_ADDRESS);
  const [saving, setSaving] = useState(false);
  const [showAddrForm, setShowAddrForm] = useState(false);

  const loadAddresses = useCallback(async () => {
    try {
      const { data } = await getAddresses();
      setAddresses(Array.isArray(data) ? data : []);
    } catch { setAddresses([]); }
  }, []);

  useEffect(() => { loadAddresses(); }, [loadAddresses]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      await refreshProfile();
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed');
    } finally { setSaving(false); }
  };

  const handleAddAddr = async (e) => {
    e.preventDefault();
    try {
      await addAddress({ ...addrForm, email: addrForm.email || undefined, digipin: addrForm.digipin || undefined });
      await loadAddresses();
      setShowAddrForm(false);
      setAddrForm(EMPTY_ADDRESS);
      toast.success('Address added!');
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to add address');
    }
  };

  const handleDeleteAddr = async (id) => {
    if (!window.confirm('Delete this address?')) return;
    try {
      await deleteAddress(id);
      await loadAddresses();
      toast.info('Address removed');
    } catch { toast.error('Failed to delete'); }
  };

  const field = (key, label, props = {}) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-control" value={addrForm[key]} onChange={e => setAddrForm(f => ({ ...f, [key]: e.target.value }))} {...props} />
    </div>
  );

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
                <div className="form-group"><label className="form-label">Full Name</label><input className="form-control" value={name} onChange={e => setName(e.target.value)} required /></div>
                <div className="form-row-2">
                  <div className="form-group"><label className="form-label">Email Address</label><input className="form-control" value={user?.email || ''} disabled /></div>
                  <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={user?.phone_number || ''} disabled /></div>
                </div>
                <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
                  Email, phone and password belong to your Zolexora account. To change your password, sign out and use “Forgot password?”.
                </p>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </form>
            </div>
          )}

          {activeTab === 'address' && (
            <div>
              <div className="profile-section-head">
                <h2>Saved Addresses</h2>
                <button className="btn btn-outline btn-sm" onClick={() => setShowAddrForm(p => !p)}>+ Add New</button>
              </div>

              {showAddrForm && (
                <form onSubmit={handleAddAddr} className="addr-form card" style={{ padding: 16, marginBottom: 20 }}>
                  <h4 style={{ marginBottom: 12 }}>New Address</h4>
                  <div className="form-row-2">
                    {field('name', 'Name', { required: true })}
                    {field('email', 'Email (Optional)', { type: 'email' })}
                    {field('phone', 'Phone', { type: 'tel', required: true })}
                  </div>
                  <div className="form-row-2">
                    {field('address_line', 'Address', { required: true })}
                    {field('digipin', 'DIGIPIN (Optional)', { placeholder: 'e.g. AB-1234-5678' })}
                  </div>
                  <div className="form-row-3">
                    {field('city', 'City', { required: true })}
                    {field('state', 'State', { required: true })}
                    {field('pincode', 'Pincode', { required: true, inputMode: 'numeric', pattern: '\\d{6}' })}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" className="btn btn-primary btn-sm">Save Address</button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddrForm(false)}>Cancel</button>
                  </div>
                </form>
              )}

              {addresses.length === 0 ? (
                <p className="text-muted" style={{ fontSize: 14 }}>No saved addresses yet.</p>
              ) : (
                <div className="addresses-list">
                  {addresses.map(a => (
                    <div key={a.id} className="addr-card">
                      <p className="fw-500">{a.name} · {a.phone}</p>
                      <p className="fs-13">{a.address_line}</p>
                      <p className="fs-13">{a.city}, {a.state} - {a.pincode}</p>
                      <button className="addr-del-btn" onClick={() => handleDeleteAddr(a.id)}>Remove</button>
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
