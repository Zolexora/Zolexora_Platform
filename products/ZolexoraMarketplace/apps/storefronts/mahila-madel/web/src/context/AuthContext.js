import { createContext, useContext, useState, useCallback } from 'react';
import { loginUser, registerUser, verifyRegister, resendOtp, getProfile, logoutUser } from '../utils/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shopkart_user') || 'null'); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const saveUser = (u) => {
    setUser(u);
    localStorage.setItem('shopkart_user', JSON.stringify(u));
  };

  const login = async (email, password) => {
    setLoading(true); setError(null);
    try {
      const { data } = await loginUser({ email, password });
      saveUser(data.user);
      return data;
    } catch (e) {
      const msg = e.response?.data?.detail || e.response?.data?.message || 'Login failed';
      setError(msg); throw e;
    } finally { setLoading(false); }
  };

  const register = async (name, email, password) => {
    setLoading(true); setError(null);
    try {
      const { data } = await registerUser({ name, email, password });
      return data;
    } catch (e) {
      const msg = e.response?.data?.detail || e.response?.data?.message || 'Registration failed';
      setError(msg); throw e;
    } finally { setLoading(false); }
  };

  const verifyOtp = async (email, otp) => {
    setLoading(true); setError(null);
    try {
      const { data } = await verifyRegister({ email, otp });
      if (data.user) {
        saveUser(data.user);
      }
      return data;
    } catch (e) {
      const msg = e.response?.data?.detail || e.response?.data?.message || 'Verification failed';
      setError(msg); throw e;
    } finally { setLoading(false); }
  };

  const resendVerificationOtp = async (email) => {
    setLoading(true); setError(null);
    try {
      const { data } = await resendOtp(email);
      return data;
    } catch (e) {
      const msg = e.response?.data?.detail || e.response?.data?.message || 'Failed to resend code';
      setError(msg); throw e;
    } finally { setLoading(false); }
  };

  const logout = () => {
    void logoutUser();
    setUser(null);
    localStorage.removeItem('shopkart_user');
  };

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await getProfile();
      saveUser({ ...user, ...data });
    } catch {}
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, verifyOtp, resendVerificationOtp, logout, refreshProfile, setError, saveUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
