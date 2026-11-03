import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export default function DoctorDashboard({ doctorPhone, onLogout }) {
  const [appointments, setAppointments] = useState([]);
  const [doctorName, setDoctorName] = useState('');
  const [doctorId, setDoctorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // --- Schedule State ---
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [dateToBlock, setDateToBlock] = useState("");
  const [schedule, setSchedule] = useState({
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    startTime: "10:00",
    endTime: "17:00",
    slotDuration: 30,
    blockedDates: [] // <-- NEW
  });

  useEffect(() => {
    const fetchAppointments = async () => {
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
        setDoctorId(doctorDoc.id);
        setDoctorName(doctorDoc.data().name);
        
        if (doctorDoc.data().schedule) {
          setSchedule({
            ...doctorDoc.data().schedule,
            blockedDates: doctorDoc.data().schedule.blockedDates || [] // Fallback for older docs
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

    fetchAppointments();
  }, [doctorPhone, onLogout]);

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
      alert("Schedule and Blocked Dates updated successfully!");
      setShowScheduleModal(false);
    } catch (error) {
      alert("Error saving schedule: " + error.message);
    }
  };

  const hasCompleted = appointments.some(a => a.status === "Completed");

  return (
    <div className="min-h-screen bg-[#FAFAFC] p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex justify-between items-center mb-10">
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

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-serif text-slate-800">Your Queue</h2>
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

              if (isOnlinePaid) {
                badgeText = "💳 Paid";
                badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
              } else if (isPayAtClinic) {
                badgeText = "💵 To be paid at clinic";
                badgeStyle = "bg-orange-50 text-orange-700 border-orange-200";
              }

              return (
                <div key={appt.id} className={`p-6 rounded-3xl shadow-sm border flex justify-between items-center transition ${
                  isPending ? 'bg-amber-50/50 border-amber-100' : 
                  isCompleted ? 'bg-slate-50 border-slate-100 opacity-75' : 
                  'bg-white border-slate-100'
                }`}>
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
                        <p className="text-sm text-slate-600">
                          <span className="font-semibold text-slate-800">Reason:</span> {appt.reason}
                        </p>
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
      </div>

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

            {/* --- NEW: BLOCK DATES UI --- */}
            <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block text-sm font-bold text-slate-700 mb-2">Block a Date (Mark as Full)</label>
              <div className="flex gap-2 mb-3">
                <input 
                  type="date" 
                  value={dateToBlock} 
                  onChange={(e) => setDateToBlock(e.target.value)} 
                  className="flex-1 border border-slate-300 p-2.5 rounded-xl outline-none focus:border-brand text-sm" 
                />
                <button 
                  onClick={() => {
                    if (dateToBlock && !schedule.blockedDates.includes(dateToBlock)) {
                      setSchedule({ ...schedule, blockedDates: [...schedule.blockedDates, dateToBlock] });
                      setDateToBlock("");
                    }
                  }}
                  className="bg-slate-800 text-white px-4 rounded-xl font-bold hover:bg-slate-900 text-sm"
                >
                  Block
                </button>
              </div>
              
              {schedule.blockedDates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {schedule.blockedDates.map(date => (
                    <span key={date} className="bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-2">
                      {date}
                      <button 
                        onClick={() => setSchedule({ ...schedule, blockedDates: schedule.blockedDates.filter(d => d !== date) })}
                        className="hover:text-rose-900"
                      >
                        ✕
                      </button>
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