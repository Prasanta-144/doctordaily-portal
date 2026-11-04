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
        
        // --- CALCULATE SUBSCRIPTION STATUS ---
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
            isDue: daysLeft <= 7 // Due if 7 days or less left
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
          // Payment Success! Update Firestore.
          const newTrialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days
          
          await updateDoc(doc(db, "doctors", doctorId), {
            subscriptionStatus: "active",
            trialEndsAt: newTrialEnd, // Reset timer for next month
            lastPaymentId: response.razorpay_payment_id
          });

          setSubscription({
            status: 'active',
            trialEndsAt: newTrialEnd,
            daysLeft: 30,
            isDue: false
          });

          alert("Payment successful! Your account is active for another 30 days.");
        },
        prefill: {
          name: doctorName,
          contact: doctorPhone,
        },
        theme: {
          color: "#5E5AA8", // Your brand color
        },
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
    } catch (error) {
      alert("Error updating: " + error.message);
    }
  };

  const requestReschedule = async (appt) => {
    if (!window.confirm(`Request ${appt.patient} to choose a new date or get a refund?`)) return;
    try {
      await updateDoc(doc(db, "appointments", appt.id), { 
        status: "Pending",
        rescheduleRequested: true 
      });
      setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: "Pending", rescheduleRequested: true } : a));
    } catch (error) {
      alert("Error updating: " + error.message);
    }
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
    } catch (error) {
      alert("Error saving schedule: " + error.message);
    }
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
  const hasCompleted = appointments.some(a => a.status === "Completed");

  return (
    <div className="min-h-screen bg-[#FAFAFC] p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* SUBSCRIPTION BANNER */}
        {subscription.isDue && (
          <div className={`mb-6 p-4 rounded-2xl border flex justify-between items-center ${
            subscription.daysLeft <= 0 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
          }`}>
            <div>
              <h3 className={`font-bold ${subscription.daysLeft <= 0 ? 'text-rose-800' : 'text-amber-800'}`}>
                {subscription.daysLeft <= 0 ? "⚠️ Subscription Overdue" : "⏳ Payment Due Soon"}
              </h3>
              <p className={`text-sm ${subscription.daysLeft <= 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                {subscription.daysLeft <= 0 
                  ? "Your free trial has ended. Please pay to avoid suspension of services."
                  : `Your monthly payment is due in ${subscription.daysLeft} days. Pay within ${subscription.daysLeft} days to avoid suspension.`}
              </p>
            </div>
            <button 
              onClick={handleSubscriptionPayment}
              className="bg-brand text-white px-6 py-2.5 rounded-xl font-bold hover:bg-opacity-90 shadow-sm whitespace-nowrap"
            >
              Pay ₹2000
            </button>
          </div>
        )}

        {/* HEADER SECTION */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-serif text-brand tracking-tight">Doctor Dashboard</h1>
            <p className="text-slate-600 mt-2 font-medium">Welcome back, {doctorName || "Loading..."}</p>
            <p className="text-sm text-slate-400 mt-1">Logged in as: {doctorPhone}</p>
          </div>
          
          <div className="flex items-center gap-6">
            <button onClick={() => setShowScheduleModal(true)} className="text-sm font-bold bg-white border border-brand text-brand px-4 py-2 rounded-xl hover:bg-brand hover:text-white transition shadow-sm">
              Manage Schedule
            </button>
            <a href="/" className="text-sm font-semibold text-slate-500 hover:text-brand transition">Homepage</a>
            <button onClick={onLogout} className="text-sm font-semibold text-rose-500 hover:text-rose-600 transition border-l border-slate-200 pl-6">Sign Out</button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-4 mb-6 border-b border-slate-200 pb-2">
          <button 
            onClick={() => setActiveTab('queue')} 
            className={`text-lg font-bold pb-2 px-2 transition ${activeTab === 'queue' ? 'text-brand border-b-2 border-brand' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Appointment Queue
          </button>
          <button 
            onClick={() => setActiveTab('earnings')} 
            className={`text-lg font-bold pb-2 px-2 transition ${activeTab === 'earnings' ? 'text-brand border-b-2 border-brand' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Earnings
          </button>
        </div>

        {/* --- QUEUE TAB --- */}
        {activeTab === 'queue' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800">Your Queue</h2>
              {hasCompleted && (
                <button onClick={clearCompleted} className="text-sm font-semibold text-slate-500 hover:text-brand transition bg-slate-100 px-4 py-2 rounded-full">
                  Clear Completed
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
              <div className="bg-white p-10 text-center rounded-3xl shadow-sm border border-slate-100">
                <p className="text-slate-400 font-medium">No appointments in the queue right now.</p>
              </div>
            ) : (
              <div className="grid gap-5">
                {appointments.map((appt) => {
                  const isPending = appt.status === "Pending";
                  const isCompleted = appt.status === "Completed";
                  const isOnlinePaid = appt.paymentMethod === "Online" && appt.paymentStatus === "Paid";
                  const isPayAtClinic = appt.paymentMethod === "Pay at Clinic";
                  
                  let badgeText = "⏳ Payment Pending";
                  let badgeStyle = "bg-slate-100 text-slate-600 border-slate-200";
                  if (isOnlinePaid) { badgeText = "💳 Paid"; badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200"; } 
                  else if (isPayAtClinic) { badgeText = "💵 To be paid at clinic"; badgeStyle = "bg-orange-50 text-orange-700 border-orange-200"; }

                  return (
                    <div key={appt.id} className={`p-6 rounded-3xl shadow-sm border flex justify-between items-center transition ${isPending ? 'bg-amber-50/50 border-amber-100' : isCompleted ? 'bg-slate-50 border-slate-100 opacity-75' : 'bg-white border-slate-100'}`}>
                      <div className="pr-4">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-slate-800">{appt.patient}</h3>
                          {isPending && !appt.rescheduleRequested && <span className="bg-amber-100 text-amber-700 border border-amber-200 text-xs px-3 py-1 rounded-full font-bold">Pending Approval</span>}
                          {appt.rescheduleRequested && <span className="bg-rose-100 text-rose-700 border border-rose-200 text-xs px-3 py-1 rounded-full font-bold">⚠️ Awaiting Patient Action</span>}
                          {isCompleted && <span className="bg-slate-200 text-slate-700 text-xs px-3 py-1 rounded-full font-bold">Completed</span>}
                        </div>
                        <p className="text-sm text-slate-500 font-medium">Phone: {appt.phone || "Not provided"}</p>
                        <p className="text-sm text-brand font-semibold mt-2 bg-brand/5 inline-block px-3 py-1 rounded-lg">
                          {appt.dayLabel} at {appt.slot} <span className="text-slate-300 mx-1">|</span> Token #{appt.token}
                        </p>
                        {appt.reason && (
                          <div className="mt-3 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                            <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Reason:</span> {appt.reason}</p>
                          </div>
                        )}
                        <div className="mt-4 flex items-center gap-2">
                          <span className={`text-xs px-3 py-1.5 rounded-full font-bold border ${badgeStyle}`}>{badgeText}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex flex-col gap-2">
                        {isPending && !appt.rescheduleRequested && (
                          <>
                            <button onClick={() => updateStatus(appt.id, "Upcoming")} className="bg-brand text-white px-6 py-2.5 rounded-xl font-bold hover:bg-opacity-90 transition shadow-sm w-full">Accept</button>
                            <button onClick={() => updateStatus(appt.id, "Cancelled")} className="bg-white border border-rose-200 text-rose-600 px-6 py-2.5 rounded-xl font-bold hover:bg-rose-50 transition w-full">Decline</button>
                          </>
                        )}
                        {appt.status === "Upcoming" && (
                          <>
                            <button onClick={() => updateStatus(appt.id, "Completed")} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-900 transition shadow-sm w-full">Complete Visit</button>
                            <button onClick={() => requestReschedule(appt)} className="bg-white border border-rose-200 text-rose-600 px-4 py-2.5 rounded-xl font-bold hover:bg-rose-50 transition w-full text-sm">Emergency Reschedule</button>
                          </>
                        )}
                        {isCompleted && (
                          <button disabled className="bg-slate-100 text-slate-400 px-6 py-2.5 rounded-xl font-bold cursor-not-allowed w-full">Done</button>
                        )}
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
            <div className="flex bg-slate-200/50 p-1 rounded-2xl w-max mb-6">
              <button 
                onClick={() => setEarningsView('daily')} 
                className={`px-6 py-2 rounded-xl text-sm font-bold transition ${earningsView === 'daily' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Daily
              </button>
              <button 
                onClick={() => setEarningsView('monthly')} 
                className={`px-6 py-2 rounded-xl text-sm font-bold transition ${earningsView === 'monthly' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Monthly
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-brand text-white p-8 rounded-3xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10 text-8xl">₹</div>
                <p className="text-brand-100 font-medium mb-1">Total Earnings ({earningsView})</p>
                <h3 className="text-5xl font-black tracking-tight">₹{totalEarnings}</h3>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative">
                <div className="absolute top-0 right-0 p-6 opacity-5 text-8xl">👥</div>
                <p className="text-slate-500 font-medium mb-1">Patients Seen ({earningsView})</p>
                <h3 className="text-5xl font-black tracking-tight text-slate-800">{patientCount}</h3>
              </div>
            </div>

            <h3 className="text-xl font-bold text-slate-800 mb-4">Recent Transactions</h3>
            {earningsList.length === 0 ? (
              <div className="bg-white p-10 text-center rounded-3xl shadow-sm border border-slate-100">
                <p className="text-slate-400 font-medium">No earnings recorded for this period yet.</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
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

      {/* SCHEDULE MODAL (RESTORED) */}
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
                        ? "bg-brand text-white border-brand shadow-sm" 
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
                <input type="time" value={schedule.startTime} onChange={(e) => setSchedule({...schedule, startTime: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-brand" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">End Time</label>
                <input type="time" value={schedule.endTime} onChange={(e) => setSchedule({...schedule, endTime: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-brand" />
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-700 mb-2">Slot Duration</label>
              <select value={schedule.slotDuration} onChange={(e) => setSchedule({...schedule, slotDuration: Number(e.target.value)})} className="w-full border border-slate-300 p-2.5 rounded-xl bg-white outline-none focus:border-brand">
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>

            <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block text-sm font-bold text-slate-700 mb-2">Block a Date (Mark as Full)</label>
              <div className="flex gap-2 mb-3">
                <input type="date" value={dateToBlock} onChange={(e) => setDateToBlock(e.target.value)} className="flex-1 border border-slate-300 p-2.5 rounded-xl outline-none focus:border-brand text-sm" />
                <button onClick={() => {
                    if (dateToBlock && !schedule.blockedDates.includes(dateToBlock)) {
                      setSchedule({ ...schedule, blockedDates: [...schedule.blockedDates, dateToBlock] });
                      setDateToBlock("");
                    }
                  }} className="bg-slate-800 text-white px-4 rounded-xl font-bold hover:bg-slate-900 text-sm">Block</button>
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
              <button onClick={saveSchedule} className="flex-1 bg-brand text-white py-3 rounded-xl font-bold hover:bg-opacity-90 shadow-sm transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}