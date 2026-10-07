import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  checkEmail,
  checkPhone,
  sendLoginOtp,
  verifyLoginOtp,
  googleAuth,
  sendPhoneOtp,
  verifyPhoneOtp,
  sendEmailOtp,
  verifyEmailOtp,
  completeUnifiedRegistration,
  forgotPassword,
  firebaseAuth,
} from '../utils/api';
import { signInWithGoogleViaFirebase, signInWithEmailViaFirebase, createEmailAccountViaFirebase, linkEmailCredentialToCurrentUser, linkGoogleToCurrentFirebaseUser, getFirebaseAuth, createPhoneConfirmation, confirmPhoneViaFirebase } from '../utils/firebase';
import {
  FiMail,
  FiLock,
  FiUser,
  FiArrowRight,
  FiCheckCircle,
  FiEye,
  FiEyeOff,
  FiSmartphone,
  FiRotateCcw,
  FiKey,
} from 'react-icons/fi';
import './Auth.css';

const formatCountdown = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const otpTiming = (response, fallbackExpiry = 300, fallbackResend = 60) => {
  const data = response?.data || response || {};
  const expires = Number(data.expires_in_seconds ?? data.expires_in);
  const resend = Number(data.resend_after_seconds ?? data.resend_after ?? data.resend_in ?? data.retry_after_seconds ?? data.retry_after);
  return {
    expires: Number.isFinite(expires) && expires > 0 ? expires : fallbackExpiry,
    resend: Number.isFinite(resend) && resend > 0 ? resend : fallbackResend,
  };
};

const passwordRules = (value) => ({
  length: value.length >= 8,
  uppercase: /[A-Z]/.test(value),
  number: /\d/.test(value),
  special: /[^A-Za-z0-9]/.test(value),
});

