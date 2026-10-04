import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { QUICK_DEMO_USERS } from '../constants';
import { MessageSquare, Phone, KeyRound, Loader2, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { requestOtp, verifyOtp, error, mockOtpHint } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('+919876543210');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const handleRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    const ok = await requestOtp(phoneNumber);
    setIsLoading(false);
    if (ok) {
      setOtpSent(true);
      // Pre-fill only when the server actually returned a mock OTP (development)
      const hint = useAuthStore.getState().mockOtpHint;
      if (hint) setOtp(hint);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await verifyOtp(phoneNumber, otp);
    setIsLoading(false);
  };

  const handleQuickLogin = async (phone: string) => {
    setPhoneNumber(phone);
    setIsLoading(true);
    const ok = await requestOtp(phone);
    if (ok) {
      const hint = useAuthStore.getState().mockOtpHint || '123456';
      setOtpSent(true);
      setOtp(hint);
      await verifyOtp(phone, hint);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#0c1317] p-4 wa-chat-pattern overflow-y-auto">
      <div className="w-full max-w-md bg-[#111b21] border border-[#222d34] rounded-3xl shadow-2xl p-8 backdrop-blur-xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
            <MessageSquare className="w-8 h-8 fill-current" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">RSM Messenger</h1>
          <p className="text-[#8696a0] text-xs mt-1">Simple. Reliable. Private.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        {mockOtpHint && (
          <div className="mb-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs text-center font-mono">
            Mock OTP: <span className="font-bold">{mockOtpHint}</span> (Development mode)
          </div>
        )}

        {!otpSent ? (
          <form onSubmit={handleRequest} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#8696a0] mb-2 uppercase tracking-wider">
                Enter your phone number
              </label>
              <div className="relative">
                <Phone className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8696a0]" />
                <input
                  type="text"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-[#202c33] border border-[#2e3b44] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm font-medium"
                  placeholder="+919876543210"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all text-sm"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Next <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#8696a0] mb-2 uppercase tracking-wider text-center">
                Enter 6-Digit Code
              </label>
              <div className="relative">
                <KeyRound className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8696a0]" />
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-[#202c33] border border-[#2e3b44] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-center tracking-widest text-lg font-mono font-bold"
                  placeholder="123456"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all text-sm"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Continue'}
            </button>

            <button
              type="button"
              onClick={() => setOtpSent(false)}
              className="w-full text-center text-xs text-[#8696a0] hover:text-slate-200 transition-colors pt-1"
            >
              Wrong number?
            </button>
          </form>
        )}

        {/* Quick Demo Switcher - Dev Only */}
        {import.meta.env.DEV && (
          <div className="mt-8 pt-6 border-t border-[#222d34] space-y-3">
            <div className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> One-Click Demo Accounts (Dev Only)
            </div>
            <div className="grid grid-cols-1 gap-2">
              {QUICK_DEMO_USERS.map((demo) => (
                <button
                  key={demo.phone}
                  onClick={() => handleQuickLogin(demo.phone)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#202c33] hover:bg-[#2a3942] border border-[#2e3b44] text-xs transition-colors"
                >
                  <span className="font-semibold text-white">{demo.name}</span>
                  <span className="font-mono text-[#8696a0]">{demo.phone}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
