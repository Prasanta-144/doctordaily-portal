import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getFunctions, httpsCallable } from "firebase/functions";

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
  
  // --- SUBSCRIPTION STATE ---
  const [subscription, setSubscription] = useState({
    status: 'trial',
    trialEndsAt: null,
    daysLeft: 0,
    isDue: false
  });

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

  // --- SUBSCRIPTION PAYMENT HANDLER ---
  const handleSubscriptionPayment = async () => {
    try {
      const functions = getFunctions();
      const createOrder = httpsCallable(functions, 'createSubscriptionOrder');
      const result = await createOrder();
      const { orderId, amount } = result.data;

      const options = {
        key: "rzp_test_Tvbffal0a4v3Hu", // YOUR RAZORPAY KEY ID
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

  const clearCompleted = () => {
    setAppointments(prev => prev.filter(a => a.status !== "Completed"));
  };

  const saveSchedule = async () => {
    if (!doctorId) return;
    try {
      await updateDoc(doc(db, "doctors", doctorId), { schedule: schedule });
      alert("Schedule updated successfully!");
      setShowScheduleModal(false);
    } catch (error) { alert("Error saving schedule: " + error.message); }
  };

  // Earnings Logic
  const calculateEarnings = () => {
    const validAppts = appointments.filter(a => a.paymentStatus === "Paid" || a.status === "Completed");
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let filteredAppts = [];
    if (earningsView === 'daily') {
      filteredAppts = validAppts.filter(a => a.dayLabel === "Today" || a.dayLabel === new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }));
    } else {
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

  // --- LAYOUT COMPONENT ---
  return (
    <div className="flex h-screen bg-[#FAFAFC] font-sans overflow-hidden">
      
      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-[#322B7B] flex flex-col justify-between hidden md:flex shadow-xl z-20">
        <div>
          {/* Logo */}
          <div className="p-6 flex items-center gap-3 border-b border-white/10">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-sm">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-extrabold text-white tracking-tight">DoctorDaily</span>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-2 mt-4">
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-[#4A429A] text-white rounded-xl font-semibold transition">
              <span className="text-lg">📊</span> Dashboard
            </button>
            <button onClick={() => setShowScheduleModal(true)} className="w-full flex items-center gap-3 px-4 py-3 text-indigo-200 hover:bg-white/10 hover:text-white rounded-xl font-medium transition">
              <span className="text-lg">📅</span> Manage Schedule
            </button>
            <a href="/" className="w-full flex items-center gap-3 px-4 py-3 text-indigo-200 hover:bg-white/10 hover:text-white rounded-xl font-medium transition">
              <span className="text-lg">🏠</span> Homepage
            </a>
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-300 hover:bg-white/10 hover:text-rose-200 rounded-xl font-medium transition mt-4 border-t border-white/10 pt-4">
              <span className="text-lg">🚪</span> Sign Out
            </button>
          </nav>
        </div>

        {/* Watermark Logo at Bottom */}
        <div className="p-8 opacity-10 flex justify-center pb-12">
           <img src="/logo.png" alt="watermark" className="w-40 h-40 object-contain brightness-0 invert" />
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 md:p-10">
          
          {/* SUBSCRIPTION BANNER */}
          {subscription.isDue && (
            <div className={`mb-8 p-5 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm ${
              subscription.daysLeft <= 0 ? 'bg-rose-50 border-rose-200' : 'bg-[#FFF9EA] border-[#FCE5B5]'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 flex items-center justify-center rounded-full shrink-0 ${
                  subscription.daysLeft <= 0 ? 'bg-rose-100 text-rose-600' : 'bg-[#FCE5B5] text-amber-700'
                }`}>
                  <span className="text-xl">{subscription.daysLeft <= 0 ? "⚠️" : "⏳"}</span>
                </div>
                <div>
                  <h3 className={`font-bold ${subscription.daysLeft <= 0 ? 'text-rose-800' : 'text-amber-900'}`}>
                    {subscription.daysLeft <= 0 ? "Subscription Overdue" : "Payment Due Soon"}
                  </h3>
                  <p className={`text-sm mt-0.5 ${subscription.daysLeft <= 0 ? 'text-rose-600' : 'text-amber-700'}`}>
                    {subscription.daysLeft <= 0 
                      ? "Your free trial has ended. Please pay to avoid suspension."
                      : `Your monthly subscription of ₹2000 is due in ${subscription.daysLeft} days. Pay now to avoid service interruption.`}
                  </p>
                </div>
              </div>
              <button onClick={handleSubscriptionPayment} className="w-full md:w-auto bg-[#5E5AA8] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-opacity-90 shadow-sm transition whitespace-nowrap">
                Pay ₹2000 →
              </button>
            </div>
          )}

          {/* HEADER SECTION */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-[#322B7B] tracking-tight">Doctor Dashboard</h1>
              <p className="text-slate-600 mt-1 font-medium">Welcome back, {doctorName || "Loading..."}</p>
              <p className="text-xs text-slate-400 mt-1">Logged in as: {doctorPhone}</p>
            </div>
            
            {/* Mobile Menu Buttons (Hidden on Desktop) */}
            <div className="flex md:hidden gap-3 w-full">
              <button onClick={() => setShowScheduleModal(true)} className="flex-1 text-sm font-bold bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl">Schedule</button>
              <button onClick={onLogout} className="flex-1 text-sm font-bold bg-rose-50 text-rose-600 px-4 py-2 rounded-xl">Sign Out</button>
            </div>
          </div>

          {/* TABS */}
          <div className="flex gap-8 mb-6 border-b border-slate-200">
            <button 
              onClick={() => setActiveTab('queue')} 
              className={`text-sm md:text-base font-bold pb-3 transition border-b-2 ${activeTab === 'queue' ? 'text-[#5E5AA8] border-[#5E5AA8]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
            >
              Appointment Queue
            </button>
            <button 
              onClick={() => setActiveTab('earnings')} 
              className={`text-sm md:text-base font-bold pb-3 transition border-b-2 ${activeTab === 'earnings' ? 'text-[#5E5AA8] border-[#5E5AA8]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
            >
              Earnings
            </button>
          </div>

          {/* --- QUEUE TAB --- */}
          {activeTab === 'queue' && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-800">Your Queue</h2>
                {appointments.some(a => a.status === "Completed") && (
                  <button onClick={clearCompleted} className="text-xs font-bold text-slate-500 bg-[#EBEBF3] px-4 py-2 rounded-full hover:bg-slate-200 transition">
                    🗑️ Clear Completed
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
              ) : appointments.length === 0 ? (
                <div className="bg-white p-10 text-center rounded-3xl shadow-sm border border-slate-200">
                  <p className="text-slate-400 font-medium">No appointments in the queue right now.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {appointments.map((appt) => {
                    const isPending = appt.status === "Pending";
                    const isCompleted = appt.status === "Completed";
                    
                    return (
                      <div key={appt.id} className={`p-5 rounded-2xl border transition ${
                        isPending ? 'bg-[#FFFDF5] border-[#FCE5B5]' : 
                        isCompleted ? 'bg-slate-50 border-slate-200 opacity-75' : 
                        'bg-white border-slate-200'
                      }`}>
                        <div className="flex justify-between items-start">
                          {/* Left Side: Patient Info */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-bold text-slate-800">{appt.patient}</h3>
                              {isPending && !appt.rescheduleRequested && (
                                <span className="bg-[#FDE8E9] text-[#D95D5D] text-[10px] px-2.5 py-1 rounded-full font-bold">⚠️ Awaiting Patient Action</span>
                              )}
                              {appt.rescheduleRequested && (
                                <span className="bg-rose-100 text-rose-700 text-[10px] px-2.5 py-1 rounded-full font-bold">Emergency</span>
                              )}
                              {isCompleted && (
                                <span className="bg-slate-200 text-slate-700 text-[10px] px-2.5 py-1 rounded-full font-bold">Completed</span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500">Phone: {appt.phone || "Not provided"}</p>
                            
                            <div className="flex gap-2 mt-3">
                              <span className="bg-[#F0F2F9] text-[#322B7B] text-xs font-semibold px-2.5 py-1 rounded-md">
                                {appt.dayLabel} at {appt.slot}
                              </span>
                              <span className="bg-[#F0F2F9] text-[#322B7B] text-xs font-semibold px-2.5 py-1 rounded-md">
                                Token #{appt.token}
                              </span>
                            </div>

                            {appt.reason && (
                              <div className="mt-3 text-sm text-slate-600">
                                <span className="font-semibold text-slate-800">Reason:</span> {appt.reason}
                              </div>
                            )}
                          </div>

                          {/* Right Side: Payment & Actions */}
                          <div className="flex flex-col items-end gap-3">
                            {/* Payment Status */}
                            <span className={`text-[11px] px-3 py-1 rounded-full font-bold border flex items-center gap-1 ${
                              appt.paymentStatus === "Paid" 
                                ? 'bg-[#EBF8EE] text-[#2E7D32] border-[#C8E6C9]' 
                                : 'bg-[#FFF3E0] text-[#E65100] border-[#FFE0B2]'
                            }`}>
                              {appt.paymentStatus === "Paid" ? "💳 Paid" : "💵 To be paid"}
                            </span>

                            {/* Action Buttons */}
                            <div className="flex gap-2 mt-2">
                              {isPending && !appt.rescheduleRequested && (
                                <>
                                  <button onClick={() => updateStatus(appt.id, "Upcoming")} className="bg-[#322B7B] text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-opacity-90 shadow-sm">Accept</button>
                                  <button onClick={() => updateStatus(appt.id, "Cancelled")} className="bg-white border border-slate-300 text-slate-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50">Decline</button>
                                </>
                              )}
                              {appt.status === "Upcoming" && (
                                <>
                                  <button onClick={() => updateStatus(appt.id, "Completed")} className="bg-[#EBF8EE] border border-[#C8E6C9] text-[#2E7D32] px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-[#d1f0d5]">Complete</button>
                                  <button onClick={() => requestReschedule(appt)} className="bg-rose-50 border border-rose-200 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-100">Reschedule</button>
                                </>
                              )}
                            </div>
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
            <div className="animate-fade-in">
              <div className="flex bg-slate-200/50 p-1 rounded-xl w-max mb-6">
                <button onClick={() => setEarningsView('daily')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${earningsView === 'daily' ? 'bg-white text-[#322B7B] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Daily</button>
                <button onClick={() => setEarningsView('monthly')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${earningsView === 'monthly' ? 'bg-white text-[#322B7B] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Monthly</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-[#322B7B] text-white p-8 rounded-3xl shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10 text-8xl font-serif">₹</div>
                  <p className="text-indigo-200 font-medium mb-1">Total Earnings ({earningsView})</p>
                  <h3 className="text-5xl font-black tracking-tight">₹{totalEarnings}</h3>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 relative">
                  <div className="absolute top-0 right-0 p-6 opacity-5 text-8xl">👥</div>
                  <p className="text-slate-500 font-medium mb-1">Patients Seen ({earningsView})</p>
                  <h3 className="text-5xl font-black tracking-tight text-slate-800">{patientCount}</h3>
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Transactions</h3>
              {earningsList.length === 0 ? (
                <div className="bg-white p-10 text-center rounded-3xl shadow-sm border border-slate-200">
                  <p className="text-slate-400 font-medium">No earnings recorded for this period yet.</p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  {earningsList.map((appt, index) => (
                    <div key={appt.id} className={`p-5 flex justify-between items-center ${index !== earningsList.length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <div>
                        <p className="font-bold text-slate-800">{appt.patient}</p>
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

      {/* SCHEDULE MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full my-8">
            <h3 className="text-2xl font-serif text-slate-800 mb-4">Manage Availability</h3>
            
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
                        ? "bg-[#322B7B] text-white border-[#322B7B] shadow-sm" 
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
                <input type="time" value={schedule.startTime} onChange={(e) => setSchedule({...schedule, startTime: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#322B7B]" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">End Time</label>
                <input type="time" value={schedule.endTime} onChange={(e) => setSchedule({...schedule, endTime: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#322B7B]" />
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-700 mb-2">Slot Duration</label>
              <select value={schedule.slotDuration} onChange={(e) => setSchedule({...schedule, slotDuration: Number(e.target.value)})} className="w-full border border-slate-300 p-2.5 rounded-xl bg-white outline-none focus:border-[#322B7B]">
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>

            <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block text-sm font-bold text-slate-700 mb-2">Block a Date (Mark as Full)</label>
              <div className="flex gap-2 mb-3">
                <input type="date" value={dateToBlock} onChange={(e) => setDateToBlock(e.target.value)} className="flex-1 border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#322B7B] text-sm" />
                <button onClick={() => {
                    if (dateToBlock && !schedule.blockedDates.includes(dateToBlock)) {
                      setSchedule({ ...schedule, blockedDates: [...schedule.blockedDates, dateToBlock] });
                      setDateToBlock("");
                    }
                  }} className="bg-[#322B7B] text-white px-4 rounded-xl font-bold hover:bg-opacity-90 text-sm">Block</button>
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
              <button onClick={saveSchedule} className="flex-1 bg-[#322B7B] text-white py-3 rounded-xl font-bold hover:bg-opacity-90 shadow-sm transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}