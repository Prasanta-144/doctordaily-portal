import { useState } from 'react';
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
      // 1. Sign in with Email/Password
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Fetch their Doctor Profile to get their Phone Number
      const docRef = doc(db, "doctors", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // Extract the phone number (remove +91 for the dashboard to handle)
        const phone = docSnap.data().phone.replace('+91', '');
        onLogin(phone); // Pass back to App.js
      } else {
        setError("Doctor profile not found in database.");
      }
    } catch (err) {
      setError("Invalid email or password.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Doctor Login</h2>
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="email" 
            placeholder="Email Address" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" 
          />
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-brand text-white p-3 rounded-lg font-bold hover:opacity-90 transition"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <div className="mt-4 text-center">
          <a href="#" onClick={() => window.location.hash = ''} className="text-sm text-gray-500 hover:text-brand">← Back to Home</a>
        </div>
      </div>
    </div>
  );
}