import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export default function DoctorLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // NEW STATES
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Load saved email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('doctorSavedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 1. Authenticate with Email and Password
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Fetch the Doctor's profile from Firestore to get their phone number
      const docRef = doc(db, "doctors", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const doctorData = docSnap.data();
        // Extract the phone number (remove +91 prefix for the dashboard)
        const phone = doctorData.phone ? doctorData.phone.replace('+91', '') : '';
        
        // Handle Remember Me
        if (rememberMe) {
          localStorage.setItem('doctorSavedEmail', email);
        } else {
          localStorage.removeItem('doctorSavedEmail');
        }

        // 3. Pass the phone number back to App.js to trigger the dashboard
        onLogin(phone);
      } else {
        setError("No doctor profile found for this account. Please register first.");
        auth.signOut();
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError("Invalid email or password. Please try again.");
      } else {
        setError(err.message || "Failed to log in.");
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address to reset your password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`A password reset link has been sent to ${email}. Please check your inbox.`);
    } catch (err) {
      setError("Failed to send reset email. Please check if the email is correct.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
        
        <div className="text-center">
          <img src="/logo.png" alt="DoctorDaily Logo" className="mx-auto h-16 w-auto object-contain mb-4" />
          <h2 className="text-3xl font-extrabold text-gray-900">
            Doctor Login
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Welcome back! Please enter your details.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm text-center font-medium border border-rose-100">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@example.com"
                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none transition"
              />
            </div>
            
            {/* PASSWORD FIELD WITH VIEW TOGGLE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-300 p-3 pr-10 rounded-lg focus:ring-2 focus:ring-brand outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                  title={showPassword ? "Hide Password" : "Show Password"}
                >
                  {showPassword ? (
                    // Eye-slash icon (Hidden)
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
                  ) : (
                    // Eye icon (Visible)
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* REMEMBER ME & FORGOT PASSWORD ROW */}
          <div className="flex items-center justify-between text-sm mt-2">
            <label className="flex items-center text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="mr-2 rounded text-brand focus:ring-brand border-gray-300"
              />
              Remember Me
            </label>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="font-bold text-brand hover:underline"
            >
              Forgot Password?
            </button>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-brand hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand transition disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
          </div>
        </form>

        <div className="mt-6 flex flex-col space-y-3 text-center text-sm">
          <p className="text-gray-600">
            Don't have an account?{' '}
            <button onClick={() => window.location.hash = ''} className="font-bold text-brand hover:underline">
              Register here
            </button>
          </p>
          <button onClick={() => window.location.hash = ''} className="font-medium text-gray-500 hover:text-gray-800 transition">
            ← Back to Homepage
          </button>
        </div>
        
      </div>
    </div>
  );
}