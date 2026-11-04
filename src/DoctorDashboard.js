import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "./firebase";
import { getFunctions, httpsCallable } from "firebase/functions";

/* ---------- Small inline icons (stroke = currentColor) ---------- */
const Icon = ({ children, className = "w-[18px] h-[18px]" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {children}
  </svg>
);
const DashboardIcon = () => (
  <Icon><path d="M12 4a9 9 0 0 0-9 9v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a9 9 0 0 0-9-9z" /><path d="M12 13l3-3" /><circle cx="12" cy="13" r="1" /></Icon>
);
const CalendarIcon = () => (
  <Icon><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></Icon>
);
const HomeIcon = () => (
  <Icon><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></Icon>
);
const SignOutIcon = () => (
  <Icon><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></Icon>
);
const TrashIcon = () => (
  <Icon className="w-3.5 h-3.5"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></Icon>
);
const WarnIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z" /></svg>
);
const CardIcon = () => (
  <Icon className="w-3.5 h-3.5"><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20M6 15h4" /></Icon>
);
const HourglassIcon = () => (
  <Icon className="w-6 h-6"><path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" /></Icon>
);
const CalendarPlusWatermark = () => (
  <svg viewBox="0 0 160 160" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-44 h-44">
    <rect x="18" y="28" width="104" height="96" rx="14" />
    <path d="M18 56h104M46 16v20M94 16v20" />
    <g strokeWidth="2.5">
      <path d="M34 72h6M52 72h6M70 72h6M34 88h6M52 88h6M34 104h6M52 104h6" />
    </g>
    <rect x="76" y="84" width="62" height="62" rx="12" fill="#3F3590" />
    <path d="M107 100v30M92 115h30" strokeWidth="5" />
  </svg>
);

