import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestOTP, verifyOTP } from '../../api/auth.api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';

// ── Shared input style ──────────────────────────────────────────────────
const inp = `w-full rounded-xl px-4 py-3 text-sm transition-all
  bg-white dark:bg-black
  border border-amber-200 dark:border-amber-500/30
  text-gray-900 dark:text-white
  placeholder-gray-400 dark:placeholder-gray-600
  focus:outline-none focus:ring-2 focus:ring-amber-500/40
  focus:border-amber-500 dark:focus:border-amber-400`;

const EmailStep = ({ onOTPSent }) => {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestOTP(email);
      toast.success('OTP sent! Check your email.');
      onOTPSent(email);
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Email not recognized in the system.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to send OTP');
      }
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400
                          uppercase tracking-widest mb-2">
          Work Email
        </label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@company.com" required autoFocus className={inp} />
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700
                   text-white font-bold py-3 rounded-xl transition-all text-sm
                   shadow-lg shadow-amber-500/25 disabled:opacity-50
                   hover:scale-[1.02] active:scale-[0.99]">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent
                             rounded-full animate-spin" />
            Sending OTP…
          </span>
        ) : 'Send OTP →'}
      </button>
    </form>
  );
};

const OTPStep = ({ email, onBack }) => {
  const [otp, setOtp]         = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const { loginUser }         = useAuth();
  const navigate              = useNavigate();

  const handleChange = (i, val) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp]; next[i] = val.slice(-1); setOtp(next);
    if (val && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0)
      document.getElementById(`otp-${i - 1}`)?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (p.length === 6) { setOtp(p.split('')); document.getElementById('otp-5')?.focus(); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) { toast.error('Enter all 6 digits'); return; }
    setLoading(true);
    try {
      const res = await verifyOTP(email, code);
      const { token, user } = res.data.data;
      loginUser(token, user);
      toast.success(`Welcome, ${user.name}! 👋`);
      
      // Updated HOD to MANAGER and the route to /manager/dashboard
      const redirects = { USER: '/dashboard', MANAGER: '/manager/dashboard', FINANCE: '/finance/dashboard' };
      navigate(redirects[user.role] || '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
      document.getElementById('otp-0')?.focus();
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    try {
      await requestOTP(email);
      toast.success('New OTP sent!');
      setOtp(['', '', '', '', '', '']);
      setResendTimer(60);
      const t = setInterval(() => setResendTimer(v => {
        if (v <= 1) { clearInterval(t); return 0; } return v - 1;
      }), 1000);
      document.getElementById('otp-0')?.focus();
    } catch { toast.error('Failed to resend OTP'); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Sent-to banner */}
      <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-500/10
                      border border-amber-200 dark:border-amber-500/20
                      rounded-xl px-4 py-3">
        <div>
          <p className="text-xs text-amber-500 dark:text-amber-400">OTP sent to</p>
          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{email}</p>
        </div>
        <button type="button" onClick={onBack}
          className="text-xs text-amber-500 hover:text-amber-700 font-bold">
          Change
        </button>
      </div>

      {/* 6 boxes */}
      <div>
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400
                          uppercase tracking-widest mb-3">
          6-Digit OTP
        </label>
        <div className="flex gap-2 justify-center">
          {otp.map((digit, i) => (
            <input key={i} id={`otp-${i}`} type="text" inputMode="numeric"
              maxLength={1} value={digit} autoFocus={i === 0}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              className={`w-11 h-12 text-center text-xl font-black rounded-xl border
                         focus:outline-none focus:ring-2 focus:ring-amber-500/40
                         transition-all bg-white dark:bg-black
                         text-gray-900 dark:text-white
                         ${digit
                           ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
                           : 'border-amber-200 dark:border-amber-500/30'}`}
            />
          ))}
        </div>
        <p className="text-xs text-center text-gray-400 dark:text-gray-600 mt-3">
          Expires in 10 minutes
        </p>
      </div>

      <button type="submit" disabled={loading || otp.join('').length !== 6}
        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold
                   py-3 rounded-xl transition-all text-sm shadow-lg
                   shadow-amber-500/25 disabled:opacity-50
                   hover:scale-[1.02] active:scale-[0.99]">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent
                             rounded-full animate-spin" />
            Verifying…
          </span>
        ) : 'Verify & Login'}
      </button>

      <div className="text-center">
        {resendTimer > 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-600">Resend in {resendTimer}s</p>
        ) : (
          <button type="button" onClick={handleResend}
            className="text-xs text-amber-500 hover:text-amber-600 font-bold
                       hover:underline">
            Didn't receive it? Resend OTP
          </button>
        )}
      </div>
    </form>
  );
};

export default function Login() {
  const [step, setStep]   = useState(1);
  const [email, setEmail] = useState('');
  const { dark, toggle }  = useTheme();

  return (
    <div className="min-h-screen flex items-center justify-center p-4
                    bg-white dark:bg-black transition-colors duration-300">

      {/* Dark mode toggle */}
      <button onClick={toggle}
        className="fixed top-4 right-4 w-10 h-10 rounded-xl
                   bg-amber-50 dark:bg-amber-500/10
                   border border-amber-200 dark:border-amber-500/30
                   flex items-center justify-center
                   hover:scale-105 transition-transform z-10">
        {dark ? (
          <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>

      <div className="w-full max-w-[420px]">
        {/* Card */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-amber-100
                        dark:border-amber-500/20 rounded-3xl shadow-2xl
                        dark:shadow-amber-500/5 overflow-hidden">

          {/* Header band */}
          <div className="bg-amber-500 px-8 py-7 text-white">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center
                            justify-center mx-auto mb-4 text-2xl font-black">
              ₹
            </div>
            <h1 className="text-xl font-black text-center">Fund Request System</h1>
            <p className="text-amber-100 text-sm text-center mt-1">
              {step === 1 ? 'Sign in with your work email' : 'Enter your one-time password'}
            </p>

            {/* Step progress */}
            <div className="flex gap-2 mt-5 px-4">
              <div className="flex-1 h-1 bg-white rounded-full" />
              <div className={`flex-1 h-1 rounded-full transition-all duration-500
                ${step >= 2 ? 'bg-white' : 'bg-white/30'}`} />
            </div>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            {step === 1
              ? <EmailStep onOTPSent={e => { setEmail(e); setStep(2); }} />
              : <OTPStep email={email} onBack={() => { setStep(1); setEmail(''); }} />
            }

            {/* Test accounts */}
            <div className="mt-4 bg-amber-50 dark:bg-amber-500/5
                            border border-amber-100 dark:border-amber-500/10
                            rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400
                             uppercase tracking-widest mb-2">
                Demo Accounts
              </p>
              <div className="space-y-1 text-xs text-gray-500 dark:text-gray-500">
                <p>USER    — tharun@company.com</p>
                <p>MANAGER L1 — manish@company.com</p>
                <p>MANAGER L2 — ravi@company.com</p>
                <p>FINANCE — finance@company.com</p>
                <p className="text-gray-400 dark:text-gray-700 pt-1">
                  OTP prints to server terminal (dev mode)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}