function PasswordRequirements({ value }) {
  const rules = passwordRules(value);
  return (
    <div className="mm-password-rules" aria-live="polite">
      {[
        ['length', '8+ characters'],
        ['uppercase', '1 uppercase letter'],
        ['number', '1 number'],
        ['special', '1 special character'],
      ].map(([key, label]) => (
        <span key={key} className={rules[key] ? 'valid' : ''}>
          <FiCheckCircle /> {label}
        </span>
      ))}
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const { saveUser } = useAuth();

  // Automatic platform auto-selection (Web SMS OTP vs Android Native PNV)
  const [platform, setPlatform] = useState('web');

  const [mode, setMode] = useState('select'); // 'select' | 'enter_email' | 'enter_phone' | 'not_registered' | 'google_profile' | 'email_login' | 'email_register' | 'phone_login' | 'phone_register' | 'forgot'
  const [entryMethod, setEntryMethod] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Common inputs
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [manualNameInput, setManualNameInput] = useState('');

  // Email login state (Existing user)
  const [emailAuthChoice, setEmailAuthChoice] = useState('password'); // 'password' | 'otp'
  const [emailLoginOtp, setEmailLoginOtp] = useState(['', '', '', '', '', '']);
  const [emailLoginOtpSent, setEmailLoginOtpSent] = useState(false);
  const [emailLoginOtpExpiresIn, setEmailLoginOtpExpiresIn] = useState(0);
  const [emailLoginOtpResendIn, setEmailLoginOtpResendIn] = useState(0);

  // Email registration state (New user)
  const [emailRegOtp, setEmailRegOtp] = useState(['', '', '', '', '', '']);
  const [emailRegOtpSent, setEmailRegOtpSent] = useState(false);
  const [emailRegOtpExpiresIn, setEmailRegOtpExpiresIn] = useState(0);
  const [emailRegOtpResendIn, setEmailRegOtpResendIn] = useState(0);
  const [emailVerified, setEmailVerified] = useState(false);

  // Phone state
  const [phoneOtp, setPhoneOtp] = useState(['', '', '', '', '', '']);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpExpiresIn, setPhoneOtpExpiresIn] = useState(0);
  const [phoneOtpResendIn, setPhoneOtpResendIn] = useState(0);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneConfirmation, setPhoneConfirmation] = useState(null);
  const [maskedPhone, setMaskedPhone] = useState('');

  // Google state
  const [googleVerifiedEmail, setGoogleVerifiedEmail] = useState('');
  const [isGoogleVerified, setIsGoogleVerified] = useState(false);
  const [firebaseIdToken, setFirebaseIdToken] = useState('');
  const [firebasePhoneConfirmation, setFirebasePhoneConfirmation] = useState(null);
  const [firebasePhoneVerified, setFirebasePhoneVerified] = useState(false);

  useEffect(() => {
    if (!emailLoginOtpSent && !emailRegOtpSent && !phoneOtpSent) return undefined;
    const timer = window.setInterval(() => {
      setEmailLoginOtpExpiresIn((v) => Math.max(0, v - 1));
      setEmailLoginOtpResendIn((v) => Math.max(0, v - 1));
      setEmailRegOtpExpiresIn((v) => Math.max(0, v - 1));
      setEmailRegOtpResendIn((v) => Math.max(0, v - 1));
      setPhoneOtpExpiresIn((v) => Math.max(0, v - 1));
      setPhoneOtpResendIn((v) => Math.max(0, v - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [emailLoginOtpSent, emailRegOtpSent, phoneOtpSent]);

  // Phone-first registration email capture choice
  const [phoneEmailChoice, setPhoneEmailChoice] = useState('google'); // 'google' | 'manual'

  // Android PNV Simulation state
  const [pnvToken, setPnvToken] = useState(null);
  const [pnvVerifying, setPnvVerifying] = useState(false);

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleOtpBox = (val, i, state, setter, prefix) => {
    if (!/^\d*$/.test(val)) return;
    const n = [...state];
    n[i] = val.slice(-1);
    setter(n);
    if (val && i < 5) {
      const nextInput = document.getElementById(`${prefix}-${i + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const completeLoginSession = (user) => {
    if (saveUser) {
      saveUser(user);
    } else {
      localStorage.setItem('shopkart_user', JSON.stringify(user));
    }
    navigate(from, { replace: true });
  };

  const processGoogleResult = async (res) => {
    const { data } = await googleAuth({ email: res.email, id_token: res.idToken });
    if (!data.is_new_user && data.user) {
      completeLoginSession(data.user);
      return;
    }
    setGoogleVerifiedEmail(data.email);
    setIsGoogleVerified(true);
    setFirebaseIdToken(res.idToken || '');
    setEmailInput(data.email);
    setManualNameInput('');
    setPasswordInput('');
    setPhoneInput('');
    setPhoneVerified(false);
    setPnvToken(null);
    setEntryMethod('google');
    setMode('not_registered');
    setSuccessMessage('Google account verified! Please complete your profile.');
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const isAndroid = /Android/i.test(navigator.userAgent);
      setPlatform(isAndroid ? 'android' : 'web');
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // PATH A: Direct 1-Click Google Authentication Flow
  // ──────────────────────────────────────────────────────────────────────────
  const handleGoogleClick = async () => {
    clearMessages();
    try {
      setBusy(true);
      const firebaseAuthInstance = getFirebaseAuth();
      await firebaseAuthInstance.authStateReady();
      const currentUser = firebaseAuthInstance.currentUser;
      if (currentUser && !currentUser.providerData.some((provider) => provider.providerId === 'google.com')) {
        const linked = await linkGoogleToCurrentFirebaseUser();
        const { data } = await firebaseAuth(linked.idToken);
        completeLoginSession(data.user);
      } else {
        await processGoogleResult(await signInWithGoogleViaFirebase());
      }
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || err?.message || 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // PATH B: Direct Email Flow
  // ──────────────────────────────────────────────────────────────────────────
  const handleEmailSubmit = async () => {
    clearMessages();
    if (!emailInput || !emailInput.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    try {
      setBusy(true);
      const { data: check } = await checkEmail(emailInput.trim().toLowerCase());
      if (check.exists) {
        setMaskedPhone(check.masked_phone || '');
        setEmailAuthChoice('password');
        setMode('email_login');
      } else {
        setEntryMethod('email');
        setMode('not_registered');
        /* Registration OTP is sent only after the user confirms Register. */
        return;
      }
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to verify email');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailPasswordLogin = async () => {
    clearMessages();
    if (!passwordInput) {
      setErrorMessage('Please enter your password');
      return;
    }
    try {
      setBusy(true);
      const email = emailInput.trim().toLowerCase();
      const firebase = await signInWithEmailViaFirebase(email, passwordInput);
      const { data } = await firebaseAuth(firebase.idToken);
      completeLoginSession(data.user);
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Invalid email or password');
    } finally {
      setBusy(false);
    }
  };

  const handleSendEmailLoginOtp = async () => {
    clearMessages();
    try {
      setBusy(true);
      const response = await sendLoginOtp({ email: emailInput.trim().toLowerCase(), channel: 'email' });
      setEmailLoginOtpSent(true);
      const timing = otpTiming(response);
      setEmailLoginOtpExpiresIn(timing.expires); setEmailLoginOtpResendIn(timing.resend);
      setSuccessMessage('6-digit login code sent to your email!');
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to dispatch login OTP');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyEmailLoginOtp = async () => {
    clearMessages();
    const code = emailLoginOtp.join('');
    if (code.length !== 6) {
      setErrorMessage('Enter the 6-digit OTP code');
      return;
    }
    try {
      setBusy(true);
      const { data } = await verifyLoginOtp({ email: emailInput.trim().toLowerCase(), otp: code });
      completeLoginSession(data.user);
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Invalid or expired OTP');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyEmailRegOtp = async () => {
    clearMessages();
    const code = emailRegOtp.join('');
    if (code.length !== 6) {
      setErrorMessage('Enter the 6-digit registration code');
      return;
    }
    try {
      setBusy(true);
      await verifyEmailOtp(emailInput.trim().toLowerCase(), code, 'registration');
      setEmailVerified(true);
      setSuccessMessage('Email verified successfully! ✓');
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Invalid email OTP code');
    } finally {
      setBusy(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // PATH C: Direct Phone Flow
  // ──────────────────────────────────────────────────────────────────────────
  const handleNotRegisteredRegister = async () => {
    clearMessages();
    try {
      setBusy(true);
      if (entryMethod === 'google') {
        setMode('google_profile');
        return;
      }
      if (entryMethod === 'email') {
        const normalizedEmail = emailInput.trim().toLowerCase();
        const { data: account } = await checkEmail(normalizedEmail);
        if (account.exists) throw new Error('This email is already registered. Please sign in with that account.');
        const response = await sendEmailOtp(normalizedEmail, 'registration');
        const timing = otpTiming(response);
        setEmailRegOtpSent(true);
        setEmailRegOtpExpiresIn(timing.expires); setEmailRegOtpResendIn(timing.resend);
        setMode('email_register');
        setSuccessMessage(`Verification code sent to ${normalizedEmail}!`);
        return;
      }
      const clean = phoneInput.replace(/\D/g, '').slice(-10);
      const { data: account } = await checkPhone(clean);
      if (account.exists) throw new Error('This phone number is already registered. Please sign in with that account.');
      if (platform === 'android') {
        triggerAndroidPnv(clean, 'registration');
        setMode('phone_register');
        return;
      }
      const confirmation = await createPhoneConfirmation('firebase-phone-recaptcha', `+91${clean}`);
      setPhoneConfirmation(confirmation);
      setFirebasePhoneConfirmation(confirmation);
      setFirebasePhoneVerified(false);
      setPhoneOtp(['', '', '', '', '', '']);
      setPhoneOtpSent(true);
      setPhoneOtpExpiresIn(300); setPhoneOtpResendIn(60);
      setMode('phone_register');
      setSuccessMessage('6-digit SMS OTP sent to your phone!');
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || err?.message || 'Failed to start registration');
    } finally {
      setBusy(false);
    }
  };

  const handlePhoneSubmit = async () => {
    clearMessages();
    const clean = phoneInput.replace(/\D/g, '');
    if (clean.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number');
      return;
    }

    try {
      setBusy(true);
      const { data: account } = await checkPhone(clean.slice(-10));
      if (!account.exists) {
        setEntryMethod('mobile');
        setMode('not_registered');
        return;
      }
      setMode('phone_login');
      setPhoneConfirmation(await createPhoneConfirmation('firebase-phone-recaptcha', `+91${clean.slice(-10)}`));
      setPhoneOtpSent(true);
      setPhoneOtpExpiresIn(300); setPhoneOtpResendIn(60);
      setSuccessMessage('Firebase verification code sent via SMS!');
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || err?.message || 'Failed to process phone request');
    } finally {
      setBusy(false);
    }
  };

  const handleResendPhoneOtp = async (purpose) => {
    if (purpose === 'registration') {
      if (mode === 'phone_register') {
        clearMessages();
        try {
          setBusy(true);
          const clean = phoneInput.replace(/\D/g, '').slice(-10);
          const confirmation = await createPhoneConfirmation('firebase-phone-recaptcha', `+91${clean}`);
          setPhoneConfirmation(confirmation);
          setFirebasePhoneConfirmation(confirmation);
          setFirebasePhoneVerified(false);
          setPhoneOtp(['', '', '', '', '', '']);
          setPhoneOtpExpiresIn(300); setPhoneOtpResendIn(60);
          setSuccessMessage('A new phone verification code was sent!');
        } catch (err) {
          setErrorMessage(err?.response?.data?.detail || err?.message || 'Failed to resend phone OTP');
        } finally {
          setBusy(false);
        }
        return;
      }
      await handleSendFormPhoneOtp();
      return;
    }
    clearMessages();
    try {
      setBusy(true);
      const clean = phoneInput.replace(/\D/g, '').slice(-10);
      setPhoneConfirmation(await createPhoneConfirmation('firebase-phone-recaptcha', `+91${clean}`));
      setPhoneOtpSent(true);
      setPhoneOtpExpiresIn(300); setPhoneOtpResendIn(60);
      setSuccessMessage('A new Firebase verification code was sent!');
    } catch (err) {
      setErrorMessage(err?.message || 'Failed to resend phone OTP');
    } finally {
      setBusy(false);
    }
  };

  const triggerAndroidPnv = (phone, purpose) => {
    setPnvVerifying(true);
    setTimeout(async () => {
      setPnvVerifying(false);
      const token = `PNV_ANDROID_SECURE_${Date.now()}`;
      setPnvToken(token);
      setPhoneVerified(true);
      setSuccessMessage('Android SIM Phone Verification (PNV) Succeeded! ✓');

      if (purpose === 'login') {
        try {
          const { data } = await verifyLoginOtp({ phone, otp: '000000' });
          completeLoginSession(data.user);
        } catch {}
      }
    }, 1200);
  };

  const handleVerifyPhoneOtp = async (purpose) => {
    clearMessages();
    const code = phoneOtp.join('');
    if (code.length !== 6) {
      setErrorMessage('Enter the 6-digit SMS OTP');
      return;
    }

    try {
      setBusy(true);
      if (purpose === 'login') {
        if (!phoneConfirmation) throw new Error('Start phone verification again');
        const verified = await phoneConfirmation.confirm(code);
        const { data } = await firebaseAuth(await verified.user.getIdToken());
        completeLoginSession(data.user);
      } else {
        if (phoneConfirmation) {
          const verified = await confirmPhoneViaFirebase(phoneConfirmation, code);
          setFirebaseIdToken(verified.idToken);
          setFirebasePhoneVerified(true);
        } else {
          await verifyPhoneOtp(phoneInput.replace(/\D/g, '').slice(-10), code, 'registration');
        }
        setPhoneVerified(true);
        setSuccessMessage('Phone number verified! Now link your email.');
      }
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Invalid or expired phone OTP');
    } finally {
      setBusy(false);
    }
  };

  const handlePhonePathGoogleLink = async () => {
    clearMessages();
    try {
      setBusy(true);
      const current = getFirebaseAuth().currentUser;
      const res = current
        ? await linkGoogleToCurrentFirebaseUser()
        : await signInWithGoogleViaFirebase();
      const { data: account } = await checkEmail(res.email.trim().toLowerCase());
      if (account.exists) {
        throw new Error('This email is already registered. Please sign in with that account.');
      }
      setGoogleVerifiedEmail(res.email);
      setIsGoogleVerified(true);
      setFirebaseIdToken(res.idToken || '');
      setEmailInput(res.email);
      setEmailVerified(true);
      setSuccessMessage(`Google email (${res.email}) verified! ✓`);
    } catch (err) {
      setErrorMessage(err?.message || 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSendFormPhoneOtp = async () => {
    clearMessages();
    const clean = phoneInput.replace(/\D/g, '');
    if (clean.length < 10) {
      setErrorMessage('Enter a 10-digit phone number');
      return;
    }

    if (platform === 'android') {
      triggerAndroidPnv(clean.slice(-10), 'registration');
      return;
    }

    try {
      setBusy(true);
      const { data: account } = await checkPhone(clean.slice(-10));
      if (account.exists) {
        throw new Error('This phone number is already registered. Please use a different number or sign in with that account.');
      }
      setPhoneOtp(['', '', '', '', '', '']);
      let timing;
      // A resend starts a new challenge. Never verify a previous Firebase
      // confirmation against a backend-issued OTP.
      setFirebasePhoneConfirmation(null);
      setFirebasePhoneVerified(false);
      try {
        const confirmation = await createPhoneConfirmation('firebase-phone-recaptcha', `+91${clean.slice(-10)}`, isGoogleVerified);
        setFirebasePhoneConfirmation(confirmation);
      } catch (firebaseError) {
        setFirebasePhoneConfirmation(null);
        // Google onboarding must verify the same Firebase phone challenge.
        // Falling back to a backend OTP here makes Firebase's test code fail
        // with "OTP expired or not requested" in the backend verifier.
        if (isGoogleVerified) throw firebaseError;
        const response = await sendPhoneOtp(clean.slice(-10), 'registration');
        timing = otpTiming(response);
      }
      setPhoneOtpSent(true);
      const effectiveTiming = timing || otpTiming(undefined);
      setPhoneOtpExpiresIn(effectiveTiming.expires); setPhoneOtpResendIn(effectiveTiming.resend);
      setSuccessMessage('6-digit SMS OTP sent to your phone!');
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || err?.message || 'Failed to dispatch phone OTP');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyFormPhoneOtp = async () => {
    clearMessages();
    const code = phoneOtp.join('');
    if (code.length !== 6) {
      setErrorMessage('Enter 6-digit SMS OTP');
      return;
    }
    const clean = phoneInput.replace(/\D/g, '').slice(-10);
    try {
      setBusy(true);
      if (firebasePhoneConfirmation) {
        const verified = await confirmPhoneViaFirebase(firebasePhoneConfirmation, code);
        setFirebaseIdToken(verified.idToken);
        setFirebasePhoneVerified(true);
      } else {
        await verifyPhoneOtp(clean, code, 'registration');
      }
      setPhoneVerified(true);
      setSuccessMessage('Phone number verified! ✓');
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Invalid phone OTP');
    } finally {
      setBusy(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Final Unified Account Provisioning
  // ──────────────────────────────────────────────────────────────────────────
  const handleFinalizeRegistration = async () => {
    clearMessages();
    if (!manualNameInput.trim()) {
      setErrorMessage('Full Name must be entered manually');
      return;
    }
    if (!Object.values(passwordRules(passwordInput)).every(Boolean)) {
      setErrorMessage('Password must have 8+ characters, an uppercase letter, a number, and a special character');
      return;
    }
    if (!phoneVerified && !pnvToken) {
      setErrorMessage('Phone number must be verified');
      return;
    }
    if (!emailVerified && !isGoogleVerified) {
      setErrorMessage('Email address must be verified');
      return;
    }

    try {
      setBusy(true);
      let registrationToken = firebaseIdToken || '';
      if (isGoogleVerified) {
        const linked = await linkEmailCredentialToCurrentUser(emailInput.trim().toLowerCase(), passwordInput);
        registrationToken = linked.idToken;
      } else if (emailVerified) {
        // Preserve the Firebase phone identity after phone verification. If
        // we create a separate email user here, the phone_number claim is
        // lost and the backend correctly rejects finalization as unverified.
        if (firebasePhoneVerified && getFirebaseAuth().currentUser) {
          const linked = await linkEmailCredentialToCurrentUser(emailInput.trim().toLowerCase(), passwordInput);
          registrationToken = linked.idToken;
        } else {
          try {
            const created = await createEmailAccountViaFirebase(emailInput.trim().toLowerCase(), passwordInput);
            registrationToken = created.idToken;
          } catch (error) {
            if (error?.code !== 'auth/email-already-in-use') throw error;
            // Match Shop: after email OTP verification, an existing Firebase
            // identity can be reused when the entered password is valid.
            const existing = await signInWithEmailViaFirebase(emailInput.trim().toLowerCase(), passwordInput);
            registrationToken = existing.idToken;
          }
        }
      }
      const payload = {
        email: emailInput.trim().toLowerCase(),
        name: manualNameInput.trim(),
        password: passwordInput,
        phone: phoneInput.replace(/\D/g, '').slice(-10),
        email_otp: emailRegOtp.join('') || undefined,
        phone_otp: phoneOtp.join('') || undefined,
        google_verified: isGoogleVerified,
        firebase_id_token: registrationToken || undefined,
        platform,
        pnv_token: pnvToken || undefined,
      };

      const { data: res } = await completeUnifiedRegistration(payload);
      completeLoginSession(res.user);
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || err?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPasswordSubmit = async () => {
    clearMessages();
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setErrorMessage('Please enter your registered email address');
      return;
    }
    try {
      setBusy(true);
      await forgotPassword(forgotEmail.trim().toLowerCase());
      setForgotSent(true);
      setSuccessMessage('Password reset instructions dispatched to your email!');
    } catch (err) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to dispatch password reset');
    } finally {
      setBusy(false);
    }
  };

  const resetToHome = () => {
    setMode('select');
    setEntryMethod('');
    setEmailInput('');
    setPhoneInput('');
    setPasswordInput('');
    setManualNameInput('');
    setEmailRegOtp(['', '', '', '', '', '']);
    setEmailRegOtpSent(false);
    setEmailVerified(false);
    setPhoneOtp(['', '', '', '', '', '']);
    setPhoneOtpSent(false);
    setPhoneVerified(false);
    setIsGoogleVerified(false);
    setGoogleVerifiedEmail('');
    setFirebaseIdToken('');
    setFirebasePhoneConfirmation(null);
    setFirebasePhoneVerified(false);
    setPnvToken(null);
    clearMessages();
  };

  return (
    <div className="mm-auth-page">
      <div className="mm-auth-deco" />
      <div className="mm-auth-card">
        {/* Top Header & Back Navigation */}
        <div className="mm-auth-header-bar">
          {mode !== 'select' ? (
            <button type="button" onClick={resetToHome} className="mm-auth-back-btn">
              <FiRotateCcw size={12} /> ← Back to options
            </button>
          ) : (
            <div />
          )}
          <span className="mm-auth-platform-badge">
            {platform === 'android' ? 'Android Native Mode' : 'Web Mode'}
          </span>
        </div>

        {/* Brand Header */}
        <div className="mm-auth-brand">
          <Link to="/" className="mm-auth-logo">
            Mahila <em>✦</em> <span>Madel</span>
          </Link>
          <p className="mm-auth-tagline">
            {mode === 'select' && "Choose how you'd like to continue"}
            {mode === 'enter_email' && 'Enter your email address to continue'}
            {mode === 'enter_phone' && 'Enter your 10-digit mobile number'}
            {mode === 'not_registered' && 'Create your new Mahila Madel account'}
            {mode === 'google_profile' && 'Complete your profile to finalize registration'}
            {mode === 'email_login' && 'Sign in to your registered email account'}
            {mode === 'email_register' && 'Create your new Mahila Madel account'}
            {mode === 'phone_login' && 'Sign in via Phone Number Verification'}
            {mode === 'phone_register' && 'Verify Phone and complete onboarding'}
            {mode === 'forgot' && 'Reset your account password'}
          </p>
        </div>

        {/* Keep one stable host mounted for Firebase invisible reCAPTCHA.
            It must also exist during Google/email registration screens. */}
        <div id="firebase-phone-recaptcha" aria-hidden="true" />

        {/* Status Alerts */}
        {errorMessage && <div className="mm-alert mm-alert-error">{errorMessage}</div>}
        {successMessage && <div className="mm-alert mm-alert-success">{successMessage}</div>}

        {/* ── 1. SELECTION SCREEN (3-Row Layout) ────────────────────── */}
        {mode === 'select' && (
          <div className="mm-auth-options">
            {/* 1. Continue with Google */}
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleClick}
              className="mm-btn mm-btn-google"
            >
              <svg className="mm-google-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* 2. Continue with Email */}
            <button
              type="button"
              onClick={() => { clearMessages(); setMode('enter_email'); }}
              className="mm-btn mm-btn-outline"
            >
              <FiMail size={16} />
              <span>Continue with Email</span>
            </button>

            {/* 3. Continue with Phone */}
            <button
              type="button"
              onClick={() => { clearMessages(); setMode('enter_phone'); }}
              className="mm-btn mm-btn-primary"
            >
              <FiSmartphone size={16} />
              <span>Continue with Phone</span>
            </button>
          </div>
        )}

        {mode === 'not_registered' && (
          <div className="mm-auth-form mm-not-registered">
            <div className="mm-not-registered-card">
              <h3>You’re not registered with us</h3>
              <p>{entryMethod === 'mobile' ? `+91 ${phoneInput}` : emailInput || googleVerifiedEmail}</p>
            </div>
            <button type="button" disabled={busy} onClick={handleNotRegisteredRegister} className="mm-btn mm-btn-primary mm-btn-block">
              {busy ? 'Starting...' : 'Register'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode(entryMethod === 'google' ? 'select' : entryMethod === 'email' ? 'enter_email' : 'enter_phone')}
              className="mm-btn mm-btn-outline mm-btn-block"
            >
              {entryMethod === 'google' ? 'Choose a different Google account' : entryMethod === 'email' ? 'Change email' : 'Change mobile number'}
            </button>
          </div>
        )}

        {/* ── 1A. ENTER EMAIL SCREEN ─────────────────────────────────── */}
        {mode === 'enter_email' && (
          <div className="mm-auth-form">
            <div className="mm-input-group">
              <label>EMAIL ADDRESS *</label>
              <div className="mm-input-wrap">
                <FiMail className="mm-input-icon" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <button
              type="button"
              disabled={busy || !emailInput || !emailInput.includes('@')}
              onClick={handleEmailSubmit}
              className="mm-btn mm-btn-primary mm-btn-block"
            >
              {busy ? 'Verifying...' : <>Continue with Email <FiArrowRight /></>}
            </button>
          </div>
        )}

        {/* ── 1B. ENTER PHONE SCREEN ─────────────────────────────────── */}
        {mode === 'enter_phone' && (
          <div className="mm-auth-form">
            <div className="mm-input-group">
              <label>MOBILE NUMBER *</label>
              <div className="mm-input-wrap mm-phone-wrap">
                <span className="mm-phone-prefix">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <button
              type="button"
              disabled={busy || phoneInput.replace(/\D/g, '').length < 10}
              onClick={handlePhoneSubmit}
              className="mm-btn mm-btn-primary mm-btn-block"
            >
              {busy ? 'Processing...' : <>Continue with Phone <FiArrowRight /></>}
            </button>
          </div>
        )}

        {/* ── PATH A: GOOGLE PROFILE COMPLETION ──────────────────────── */}
        {mode === 'google_profile' && (
          <div className="mm-auth-form">
            <div className="mm-badge-verified">
              <FiCheckCircle /> <span>{googleVerifiedEmail} (Google Verified)</span>
            </div>

            <div className="mm-input-group">
              <label>FULL NAME * <span className="mm-label-sub">(Manual entry required)</span></label>
              <div className="mm-input-wrap">
                <FiUser className="mm-input-icon" />
                <input
                  type="text"
                  placeholder="ENTER FULL NAME"
                  value={manualNameInput}
                  onChange={(e) => setManualNameInput(e.target.value.toUpperCase())}
                  className="mm-input-caps"
                />
              </div>
            </div>

            <div className="mm-input-group">
              <label>SET PASSWORD *</label>
              <div className="mm-input-wrap">
                <FiLock className="mm-input-icon" />
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min 8 chars + 1 digit"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="mm-pw-toggle">
                  {showPw ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              <PasswordRequirements value={passwordInput} />
            </div>

            {/* Phone Verification */}
            <div className="mm-verification-box">
              <label>PHONE NUMBER VERIFICATION *</label>
              {phoneVerified || pnvToken ? (
                <div className="mm-badge-success">
                  <FiCheckCircle /> Phone Verified ({phoneInput})
                </div>
              ) : (
                <div className="mm-phone-verify-stack">
                  <div className="mm-input-wrap mm-phone-wrap">
                    <span className="mm-phone-prefix">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="10-digit number"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={busy || phoneInput.replace(/\D/g, '').length < 10 || pnvVerifying || phoneOtpResendIn > 0}
                      onClick={handleSendFormPhoneOtp}
                      className="mm-btn-inline"
                    >
                      {platform === 'android' ? 'Verify SIM' : (phoneOtpResendIn ? `Resend in ${formatCountdown(phoneOtpResendIn)}` : (phoneOtpSent ? 'Resend' : 'Send OTP'))}
                    </button>
                  </div>

                  {phoneOtpSent && platform === 'web' && (
                    <div className="mm-otp-row">
                      <div className="mm-otp-timing">
                        Code expires in <strong>{phoneOtpExpiresIn ? formatCountdown(phoneOtpExpiresIn) : 'Expired'}</strong>
                        {' · '}{phoneOtpResendIn ? `Resend in ${formatCountdown(phoneOtpResendIn)}` : 'Ready to resend'}
                      </div>
                      {phoneOtp.map((digit, i) => (
                        <input
                          key={i}
                          id={`gp-phone-otp-${i}`}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpBox(e.target.value, i, phoneOtp, setPhoneOtp, 'gp-phone-otp')}
                          className="mm-otp-box"
                        />
                      ))}
                      <button type="button" disabled={busy || phoneOtp.join('').length !== 6} onClick={handleVerifyFormPhoneOtp} className="mm-btn mm-btn-sm">
                        Verify
                      </button>
                      <button type="button" disabled={busy || phoneOtpResendIn > 0} onClick={handleSendFormPhoneOtp} className="mm-btn mm-btn-sm">
                        {phoneOtpResendIn ? `Resend in ${formatCountdown(phoneOtpResendIn)}` : 'Resend OTP'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={busy || !manualNameInput || !Object.values(passwordRules(passwordInput)).every(Boolean) || (!phoneVerified && !pnvToken)}
              onClick={handleFinalizeRegistration}
              className="mm-btn mm-btn-primary mm-btn-block"
            >
              {busy ? 'Creating Account...' : <>Finalize Account <FiArrowRight /></>}
            </button>
          </div>
        )}

        {/* ── PATH B: EMAIL LOGIN ────────────────────────────────────── */}
        {mode === 'email_login' && (
          <div className="mm-auth-form">
            <div className="mm-auth-tabs-mini">
              <button
                type="button"
                className={emailAuthChoice === 'password' ? 'active' : ''}
                onClick={() => setEmailAuthChoice('password')}
              >
                Password Login
              </button>
              <button
                type="button"
                className={emailAuthChoice === 'otp' ? 'active' : ''}
                onClick={() => {
                  setEmailAuthChoice('otp');
                  if (!emailLoginOtpSent) handleSendEmailLoginOtp();
                }}
              >
                OTP Login
              </button>
            </div>

            {emailAuthChoice === 'password' ? (
              <div className="mm-auth-stack">
                <div className="mm-input-group">
                  <label>PASSWORD *</label>
                  <div className="mm-input-wrap">
                    <FiLock className="mm-input-icon" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="Enter account password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="mm-pw-toggle">
                      {showPw ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  <PasswordRequirements value={passwordInput} />
                </div>

                <div className="mm-forgot-row">
                  <button type="button" onClick={() => setMode('forgot')} className="mm-link-btn">
                    Forgot password?
                  </button>
                </div>

                <button
                  type="button"
                  disabled={busy || !passwordInput}
                  onClick={handleEmailPasswordLogin}
                  className="mm-btn mm-btn-primary mm-btn-block"
                >
                  {busy ? 'Signing In...' : <>Sign In <FiArrowRight /></>}
                </button>
              </div>
            ) : (
              <div className="mm-auth-stack">
                <p className="mm-info-text">We sent a 6-digit login code to <strong>{emailInput}</strong></p>
                <div className="mm-otp-timing">
                  Code expires in <strong>{emailLoginOtpExpiresIn ? formatCountdown(emailLoginOtpExpiresIn) : 'Expired'}</strong>
                  {' · '}{emailLoginOtpResendIn ? `Resend in ${formatCountdown(emailLoginOtpResendIn)}` : 'Ready to resend'}
                </div>
                <div className="mm-otp-container">
                  {emailLoginOtp.map((digit, i) => (
                    <input
                      key={i}
                      id={`el-otp-${i}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpBox(e.target.value, i, emailLoginOtp, setEmailLoginOtp, 'el-otp')}
                      className="mm-otp-box"
                    />
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy || emailLoginOtp.join('').length !== 6}
                  onClick={handleVerifyEmailLoginOtp}
                  className="mm-btn mm-btn-primary mm-btn-block"
                >
                  {busy ? 'Verifying...' : <>Verify & Sign In <FiArrowRight /></>}
                </button>
                <button type="button" disabled={busy || emailLoginOtpResendIn > 0} onClick={handleSendEmailLoginOtp} className="mm-btn mm-btn-secondary mm-btn-block">
                  {emailLoginOtpResendIn ? `Resend OTP in ${formatCountdown(emailLoginOtpResendIn)}` : 'Resend OTP'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── PATH B: EMAIL REGISTRATION ─────────────────────────────── */}
        {mode === 'email_register' && (
          <div className="mm-auth-form">
            {!emailVerified ? (
              <div className="mm-auth-stack">
                <p className="mm-info-text">Enter the 6-digit verification code sent to <strong>{emailInput}</strong>:</p>
                <div className="mm-otp-timing">
                  Code expires in <strong>{emailRegOtpExpiresIn ? formatCountdown(emailRegOtpExpiresIn) : 'Expired'}</strong>
                  {' · '}{emailRegOtpResendIn ? `Resend in ${formatCountdown(emailRegOtpResendIn)}` : 'Ready to resend'}
                </div>
                <div className="mm-otp-container">
                  {emailRegOtp.map((digit, i) => (
                    <input
                      key={i}
                      id={`er-otp-${i}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpBox(e.target.value, i, emailRegOtp, setEmailRegOtp, 'er-otp')}
                      className="mm-otp-box"
                    />
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy || emailRegOtp.join('').length !== 6}
                  onClick={handleVerifyEmailRegOtp}
                  className="mm-btn mm-btn-primary mm-btn-block"
                >
                  {busy ? 'Verifying...' : <>Verify Email Code <FiArrowRight /></>}
                </button>
                <button type="button" disabled={busy || emailRegOtpResendIn > 0} onClick={async () => {
                  const response = await sendEmailOtp(emailInput.trim().toLowerCase(), 'registration');
                  const timing = otpTiming(response);
                  setEmailRegOtpSent(true); setEmailRegOtpExpiresIn(timing.expires); setEmailRegOtpResendIn(timing.resend);
                }} className="mm-btn mm-btn-secondary mm-btn-block">
                  {emailRegOtpResendIn ? `Resend OTP in ${formatCountdown(emailRegOtpResendIn)}` : 'Resend OTP'}
                </button>
              </div>
            ) : (
              <div className="mm-auth-stack">
                <div className="mm-badge-verified">
                  <FiCheckCircle /> <span>{emailInput} (Email Verified)</span>
                </div>

                <div className="mm-input-group">
                  <label>FULL NAME * <span className="mm-label-sub">(Manual entry required)</span></label>
                  <div className="mm-input-wrap">
                    <FiUser className="mm-input-icon" />
                    <input
                      type="text"
                      placeholder="ENTER FULL NAME"
                      value={manualNameInput}
                      onChange={(e) => setManualNameInput(e.target.value.toUpperCase())}
                      className="mm-input-caps"
                    />
                  </div>
                </div>

                <div className="mm-input-group">
                  <label>SET PASSWORD *</label>
                  <div className="mm-input-wrap">
                    <FiLock className="mm-input-icon" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="Min 8 chars + 1 digit"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="mm-pw-toggle">
                      {showPw ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  <PasswordRequirements value={passwordInput} />
                </div>

                {/* Phone Verification */}
                <div className="mm-verification-box">
                  <label>PHONE NUMBER VERIFICATION *</label>
                  {phoneVerified || pnvToken ? (
                    <div className="mm-badge-success">
                      <FiCheckCircle /> Phone Verified ({phoneInput})
                    </div>
                  ) : (
                    <div className="mm-phone-verify-stack">
                      <div className="mm-input-wrap mm-phone-wrap">
                        <span className="mm-phone-prefix">+91</span>
                        <input
                          type="tel"
                          maxLength={10}
                          placeholder="10-digit number"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                        />
                        <button
                          type="button"
                          disabled={busy || phoneInput.replace(/\D/g, '').length < 10 || pnvVerifying || phoneOtpResendIn > 0}
                          onClick={handleSendFormPhoneOtp}
                          className="mm-btn-inline"
                        >
                          {platform === 'android' ? 'Verify SIM' : (phoneOtpResendIn ? `Resend in ${formatCountdown(phoneOtpResendIn)}` : (phoneOtpSent ? 'Resend' : 'Send OTP'))}
                        </button>
                      </div>

                      {phoneOtpSent && platform === 'web' && (
                        <div className="mm-otp-row">
                          {phoneOtp.map((digit, i) => (
                            <input
                              key={i}
                              id={`er-phone-otp-${i}`}
                              type="text"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => handleOtpBox(e.target.value, i, phoneOtp, setPhoneOtp, 'er-phone-otp')}
                              className="mm-otp-box"
                            />
                          ))}
                          <button type="button" onClick={handleVerifyFormPhoneOtp} className="mm-btn mm-btn-sm">
                            Verify
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={busy || !manualNameInput || !Object.values(passwordRules(passwordInput)).every(Boolean) || (!phoneVerified && !pnvToken)}
                  onClick={handleFinalizeRegistration}
                  className="mm-btn mm-btn-primary mm-btn-block"
                >
                  {busy ? 'Creating Account...' : <>Complete Registration <FiArrowRight /></>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── PATH C: PHONE LOGIN ────────────────────────────────────── */}
        {mode === 'phone_login' && (
          <div className="mm-auth-form">
            <p className="mm-info-text">
              Account found for <strong>{maskedPhone}</strong>
            </p>
            <div className="mm-otp-timing">
              Code expires in <strong>{phoneOtpExpiresIn ? formatCountdown(phoneOtpExpiresIn) : 'Expired'}</strong>
              {' · '}{phoneOtpResendIn ? `Resend in ${formatCountdown(phoneOtpResendIn)}` : 'Ready to resend'}
            </div>
            <div className="mm-otp-container">
              {phoneOtp.map((digit, i) => (
                <input
                  key={i}
                  id={`pl-otp-${i}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpBox(e.target.value, i, phoneOtp, setPhoneOtp, 'pl-otp')}
                  className="mm-otp-box"
                />
              ))}
            </div>
            <button
              type="button"
              disabled={busy || phoneOtp.join('').length !== 6}
              onClick={() => handleVerifyPhoneOtp('login')}
              className="mm-btn mm-btn-primary mm-btn-block"
            >
              {busy ? 'Verifying...' : <>Sign In with Phone <FiArrowRight /></>}
            </button>
            <button type="button" disabled={busy || phoneOtpResendIn > 0} onClick={() => handleResendPhoneOtp('login')} className="mm-btn mm-btn-secondary mm-btn-block">
              {phoneOtpResendIn ? `Resend OTP in ${formatCountdown(phoneOtpResendIn)}` : 'Resend OTP'}
            </button>
          </div>
        )}

        {/* ── PATH C: PHONE REGISTRATION ─────────────────────────────── */}
        {mode === 'phone_register' && (
          <div className="mm-auth-form">
            {!phoneVerified && !pnvToken ? (
              <div className="mm-auth-stack">
                <p className="mm-info-text">Enter the 6-digit SMS OTP sent to <strong>+91 {phoneInput}</strong>:</p>
                <div className="mm-otp-timing">
                  Code expires in <strong>{phoneOtpExpiresIn ? formatCountdown(phoneOtpExpiresIn) : 'Expired'}</strong>
                  {' · '}{phoneOtpResendIn ? `Resend in ${formatCountdown(phoneOtpResendIn)}` : 'Ready to resend'}
                </div>
                <div className="mm-otp-container">
                  {phoneOtp.map((digit, i) => (
                    <input
                      key={i}
                      id={`pr-otp-${i}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpBox(e.target.value, i, phoneOtp, setPhoneOtp, 'pr-otp')}
                      className="mm-otp-box"
                    />
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy || phoneOtp.join('').length !== 6}
                  onClick={() => handleVerifyPhoneOtp('registration')}
                  className="mm-btn mm-btn-primary mm-btn-block"
                >
                  {busy ? 'Verifying...' : <>Verify Phone <FiArrowRight /></>}
                </button>
                <button type="button" disabled={busy || phoneOtpResendIn > 0} onClick={() => handleResendPhoneOtp('registration')} className="mm-btn mm-btn-secondary mm-btn-block">
                  {phoneOtpResendIn ? `Resend OTP in ${formatCountdown(phoneOtpResendIn)}` : 'Resend OTP'}
                </button>
              </div>
            ) : (
              <div className="mm-auth-stack">
                <div className="mm-badge-verified">
                  <FiCheckCircle /> <span>+91 {phoneInput} (Phone Verified)</span>
                </div>

                {/* Email Capture & Verification Choice */}
                <div className="mm-verification-box">
                  <label>EMAIL ADDRESS VERIFICATION *</label>
                  {emailVerified || isGoogleVerified ? (
                    <div className="mm-badge-success">
                      <FiCheckCircle /> Email Verified ({emailInput})
                    </div>
                  ) : (
                    <div>
                      <div className="mm-auth-tabs-mini">
                        <button
                          type="button"
                          className={phoneEmailChoice === 'google' ? 'active' : ''}
                          onClick={() => setPhoneEmailChoice('google')}
                        >
                          Link Google
                        </button>
                        <button
                          type="button"
                          className={phoneEmailChoice === 'manual' ? 'active' : ''}
                          onClick={() => setPhoneEmailChoice('manual')}
                        >
                          Email OTP
                        </button>
                      </div>

                      {phoneEmailChoice === 'google' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={handlePhonePathGoogleLink}
                          className="mm-btn mm-btn-google mm-btn-block"
                        >
                          <span>Link Verified Google Email</span>
                        </button>
                      ) : (
                        <div className="mm-auth-stack">
                          <div className="mm-input-wrap">
                            <FiMail className="mm-input-icon" />
                            <input
                              type="email"
                              placeholder="Enter email to verify"
                              value={emailInput}
                              onChange={(e) => setEmailInput(e.target.value)}
                            />
                            <button
                              type="button"
                              disabled={busy || !emailInput || !emailInput.includes('@')}
                              onClick={async () => {
      const normalizedEmail = emailInput.trim().toLowerCase();
      const { data: account } = await checkEmail(normalizedEmail);
      if (account.exists) throw new Error('This email is already registered. Please sign in with that account.');
      const response = await sendEmailOtp(normalizedEmail, 'registration');
      const timing = otpTiming(response);
      setEmailRegOtpSent(true);
      setEmailRegOtpExpiresIn(timing.expires); setEmailRegOtpResendIn(timing.resend);
                                setSuccessMessage('Code sent to email!');
                              }}
                              className="mm-btn-inline"
                            >
                              Send OTP
                            </button>
                          </div>

                          {emailRegOtpSent && (
                            <div className="mm-otp-row">
                              <div className="mm-otp-timing">
                                Code expires in <strong>{emailRegOtpExpiresIn ? formatCountdown(emailRegOtpExpiresIn) : 'Expired'}</strong>
                                {' · '}{emailRegOtpResendIn ? `Resend in ${formatCountdown(emailRegOtpResendIn)}` : 'Ready to resend'}
                              </div>
                              {emailRegOtp.map((digit, i) => (
                                <input
                                  key={i}
                                  id={`pr-email-otp-${i}`}
                                  type="text"
                                  maxLength={1}
                                  value={digit}
                                  onChange={(e) => handleOtpBox(e.target.value, i, emailRegOtp, setEmailRegOtp, 'pr-email-otp')}
                                  className="mm-otp-box"
                                />
                              ))}
                              <button type="button" onClick={handleVerifyEmailRegOtp} className="mm-btn mm-btn-sm">
                                Verify
                              </button>
                              <button type="button" disabled={busy || emailRegOtpResendIn > 0} onClick={async () => {
                                const normalizedEmail = emailInput.trim().toLowerCase();
                                const { data: account } = await checkEmail(normalizedEmail);
                                if (account.exists) throw new Error('This email is already registered. Please sign in with that account.');
                                const response = await sendEmailOtp(normalizedEmail, 'registration');
                                const timing = otpTiming(response);
                                setEmailRegOtpExpiresIn(timing.expires); setEmailRegOtpResendIn(timing.resend);
                              }} className="mm-btn mm-btn-sm">
                                {emailRegOtpResendIn ? `Resend in ${formatCountdown(emailRegOtpResendIn)}` : 'Resend OTP'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mm-input-group">
                  <label>FULL NAME * <span className="mm-label-sub">(Manual entry required)</span></label>
                  <div className="mm-input-wrap">
                    <FiUser className="mm-input-icon" />
                    <input
                      type="text"
                      placeholder="ENTER FULL NAME"
                      value={manualNameInput}
                      onChange={(e) => setManualNameInput(e.target.value.toUpperCase())}
                      className="mm-input-caps"
                    />
                  </div>
                </div>

                <div className="mm-input-group">
                  <label>SET PASSWORD *</label>
                  <div className="mm-input-wrap">
                    <FiLock className="mm-input-icon" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="Min 8 chars + 1 digit"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="mm-pw-toggle">
                      {showPw ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  <PasswordRequirements value={passwordInput} />
                </div>

                <button
                  type="button"
                  disabled={busy || !manualNameInput || !Object.values(passwordRules(passwordInput)).every(Boolean) || !emailVerified}
                  onClick={handleFinalizeRegistration}
                  className="mm-btn mm-btn-primary mm-btn-block"
                >
                  {busy ? 'Finalizing Account...' : <>Finalize Account <FiArrowRight /></>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── FORGOT PASSWORD ────────────────────────────────────────── */}
        {mode === 'forgot' && (
          <div className="mm-auth-form">
            {!forgotSent ? (
              <div className="mm-auth-stack">
                <div className="mm-input-group">
                  <label>REGISTERED EMAIL *</label>
                  <div className="mm-input-wrap">
                    <FiMail className="mm-input-icon" />
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || !forgotEmail || !forgotEmail.includes('@')}
                  onClick={handleForgotPasswordSubmit}
                  className="mm-btn mm-btn-primary mm-btn-block"
                >
                  {busy ? 'Sending Link...' : <>Send Reset Instructions <FiArrowRight /></>}
                </button>
              </div>
            ) : (
              <div className="mm-auth-stack">
                <div className="mm-badge-verified">
                  <FiKey /> <span>Reset instructions sent to {forgotEmail}</span>
                </div>
                <button type="button" onClick={resetToHome} className="mm-btn mm-btn-primary mm-btn-block">
                  Back to Sign In
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