export default function DoctorDashboard({ doctorPhone, onLogout }) {
  const [appointments, setAppointments] = useState([]);
  const [doctorName, setDoctorName] = useState('');
  const [doctorFee, setDoctorFee] = useState(0);
  const [doctorId, setDoctorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Navigation & View States
  const [activeTab, setActiveTab] = useState('queue');
  const [earningsView, setEarningsView] = useState('daily');
  
  // --- NEW: Date Selector for Daily Earnings ---
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // Default to Today

  // Generate the last 7 days for the selector
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return {
      fullDate: d.toISOString().split('T')[0], // YYYY-MM-DD
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dateNum: d.getDate()
    };
  }).reverse(); // Show oldest to newest

  // --- SUBSCRIPTION STATE ---
  const [subscription, setSubscription] = useState({
    status: 'trial',
    trialEndsAt: null,
    daysLeft: 0,
    isDue: false
  });

  // --- EDIT PROFILE STATE ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', clinicName: '', clinicAddress: '', mapLocation: '', consultationFee: 0
  });
  const [editPhoto, setEditPhoto] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // Schedule State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [dateToBlock, setDateToBlock] = useState("");
  const [schedule, setSchedule] = useState({
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    startTime: "10:00",
    endTime: "17:00",
    slotDuration: 30,
    blockedDates: []
  });

  useEffect(() => {
    const fetchDoctorData = async () => {
      setLoading(true);
      setError(null);

      try {
        const phoneE164 = doctorPhone.startsWith("+91") ? doctorPhone : `+91${doctorPhone}`;
        const doctorsRef = collection(db, "doctors");
        const q = query(doctorsRef, where("phone", "==", phoneE164));
        const doctorSnapshot = await getDocs(q);

        if (doctorSnapshot.empty) {
          setError("No doctor found with this phone number. Please register first.");
          setLoading(false);
          return;
        }

        const doctorDoc = doctorSnapshot.docs[0];
        const doctorData = doctorDoc.data();

        setDoctorId(doctorDoc.id);
        setDoctorName(doctorData.name);
        setDoctorFee(doctorData.consultationFee || 500);
        
        // Populate Edit Form
        setEditForm({
          name: doctorData.name || '',
          clinicName: doctorData.clinicName || '',
          clinicAddress: doctorData.clinicAddress || '',
          mapLocation: doctorData.mapLocation || '',
          consultationFee: doctorData.consultationFee || 500
        });
        setEditPhotoPreview(doctorData.photoUrl || null);

        // CALCULATE SUBSCRIPTION STATUS
        if (doctorData.trialEndsAt) {
          const trialEnd = doctorData.trialEndsAt.toDate
            ? doctorData.trialEndsAt.toDate()
            : new Date(doctorData.trialEndsAt);

          const now = new Date();
          const diffTime = trialEnd - now;
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          setSubscription({
            status: doctorData.subscriptionStatus || 'trial',
            trialEndsAt: trialEnd,
            daysLeft: daysLeft,
            isDue: daysLeft <= 7
          });
        }

        if (doctorData.schedule) {
          setSchedule({
            ...doctorData.schedule,
            blockedDates: doctorData.schedule.blockedDates || []
          });
        }

        const appointmentsRef = collection(db, "appointments");
        const apptQuery = query(appointmentsRef, where("doctorId", "==", doctorDoc.id));
        const apptSnapshot = await getDocs(apptQuery);

        const appts = apptSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).filter(a => ["Pending", "Upcoming", "Completed"].includes(a.status));

        appts.sort((a, b) => {
          if (a.status === "Pending" && b.status !== "Pending") return -1;
          if (a.status !== "Pending" && b.status === "Pending") return 1;
          return 0;
        });

        setAppointments(appts);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to connect to database.");
      }
      setLoading(false);
    };

    fetchDoctorData();
  }, [doctorPhone, onLogout]);

  // --- EDIT PROFILE HANDLER ---
  const handleEditPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditPhoto(file);
      setEditPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      let photoUrl = editPhotoPreview;

      if (editPhoto) {
        const storage = getStorage();
        const storageRef = ref(storage, `doctor_photos/${doctorId}_profile.jpg`);
        await uploadBytes(storageRef, editPhoto);
        photoUrl = await getDownloadURL(storageRef);
      }

      await updateDoc(doc(db, "doctors", doctorId), {
        name: editForm.name,
        clinicName: editForm.clinicName,
        clinicAddress: editForm.clinicAddress,
        mapLocation: editForm.mapLocation,
        consultationFee: Number(editForm.consultationFee),
        photoUrl: photoUrl
      });

      setDoctorName(editForm.name);
      setDoctorFee(Number(editForm.consultationFee));
      setShowEditModal(false);
      alert("Profile updated successfully!");

    } catch (error) {
      alert("Error updating profile: " + error.message);
    }
    setEditLoading(false);
  };

  // --- SUBSCRIPTION PAYMENT HANDLER ---
  const handleSubscriptionPayment = async () => {
    try {
      const functions = getFunctions();
      const createOrder = httpsCallable(functions, 'createSubscriptionOrder');
      const result = await createOrder();
      const { orderId, amount } = result.data;

      const options = {
        key: "rzp_test_Tvbffal0a4v3Hu",
        amount: amount,
        currency: "INR",
        name: "DoctorDaily",
        description: "Monthly Subscription (₹2000)",
        order_id: orderId,
        handler: async function (response) {
          const newTrialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          await updateDoc(doc(db, "doctors", doctorId), {
            subscriptionStatus: "active",
            trialEndsAt: newTrialEnd,
            lastPaymentId: response.razorpay_payment_id
          });

          setSubscription({ status: 'active', trialEndsAt: newTrialEnd, daysLeft: 30, isDue: false });
          alert("Payment successful! Your account is active for another 30 days.");
        },
        prefill: { name: doctorName, contact: doctorPhone },
        theme: { color: "#5E5AA8" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      alert("Error initiating payment: " + error.message);
    }
  };

  const updateStatus = async (appointmentId, newStatus) => {
    try {
      await updateDoc(doc(db, "appointments", appointmentId), { status: newStatus });
      setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: newStatus } : a));
    } catch (error) { alert("Error updating: " + error.message); }
  };

  const requestReschedule = async (appt) => {
    if (!window.confirm(`Request ${appt.patient} to choose a new date or get a refund?`)) return;
    try {
      await updateDoc(doc(db, "appointments", appt.id), { status: "Pending", rescheduleRequested: true });
      setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: "Pending", rescheduleRequested: true } : a));
    } catch (error) { alert("Error updating: " + error.message); }
  };

  const saveSchedule = async () => {
    if (!doctorId) return;
    try {
      await updateDoc(doc(db, "doctors", doctorId), { schedule: schedule });
      alert("Schedule updated successfully!");
      setShowScheduleModal(false);
    } catch (error) { alert("Error saving schedule: " + error.message); }
  };

  const clearCompleted = async () => {
    const completedAppts = appointments.filter(a => a.status === "Completed" && !a.clearedByDoctor);
    if (completedAppts.length === 0) return;

    try {
      const promises = completedAppts.map(appt =>
        updateDoc(doc(db, "appointments", appt.id), { clearedByDoctor: true })
      );
      await Promise.all(promises);
      setAppointments(prev => prev.map(a =>
        a.status === "Completed" ? { ...a, clearedByDoctor: true } : a
      ));
    } catch (error) {
      alert("Error clearing completed appointments: " + error.message);
    }
  };

  // Earnings Logic
  const calculateEarnings = () => {
    const validAppts = appointments.filter(a => a.paymentStatus === "Paid" || a.status === "Completed");
    
    let filteredAppts = [];
    if (earningsView === 'daily') {
      filteredAppts = validAppts.filter(a => {
        if (a.createdAt) {
          const date = a.createdAt.toDate();
          const dateStr = date.toISOString().split('T')[0];
          return dateStr === selectedDate;
        }
        // Fallback for older test appointments without createdAt
        return a.dayLabel === "Today" || a.dayLabel === new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      });
    } else {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      filteredAppts = validAppts.filter(a => {
        if (a.createdAt) {
          const date = a.createdAt.toDate();
          return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        }
        return true;
      });
    }
    const total = filteredAppts.reduce((sum, a) => sum + (a.consultationFee || doctorFee), 0);
    return { total, count: filteredAppts.length, appointments: filteredAppts };
  };

  const { total: totalEarnings, count: patientCount, appointments: earningsList } = calculateEarnings();
  const displayedAppointments = appointments.filter(a => !a.clearedByDoctor);

  // --- LAYOUT ---
  return (
    <div className="flex h-screen bg-[#F7F6FC] font-sans overflow-hidden">

      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-gradient-to-b from-[#4C41A6] to-[#3B3188] hidden md:flex flex-col justify-between shadow-xl z-20 relative overflow-hidden">
        <div className="relative z-10">
          <div className="px-5 pt-6 pb-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-sm">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-extrabold text-white tracking-tight">DoctorDaily</span>
          </div>

          <nav className="px-4 mt-2 space-y-1.5">
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-white/15 text-white rounded-xl text-sm font-bold transition">
              <DashboardIcon /> Dashboard
            </button>
            <button onClick={() => setShowEditModal(true)} className="w-full flex items-center gap-3 px-4 py-3 text-white/90 hover:bg-white/10 rounded-xl text-sm font-bold transition">
              <span className="text-lg">✏️</span> Edit Profile
            </button>
            <button onClick={() => setShowScheduleModal(true)} className="w-full flex items-center gap-3 px-4 py-3 text-white/90 hover:bg-white/10 rounded-xl text-sm font-bold transition">
              <CalendarIcon /> Manage Schedule
            </button>
            <a href="/" className="w-full flex items-center gap-3 px-4 py-3 text-white/90 hover:bg-white/10 rounded-xl text-sm font-bold transition">
              <HomeIcon /> Homepage
            </a>

            <div className="border-t border-white/15 my-4 mx-1" />

            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-[#FF8FA8] hover:bg-white/10 rounded-xl text-sm font-bold transition">
              <SignOutIcon /> Sign Out
            </button>
          </nav>
        </div>

        <div className="relative z-0 flex justify-start pl-4 pb-4 opacity-[0.12] pointer-events-none translate-y-4">
          <CalendarPlusWatermark />
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-white via-[#F8F7FD] to-[#EFEDFA]">
        <div className="max-w-5xl mx-auto p-6 md:p-10">

          {/* SUBSCRIPTION BANNER */}
          {subscription.isDue && (
            <div className={`mb-8 px-5 py-4 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm ${
              subscription.daysLeft <= 0 ? 'bg-rose-50 border-rose-200' : 'bg-[#F1EFFB] border-[#DDD8F3]'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 flex items-center justify-center rounded-full shrink-0 bg-white shadow-sm ${
                  subscription.daysLeft <= 0 ? 'text-rose-600' : 'text-[#6B5FC7]'
                }`}>
                  {subscription.daysLeft <= 0 ? <span className="text-xl">⚠️</span> : <HourglassIcon />}
                </div>
                <div>
                  <h3 className={`font-bold ${subscription.daysLeft <= 0 ? 'text-rose-800' : 'text-[#2B2468]'}`}>
                    {subscription.daysLeft <= 0 ? "Subscription Overdue" : "Payment Due Soon"}
                  </h3>
                  <p className={`text-sm mt-0.5 ${subscription.daysLeft <= 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                    {subscription.daysLeft <= 0
                      ? "Your free trial has ended. Please pay to avoid suspension."
                      : `Your monthly subscription of ₹2000 is due in ${subscription.daysLeft} days. Pay now to avoid service interruption.`}
                  </p>
                </div>
              </div>
              <button onClick={handleSubscriptionPayment} className="w-full md:w-auto bg-[#4C41A6] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#3F3590] shadow-md transition whitespace-nowrap">
                Pay ₹2000 →
              </button>
            </div>
          )}

          {/* HEADER SECTION */}
          <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
            <div>
              <h1 className="text-4xl font-extrabold text-[#322B7B] tracking-tight">Doctor Dashboard</h1>
              <p className="text-slate-800 mt-3 text-sm font-bold">Welcome back, {doctorName || "Loading..."}</p>
              <p className="text-xs text-slate-500 mt-1">
                Logged in as: <span className="text-[#5E5AA8] font-semibold">{doctorPhone}</span>
              </p>
            </div>

            {/* Desktop quick actions */}
            <div className="hidden md:flex items-center gap-4 mt-1">
              <button onClick={() => setShowEditModal(true)} className="text-sm font-bold text-slate-600 hover:text-[#4C41A6] transition">
                Edit Profile
              </button>
              <button onClick={() => setShowScheduleModal(true)} className="text-sm font-bold text-[#4C41A6] border border-[#4C41A6] px-5 py-2 rounded-full hover:bg-[#4C41A6]/5 transition">
                Manage Schedule
              </button>
              <a href="/" className="text-sm font-bold text-slate-800 hover:text-[#4C41A6] transition">Homepage</a>
              <span className="w-px h-5 bg-slate-300" />
              <button onClick={onLogout} className="text-sm font-bold text-[#E5456B] hover:text-rose-700 transition">Sign Out</button>
            </div>

            {/* Mobile Menu Buttons */}
            <div className="flex md:hidden gap-3 w-full">
              <button onClick={() => setShowEditModal(true)} className="flex-1 text-sm font-bold bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl">Edit Profile</button>
              <button onClick={() => setShowScheduleModal(true)} className="flex-1 text-sm font-bold bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl">Schedule</button>
              <button onClick={onLogout} className="flex-1 text-sm font-bold bg-rose-50 text-rose-600 px-4 py-2 rounded-xl">Sign Out</button>
            </div>
          </div>

          {/* TABS */}
          <div className="flex gap-8 mb-6 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('queue')}
              className={`text-sm font-bold pb-3 -mb-px transition border-b-2 ${activeTab === 'queue' ? 'text-[#4C41A6] border-[#4C41A6]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
            >
              Appointment Queue
            </button>
            <button
              onClick={() => setActiveTab('earnings')}
              className={`text-sm font-bold pb-3 -mb-px transition border-b-2 ${activeTab === 'earnings' ? 'text-[#4C41A6] border-[#4C41A6]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
            >
              Earnings
            </button>
          </div>

          {/* --- QUEUE TAB --- */}
          {activeTab === 'queue' && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  Your Queue <span className="text-slate-400">·</span>
                </h2>
                {displayedAppointments.some(a => a.status === "Completed") && (
                  <button onClick={clearCompleted} className="flex items-center gap-2 text-xs font-bold text-[#4C41A6] bg-[#EEEBFB] px-4 py-2 rounded-full hover:bg-[#E3DFF8] transition">
                    <TrashIcon /> Clear Completed
                  </button>
                )}
              </div>

              {loading ? (
                <p className="text-slate-500 font-medium">Loading appointments...</p>
              ) : error ? (
                <div className="bg-rose-50 text-rose-600 p-5 rounded-2xl border border-rose-100">
                  <p className="font-medium">{error}</p>
                  <button onClick={onLogout} className="mt-3 bg-rose-600 text-white px-5 py-2 rounded-xl font-bold">Go Back</button>
                </div>
              ) : displayedAppointments.length === 0 ? (
                <div className="bg-white p-10 text-center rounded-3xl shadow-sm border border-slate-200">
                  <p className="text-slate-400 font-medium">No appointments in the queue right now.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {displayedAppointments.map((appt) => {
                    const isPending = appt.status === "Pending";
                    const isCompleted = appt.status === "Completed";
                    const hasActions = (isPending && !appt.rescheduleRequested) || appt.status === "Upcoming";

                    return (
                      <div key={appt.id} className={`bg-white rounded-2xl border border-[#E6E3F5] border-l-[6px] border-l-[#C9C3EE] shadow-[0_2px_10px_rgba(76,65,166,0.07)] px-5 py-4 transition ${
                        isCompleted ? 'opacity-70' : ''
                      }`}>
                        <div className="flex justify-between items-center gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="text-lg font-extrabold text-[#2B2468]">{appt.patient}</h3>
                              {isPending && !appt.rescheduleRequested && (
                                <span className="inline-flex items-center gap-1 bg-[#FDE4EA] text-[#D6456B] border border-[#F9C9D4] text-[10px] px-2.5 py-1 rounded-full font-bold">
                                  <WarnIcon /> Awaiting Patient Action
                                </span>
                              )}
                              {appt.rescheduleRequested && (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2.5 py-1 rounded-full font-bold">
                                  <WarnIcon /> Awaiting Reschedule
                                </span>
                              )}
                              {isCompleted && (
                                <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] px-2.5 py-1 rounded-full font-bold">Completed</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600">Phone: {appt.phone || "Not provided"}</p>

                            <div className="flex items-center gap-2 mt-3">
                              <span className="bg-[#EEEBFB] text-[#4C41A6] text-xs font-bold px-3 py-1.5 rounded-lg">
                                {appt.dayLabel} at {appt.slot}
                              </span>
                              <span className="w-px h-4 bg-slate-300" />
                              <span className="bg-[#EEEBFB] text-[#4C41A6] text-xs font-bold px-3 py-1.5 rounded-lg">
                                Token #{appt.token}
                              </span>
                            </div>

                            {appt.reason && (
                              <div className="mt-3 inline-block border border-slate-200 bg-white rounded-xl px-3.5 py-2 text-xs text-slate-600 shadow-sm">
                                <span className="font-bold text-slate-800">Reason:</span>{" "}
                                <span className="font-semibold ml-1">{appt.reason}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-3 shrink-0">
                            <span className={`inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full font-bold border ${
                              appt.paymentStatus === "Paid"
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {appt.paymentStatus === "Paid" ? <><CardIcon /> Paid</> : "💵 To be paid"}
                            </span>

                            {hasActions && (
                              <div className="flex gap-2">
                                {isPending && !appt.rescheduleRequested && (
                                  <>
                                    <button onClick={() => updateStatus(appt.id, "Upcoming")} className="bg-[#4C41A6] text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-[#3F3590] shadow-sm transition">Accept</button>
                                    <button onClick={() => updateStatus(appt.id, "Cancelled")} className="bg-white border border-slate-300 text-slate-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition">Decline</button>
                                  </>
                                )}
                                {appt.status === "Upcoming" && (
                                  <>
                                    <button onClick={() => updateStatus(appt.id, "Completed")} className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-100 transition">
                                      Complete
                                    </button>
                                    <button onClick={() => requestReschedule(appt)} className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-100 transition">
                                      Reschedule
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* --- EARNINGS TAB --- */}
          {activeTab === 'earnings' && (
            <div>
              <div className="flex bg-[#EEEBFB] p-1 rounded-xl w-max mb-6">
                <button onClick={() => setEarningsView('daily')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${earningsView === 'daily' ? 'bg-white text-[#4C41A6] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Daily</button>
                <button onClick={() => setEarningsView('monthly')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${earningsView === 'monthly' ? 'bg-white text-[#4C41A6] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Monthly</button>
              </div>

              {/* --- NEW: DATE SELECTOR FOR DAILY VIEW --- */}
              {earningsView === 'daily' && (
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                  {last7Days.map(day => (
                    <button
                      key={day.fullDate}
                      onClick={() => setSelectedDate(day.fullDate)}
                      className={`flex flex-col items-center justify-center min-w-[70px] p-2.5 rounded-xl border transition ${
                        selectedDate === day.fullDate
                          ? 'bg-[#4C41A6] text-white border-[#4C41A6] shadow-md'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-bold uppercase">{day.dayName}</span>
                      <span className="text-xl font-black">{day.dateNum}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gradient-to-br from-[#4C41A6] to-[#3B3188] text-white p-8 rounded-3xl shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10 text-8xl font-serif">₹</div>
                  <p className="text-indigo-200 font-medium mb-1">
                    Total Earnings ({earningsView === 'daily' ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' }) : 'This Month'})
                  </p>
                  <h3 className="text-5xl font-black tracking-tight">₹{totalEarnings}</h3>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#E6E3F5] relative">
                  <div className="absolute top-0 right-0 p-6 opacity-5 text-8xl">👥</div>
                  <p className="text-slate-500 font-medium mb-1">
                    Patients Seen ({earningsView === 'daily' ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' }) : 'This Month'})
                  </p>
                  <h3 className="text-5xl font-black tracking-tight text-[#2B2468]">{patientCount}</h3>
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Transactions</h3>
              {earningsList.length === 0 ? (
                <div className="bg-white p-10 text-center rounded-3xl shadow-sm border border-slate-200">
                  <p className="text-slate-400 font-medium">No earnings recorded for this period yet.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-[#E6E3F5] overflow-hidden">
                  {earningsList.map((appt, index) => (
                    <div key={appt.id} className={`p-5 flex justify-between items-center ${index !== earningsList.length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <div>
                        <p className="font-bold text-[#2B2468]">{appt.patient}</p>
                        <p className="text-sm text-slate-500">{appt.dayLabel} · Token #{appt.token}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">+ ₹{appt.consultationFee || doctorFee}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase">{appt.paymentStatus === 'Paid' ? 'Online' : 'Cash/Clinic'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* --- EDIT PROFILE MODAL --- */}
      {showEditModal && (
        <div className="fixed inset-0 bg-[#1E1A4D]/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full my-8">
            <h3 className="text-2xl font-extrabold text-[#322B7B] mb-4">Edit Profile</h3>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="flex flex-col items-center mb-4">
                <div className="w-24 h-24 rounded-full border-4 border-slate-100 overflow-hidden bg-slate-50 flex items-center justify-center mb-3">
                  {editPhotoPreview ? (
                    <img src={editPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl text-slate-300">📷</span>
                  )}
                </div>
                <label className="text-sm font-bold text-[#4C41A6] cursor-pointer hover:underline">
                  Change Photo
                  <input type="file" accept="image/*" onChange={handleEditPhotoChange} className="hidden" />
                </label>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Doctor Name</label>
                <input 
                  type="text" 
                  value={editForm.name} 
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})} 
                  className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6]" 
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Clinic Name</label>
                <input 
                  type="text" 
                  value={editForm.clinicName} 
                  onChange={(e) => setEditForm({...editForm, clinicName: e.target.value})} 
                  className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6]" 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Clinic Address</label>
                <input 
                  type="text" 
                  value={editForm.clinicAddress} 
                  onChange={(e) => setEditForm({...editForm, clinicAddress: e.target.value})} 
                  className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6]" 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Google Maps Link (Optional)</label>
                <input 
                  type="text" 
                  value={editForm.mapLocation} 
                  onChange={(e) => setEditForm({...editForm, mapLocation: e.target.value})} 
                  className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6]" 
                  placeholder="https://maps.google.com/..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Consultation Fee (₹)</label>
                <input 
                  type="number" 
                  value={editForm.consultationFee} 
                  onChange={(e) => setEditForm({...editForm, consultationFee: e.target.value})} 
                  className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6]" 
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition">Cancel</button>
                <button type="submit" disabled={editLoading} className="flex-1 bg-[#4C41A6] text-white py-3 rounded-xl font-bold hover:bg-[#3F3590] shadow-sm transition">
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-[#1E1A4D]/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full my-8">
            <h3 className="text-2xl font-extrabold text-[#322B7B] mb-4">Manage Availability</h3>

            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-700 mb-2">Working Days</label>
              <div className="flex flex-wrap gap-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                  <button
                    key={day}
                    onClick={() => {
                      const newDays = schedule.workingDays.includes(day)
                        ? schedule.workingDays.filter(d => d !== day)
                        : [...schedule.workingDays, day];
                      setSchedule({ ...schedule, workingDays: newDays });
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-bold border transition ${
                      schedule.workingDays.includes(day)
                        ? "bg-[#4C41A6] text-white border-[#4C41A6] shadow-sm"
                        : "bg-white text-slate-500 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4 mb-5">
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Start Time</label>
                <input type="time" value={schedule.startTime} onChange={(e) => setSchedule({ ...schedule, startTime: e.target.value })} className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6]" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">End Time</label>
                <input type="time" value={schedule.endTime} onChange={(e) => setSchedule({ ...schedule, endTime: e.target.value })} className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6]" />
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-700 mb-2">Slot Duration</label>
              <select value={schedule.slotDuration} onChange={(e) => setSchedule({ ...schedule, slotDuration: Number(e.target.value) })} className="w-full border border-slate-300 p-2.5 rounded-xl bg-white outline-none focus:border-[#4C41A6]">
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>

            <div className="mb-8 p-4 bg-[#F7F6FC] rounded-2xl border border-[#E6E3F5]">
              <label className="block text-sm font-bold text-slate-700 mb-2">Block a Date (Mark as Full)</label>
              <div className="flex gap-2 mb-3">
                <input type="date" value={dateToBlock} onChange={(e) => setDateToBlock(e.target.value)} className="flex-1 border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6] text-sm" />
                <button onClick={() => {
                  if (dateToBlock && !schedule.blockedDates.includes(dateToBlock)) {
                    setSchedule({ ...schedule, blockedDates: [...schedule.blockedDates, dateToBlock] });
                    setDateToBlock("");
                  }
                }} className="bg-[#4C41A6] text-white px-4 rounded-xl font-bold hover:bg-[#3F3590] text-sm">Block</button>
              </div>
              {schedule.blockedDates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {schedule.blockedDates.map(date => (
                    <span key={date} className="bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-2">
                      {date}
                      <button onClick={() => setSchedule({ ...schedule, blockedDates: schedule.blockedDates.filter(d => d !== date) })} className="hover:text-rose-900">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowScheduleModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition">Cancel</button>
              <button onClick={saveSchedule} className="flex-1 bg-[#4C41A6] text-white py-3 rounded-xl font-bold hover:bg-[#3F3590] shadow-sm transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}