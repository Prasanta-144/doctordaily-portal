import { useState, useEffect } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db } from "./firebase";
import DoctorDashboard from './DoctorDashboard';
import DoctorLogin from './DoctorLogin';
import VerifyTicket from './VerifyTicket';

export default function App() {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  
  // --- Check localStorage on initial load ---
  const [loggedInPhone, setLoggedInPhone] = useState(() => {
    return localStorage.getItem('doctorPhone') || '';
  });
  
  const [view, setView] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    const savedPhone = localStorage.getItem('doctorPhone');
    
    if (hash === 'dashboard' && savedPhone) return 'dashboard';
    if (hash === 'login') return 'login';
    
    return 'landing';
  });

  // --- Update URL hash when the view changes ---
  useEffect(() => {
    if (view === 'dashboard') {
      window.location.hash = 'dashboard';
    } else if (view === 'login') {
      window.location.hash = 'login';
    } else {
      if (window.location.hash) {
        window.history.pushState("", document.title, window.location.pathname + window.location.search);
      }
    }
  }, [view]);

  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [mapLocation, setMapLocation] = useState('');

  const [formData, setFormData] = useState({
    name: '', medicalStream: 'MBBS', specialization: 'General Medicine', qualifications: '', 
    experienceYears: '', clinicName: '', clinicAddress: '', consultationFee: '', registrationId: ''
  });

  const handleSendOtp = async () => {
    if (phone.length !== 10) return alert("Enter a 10-digit number");
    setLoading(true);
    try {
      if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      const confirmation = await signInWithPhoneNumber(auth, `+91${phone}`, window.recaptchaVerifier);
      window.confirmationResult = confirmation;
      setStep(2);
    } catch (error) {
      alert("Error: " + error.message);
      if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
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

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = auth.currentUser;
      
      // Safety check: Ensure user is authenticated
      if (!user) {
        throw new Error("Your session has expired. Please verify your phone number again.");
      }
      
      let photoUrl = "";
      if (photo) {
        const storage = getStorage();
        const storageRef = ref(storage, `doctor_photos/${user.uid}_profile.jpg`);
        await uploadBytes(storageRef, photo);
        photoUrl = await getDownloadURL(storageRef);
      }

      await setDoc(doc(db, "doctors", user.uid), {
        uid: user.uid,
        phone: user.phoneNumber,
        name: formData.name,
        medicalStream: formData.medicalStream,
        specialization: formData.specialization,
        qualifications: formData.qualifications,
        experienceYears: Number(formData.experienceYears),
        clinicName: formData.clinicName,
        clinicAddress: formData.clinicAddress,
        consultationFee: Number(formData.consultationFee),
        registrationId: formData.registrationId || "", // Optional now
        verificationStatus: "pending", // <-- Default to pending
        status: "approved", 
        active: true,
        subscriptionStatus: "trial",
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        photoUrl: photoUrl,
        mapLocation: mapLocation
      });

      setStep(4); 
    } catch (error) {
      alert("Registration failed: " + error.message);
    }
    setLoading(false);
  };

  const handleInput = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const getRegistrationLabel = () => {
    switch(formData.medicalStream) {
      case 'Dentist': return 'DCI / State Dental Council Registration Number (Optional)';
      case 'Homeopathy': return 'CCH Registration Number (Optional)';
      case 'Ayurveda': return 'NCISM Registration Number (Optional)';
      case 'Veterinary': return 'VCI Registration Number (Optional)';
      default: return 'NMC Registration Number (Optional)';
    }
  };

  const urlParams = new URLSearchParams(window.location.search);
  const verifyId = urlParams.get('verify');
  
  if (window.location.pathname === '/verify' || verifyId) {
    return <VerifyTicket appointmentId={verifyId} />;
  }

  if (view === 'dashboard') {
    return (
      <DoctorDashboard 
        doctorPhone={loggedInPhone} 
        onLogout={() => {
          localStorage.removeItem('doctorPhone'); 
          setLoggedInPhone('');
          setView('landing');
        }} 
      />
    );
  }

  if (view === 'login') {
    return (
      <DoctorLogin 
        onLogin={(phone) => {
          localStorage.setItem('doctorPhone', phone); 
          setLoggedInPhone(phone);
          setView('dashboard');
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="DoctorDaily Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-extrabold text-brand tracking-tight">DoctorDaily</span>
          </div>
          
          <div className="hidden md:flex gap-6 text-sm font-medium text-gray-600 items-center">
            <a href="#features" className="hover:text-brand transition">Why Join?</a>
            <a href="#download" className="hover:text-brand transition">DoctorDaily App</a>
            
            {loggedInPhone && (
              <button onClick={() => { window.location.hash = 'dashboard'; setView('dashboard'); }} className="text-brand font-bold hover:underline">
                Go to Dashboard
              </button>
            )}

            <button onClick={() => { window.location.hash = 'login'; setView('login'); }} className="border border-brand text-brand px-4 py-1.5 rounded-full font-bold hover:bg-brand hover:text-white transition">
              Doctor Login
            </button>
            <a href="#register" className="bg-brand text-white px-4 py-1.5 rounded-full font-bold hover:opacity-80 transition">Register</a>
          </div>
        </div>
      </nav>

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
            <h3 className="text-xl font-bold mb-2 text-gray-800">Build Instant Trust</h3>
            <p className="text-gray-500 text-sm">Get the Verified Blue Tick on your profile by providing your registration details. Stand out and build instant patient confidence.</p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="text-4xl mb-4">🎁</div>
            <h3 className="text-xl font-bold mb-2 text-gray-800">1-Month Free Trial</h3>
            <p className="text-gray-500 text-sm">Try all premium features free for 30 days. After that, it's just ₹2000/month to keep your practice running smoothly.</p>
          </div>
        </div>
      </section>

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
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://github.com/Prasanta-144/mina-app-apks/releases/download/v1/DoctorDaily-v1.apk" alt="Scan to download DoctorDaily" className="w-24 h-24 rounded-lg shadow-sm border border-gray-200" />
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

              <div className="flex flex-col items-center mb-4">
                <div className="w-24 h-24 rounded-full border-4 border-gray-100 overflow-hidden bg-gray-50 flex items-center justify-center mb-3">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl text-gray-300">📷</span>
                  )}
                </div>
                <label className="text-sm font-bold text-brand cursor-pointer hover:underline">
                  Add Profile Photo (Optional)
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </label>
              </div>

              <input name="name" type="text" placeholder="Full Name (e.g. Dr. Anil Sharma)" required onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
              
              <div className="flex gap-4">
                <input name="qualifications" type="text" placeholder="Qualifications (e.g. BDS, MDS)" required onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
                <input name="experienceYears" type="number" placeholder="Years of Exp." required onChange={handleInput} className="w-1/3 border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medical Stream</label>
                <select name="medicalStream" value={formData.medicalStream} onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white">
                  <option value="MBBS">MBBS (Allopathy)</option>
                  <option value="Dentist">Dentist (BDS/MDS)</option>
                  <option value="Homeopathy">Homeopathy (BHMS)</option>
                  <option value="Ayurveda">Ayurveda (BAMS)</option>
                  <option value="Veterinary">Veterinary (BVSc)</option>
                </select>
              </div>

               <select name="specialization" onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white">
                <option value="General Medicine">General Medicine</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Pediatrics">Pediatrics</option>
                <option value="Orthopedics">Orthopedics</option>
                <option value="Dermatology">Dermatology</option>
                <option value="ENT (Ear, Nose, Throat)">ENT (Ear, Nose, Throat)</option>
                <option value="Gynecology & Obstetrics">Gynecology & Obstetrics</option>
                <option value="Ophthalmology">Ophthalmology</option>
                <option value="Psychiatry">Psychiatry</option>
                <option value="Neurology">Neurology</option>
                <option value="Gastroenterology">Gastroenterology</option>
                <option value="Pulmonology">Pulmonology</option>
                <option value="Urology">Urology</option>
                <option value="Nephrology">Nephrology</option>
                <option value="Oncology">Oncology</option>
                <option value="Endocrinology">Endocrinology</option>
                <option value="Rheumatology">Rheumatology</option>
                <option value="Dentistry">Dentistry</option>
                <option value="Physiotherapy">Physiotherapy</option>
              </select>
              
              <input name="clinicName" type="text" placeholder="Clinic / Hospital Name" required onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
              <input name="clinicAddress" type="text" placeholder="Full Clinic Address" required onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
              
              <div className="pt-1">
                <input 
                  value={mapLocation} 
                  onChange={(e) => setMapLocation(e.target.value)} 
                  placeholder="Google Maps Link (Optional)" 
                  className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" 
                />
                <p className="text-xs text-gray-500 mt-1">Paste your clinic's Google Maps link so patients can find you easily.</p>
              </div>

              <input name="consultationFee" type="number" placeholder="Consultation Fee (₹)" required onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
              
              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">{getRegistrationLabel()}</label>
                <input name="registrationId" type="text" placeholder="Enter your registration number" onChange={handleInput} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none" />
                <p className="text-xs text-gray-500 mt-1">
                  You can provide this now or later to get the <b>Verified Blue Tick</b>. You can start accepting patients immediately.
                </p>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-brand text-white p-3 rounded-lg font-bold hover:opacity-90 transition mt-4">
                {loading ? "Processing..." : "Submit Application"}
              </button>
            </form>
          )}

          {step === 4 && (
            <div className="text-center space-y-4 py-8">
              <div className="text-6xl">✅</div>
              <h3 className="text-2xl font-bold text-gray-800">Profile Created!</h3>
              <p className="text-gray-600 leading-relaxed">Your profile is now live. You can log in to your dashboard immediately and start accepting appointments.</p>
            </div>
          )}
        </div>
      </section>

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