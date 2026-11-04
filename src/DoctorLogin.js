import React, { useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "./firebase";

export default function DoctorLogin({ onLogin }) {
  const [step, setStep] = useState(1); // 1 = Phone, 2 = OTP
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    
    if (phone.length !== 10) {
      setError("Enter a valid 10-digit phone number");
      return;
    }

    setLoading(true);
    try {
      // Initialize reCAPTCHA invisibly
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      
      const confirmation = await signInWithPhoneNumber(auth, `+91${phone}`, window.recaptchaVerifier);
      window.confirmationResult = confirmation;
      setStep(2);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to send OTP.");
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Verify OTP with Firebase
      await window.confirmationResult.confirm(otp);
      
      // 2. Check if this user is actually a registered Doctor
      const phoneE164 = `+91${phone}`;
      const doctorsRef = collection(db, "doctors");
      const q = query(doctorsRef, where("phone", "==", phoneE164));
      const doctorSnapshot = await getDocs(q);

      if (doctorSnapshot.empty) {
        // Not a doctor! Sign them out immediately.
        await signOut(auth);
        setError("This phone number is not registered as a doctor. Please register first.");
        setStep(1);
        setLoading(false);
        return;
      }

      // 3. Success! Call the parent onLogin
      onLogin(phone);

    } catch (err) {
      console.error(err);
      setError("Invalid OTP. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFC] flex items-center justify-center p-6 font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100 text-center">
        <div className="mb-8">
          <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain mx-auto mb-4" />
          <h2 className="text-2xl font-extrabold text-[#322B7B]">Doctor Login</h2>
          <p className="text-sm text-slate-500 mt-1">
            {step === 1 ? "Enter your registered phone number." : `Enter the OTP sent to +91 ${phone}`}
          </p>
        </div>

        <div id="recaptcha-container"></div>

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <input 
              type="tel" 
              placeholder="10-digit mobile number" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              className="w-full border border-slate-300 p-3.5 rounded-xl focus:ring-2 focus:ring-[#4C41A6] outline-none text-center tracking-widest font-semibold" 
            />
            {error && <p className="text-rose-500 text-sm font-semibold">{error}</p>}
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-[#4C41A6] text-white p-3.5 rounded-xl font-bold hover:bg-[#3F3590] transition shadow-md disabled:opacity-70 mt-2"
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <input 
              type="text" 
              placeholder="6-digit OTP" 
              value={otp} 
              onChange={(e) => setOtp(e.target.value)} 
              className="w-full border border-slate-300 p-3.5 rounded-xl focus:ring-2 focus:ring-[#4C41A6] outline-none text-center tracking-widest font-semibold text-lg" 
            />
            {error && <p className="text-rose-500 text-sm font-semibold">{error}</p>}
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-[#4C41A6] text-white p-3.5 rounded-xl font-bold hover:bg-[#3F3590] transition shadow-md disabled:opacity-70 mt-2"
            >
              {loading ? "Verifying..." : "Verify & Login"}
            </button>
            <button 
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-slate-500 hover:text-slate-800 transition mt-2"
            >
              Change phone number
            </button>
          </form>
        )}

        <p className="mt-8 text-sm text-slate-500">
          New doctor? <a href="/#register" className="text-[#4C41A6] font-bold hover:underline">Register here</a>
        </p>
      </div>
    </div>
  );
}