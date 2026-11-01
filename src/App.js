import React, { useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import DoctorDashboard from './DoctorDashboard';
import DoctorLogin from './DoctorLogin';

export default function App() {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  
  // View state for routing
  const [view, setView] = useState('landing'); // 'landing', 'login', 'dashboard'
  const [loggedInPhone, setLoggedInPhone] = useState('');

  const [formData, setFormData] = useState({
    name: '', specialization: 'General Medicine', qualifications: '', 
    experienceYears: '', clinicName: '', clinicAddress: '', consultationFee: '', nmcRegistrationId: ''
  });

  // --- Firebase Logic ---
  const handleSendOtp = async () => {
    if (phone.length !== 10) return alert("Enter a 10-digit number");
    setLoading(true);
    try {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      const confirmation = await signInWithPhoneNumber(auth, `+91${phone}`, window.recaptchaVerifier);
      window.confirmationResult = confirmation;
      setStep(2);
    } catch (error) {
      alert("Error: " + error.message);
      window.recaptchaVerifier.clear();
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    try {
      await window.confirmationResult.confirm(otp);
      setStep(3);
    } catch (error) {
      alert("Invalid OTP. Please try again.");
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nmcRegistrationId) return alert("Please enter your NMC Registration Number.");
    setLoading(true);

    try {
      const apifyToken = "PASTE_YOUR_APIFY_TOKEN_HERE"; // Make sure your token is here
      const response = await fetch(
        `https://api.apify.com/v2/acts/whoareyouanas~nmc-doctor-lookup/run-sync-get-dataset-items?token=${apifyToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationId: formData.nmcRegistrationId })
        }
      );

      const data = await response.json();
      const isVerified = data && data[0] ? data[0].isValid : true; 
      
      if (!isVerified) {
        alert("We could not verify this NMC Registration Number. Please check and try again.");
        setLoading(false);
        return; 
      }

      const user = auth.currentUser;
      
      await setDoc(doc(db, "doctors", user.uid), {
        uid: user.uid,
        phone: user.phoneNumber,
        name: formData.name,
        specialization: formData.specialization,
        qualifications: formData.qualifications,
        experienceYears: Number(formData.experienceYears),
        clinicName: formData.clinicName,
        clinicAddress: formData.clinicAddress,
        consultationFee: Number(formData.consultationFee),
        nmcRegistrationId: formData.nmcRegistrationId,
        status: "approved", 
        active: true        
      });

      setStep(4); 
    } catch (error) {
      alert("Verification failed: " + error.message);
    }
    setLoading(false);
  };

  const handleInput = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // --- Routing logic ---
  if (view === 'dashboard') {
    return <DoctorDashboard doctorPhone={loggedInPhone} onLogout={() => setView('landing')} />;
  }

  if (view === 'login') {
    return <DoctorLogin onLogin={(phone) => {
      setLoggedInPhone(phone);
      setView('dashboard');
    }} />;
  }

  // --- Landing Page ---
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {/* 1. NAVIGATION BAR */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="DoctorDaily Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-extrabold text-brand tracking-tight">DoctorDaily</span>
          </div>
          
          <div className="hidden md:flex gap-6 text-sm font-medium text-gray-600 items-center">
            <a href="#features" className="hover:text-brand transition">Why Join?</a>
            <a href="#download" className="hover:text-brand transition">DoctorDaily App</a>
            <button 
              onClick={() => setView('login')} 
              className="border border-brand text-brand px-4 py-1.5 rounded-full font-bold hover:bg-brand hover:text-white transition"
            >
              Doctor Login
            </button>
            <a href="#register" className="bg-brand text-white px-4 py-1.5 rounded-full font-bold hover:opacity-80 transition">Register</a>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <header className="bg-brand text-white py-20 px-6 text-center">
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <img src="/logo.png" alt="DoctorDaily Logo" className="w-20 h-20 object-contain mb-6 bg-white rounded-2xl p-2 shadow-lg" />
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
            Grow your practice.<br/>Manage appointments effortlessly.
          </h1>
          <p className="text-lg md:text-xl text-brand-100 mb-8 max-w-2xl mx-auto opacity-90">
            Join Sonitpur's fastest-growing healthcare network. Connect with patients, manage your queue, and say goodbye to no-shows.
          </p>
          <a href="#register" className="bg-white text-brand font-bold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transition transform hover:-translate-y-1 inline-block">
            Create Doctor Profile
          </a>
        </div>
      </header>

      {/* 3. FEATURES SECTION */}
      <section id="features" className="py-20 px-6 max-w-6xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800">Why partner with DoctorDaily?</h2>
          <p className="text-gray-500 mt-2">We handle the logistics so you can focus on care.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-xl font-bold mb-2 text-gray-800">Smart Scheduling</h3>
            <p className="text-gray-500 text-sm">Patients book exact time slots, reducing crowding in your waiting room and keeping your day organized.</p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="text-4xl mb-4">🛡️</div>
            <h3 className="text-xl font-bold mb-2 text-gray-800">Verified Network</h3>
            <p className="text-gray-500 text-sm">We verify every doctor via the NMC registry. Being part of a trusted platform builds instant patient confidence.</p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="text-4xl mb-4">📈</div>
            <h3 className="text-xl font-bold mb-2 text-gray-800">Zero Setup Cost</h3>
            <p className="text-gray-500 text-sm">Create your profile for free. No monthly subscription fees. You only pay a small platform fee per confirmed booking.</p>
          </div>
        </div>
      </section>

      {/* 4. DOWNLOAD APP & RATINGS */}
      <section id="download" className="bg-gray-100 py-20 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="md:w-1/2">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">DoctorDaily App</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Encourage your patients to download DoctorDaily. They can view your live availability, book instantly, and receive digital tokens right on their phones.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-6 mt-6">
              <a href="https://github.com/Prasanta-144/mina-app-apks/releases/download/v1/DoctorDaily-v1.apk" className="bg-brand text-white px-8 py-3 rounded-xl flex items-center justify-center font-bold hover:bg-opacity-90 transition shadow-md whitespace-nowrap">
                Download APK
              </a>
              
              <div className="flex flex-col items-center">
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://github.com/Prasanta-144/mina-app-apks/releases/download/v1/DoctorDaily-v1.apk" 
                  alt="Scan to download DoctorDaily" 
                  className="w-24 h-24 rounded-lg shadow-sm border border-gray-200"
                />
                <span className="text-xs text-gray-500 mt-2">Scan to download</span>
              </div>
            </div>
          </div>
          
          <div className="md:w-1/2 bg-white p-8 rounded-2xl shadow-lg border border-gray-200 text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-2">How was your experience?</h3>
            <p className="text-sm text-gray-500 mb-4">Rate our web portal to help us improve.</p>
            <div className="flex justify-center gap-2 text-3xl text-yellow-400 mb-4 cursor-pointer">
              <span>★</span><span>★</span><span>★</span><span>★</span><span className="text-gray-300">★</span>
            </div>
            <textarea placeholder="Leave a comment (optional)..." className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm resize-none" rows="2"></textarea>
            <button className="mt-3 text-brand font-bold text-sm hover:underline">Submit Feedback</button>
          </div>
        </div>
      </section>

      {/* 5. REGISTRATION FORM */}
      <section id="register" className="py-20 px-6 max-w-lg mx-auto w-full">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Create Your Profile</h2>
          <p className="text-gray-500 mt-2">Join the network in under 2 minutes.</p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
          <div id="recaptcha-container"></div>

          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Welcome, Doctor</h2>
                <p className="text-sm text-gray-500">Verify your mobile number to get started.</p>
              </div>
              <input type="tel" placeholder="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
              <button onClick={handleSendOtp} disabled={loading} className="w-full bg-brand text-white p-3 rounded-lg font-bold hover:opacity-90 transition">
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Verify OTP</h2>
                <p className="text-sm text-gray-500">Enter the 6-digit code sent to your phone.</p>
              </div>
              <input type="text" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
              <button onClick={handleVerifyOtp} disabled={loading} className="w-full bg-brand text-white p-3 rounded-lg font-bold hover:opacity-90 transition">
                {loading ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Complete Your Profile</h2>
                <p className="text-sm text-gray-500">Provide accurate details for patient booking.</p>
              </div>

              <input name="name" type="text" placeholder="Full Name (e.g. Dr. Anil Sharma)" required onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
              
              <div className="flex gap-4">
                <input name="qualifications" type="text" placeholder="Qualifications (MBBS, MD)" required onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
                <input name="experienceYears" type="number" placeholder="Years of Exp." required onChange={handleInput} className="w-1/3 border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
              </div>

              <select name="specialization" onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white">
                <option value="General Medicine">General Medicine</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Pediatrics">Pediatrics</option>
                <option value="Orthopedics">Orthopedics</option>
                <option value="Dermatology">Dermatology</option>
              </select>
              
              <input name="clinicName" type="text" placeholder="Clinic / Hospital Name" required onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
              <input name="clinicAddress" type="text" placeholder="Full Clinic Address" required onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
              <input name="consultationFee" type="number" placeholder="Consultation Fee (₹)" required onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
              
              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">NMC Registration Number</label>
                <input name="nmcRegistrationId" type="text" placeholder="e.g. 2000010031" required onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
                <p className="text-xs text-gray-500 mt-1">We verify this instantly against the National Medical Commission database.</p>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-brand text-white p-3 rounded-lg font-bold hover:opacity-90 transition mt-4">
                {loading ? "Verifying Credentials..." : "Submit Application"}
              </button>
            </form>
          )}

          {step === 4 && (
            <div className="text-center space-y-4 py-8">
              <div className="text-6xl">✅</div>
              <h3 className="text-2xl font-bold text-gray-800">Verification Successful!</h3>
              <p className="text-gray-600 leading-relaxed">Your NMC registration was verified. Your profile is now live, and patients can book appointments with you immediately.</p>
            </div>
          )}
        </div>
      </section>

      {/* 6. FOOTER */}
      <footer className="bg-white py-8 border-t border-gray-200 mt-auto text-center text-sm text-gray-500">
        <p>© 2026 DoctorDaily. All rights reserved.</p>
        <p className="mt-1 font-medium text-gray-600">Developed at Mina App Studios</p>
        <div className="flex justify-center gap-4 mt-2">
          <a href="https://github.com/Prasanta-144/doctordaily-portal" target="_blank" rel="noreferrer" className="hover:text-brand">Privacy Policy</a>
          <a href="https://github.com/Prasanta-144/doctordaily-portal" target="_blank" rel="noreferrer" className="hover:text-brand">Terms of Service</a>
          <a href="https://github.com/Prasanta-144/doctordaily-portal" target="_blank" rel="noreferrer" className="hover:text-brand">Contact Support</a>
        </div>
      </footer>

    </div>
  );
}