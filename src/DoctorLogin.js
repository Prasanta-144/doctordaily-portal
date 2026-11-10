import React, { useState } from 'react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export default function DoctorLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        
        // 3. Pass the phone number back to App.js to trigger the dashboard
        onLogin(phone);
      } else {
        setError("No doctor profile found for this account. Please register first.");
        // Sign out since they don't have a doctor profile
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none transition"
              />
            </div>
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