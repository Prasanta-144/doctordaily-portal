import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export default function DoctorDashboard({ doctorPhone, onLogout }) {
  const [appointments, setAppointments] = useState([]);
  const [doctorName, setDoctorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        const doctorId = doctorDoc.id;
        setDoctorName(doctorDoc.data().name);

        const appointmentsRef = collection(db, "appointments");
        const apptQuery = query(appointmentsRef, where("doctorId", "==", doctorId));
        const apptSnapshot = await getDocs(apptQuery);

        // Fetch Pending, Upcoming, and Completed
        const appts = apptSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).filter(a => ["Pending", "Upcoming", "Completed"].includes(a.status));

        // Sort so Pending is always at the top
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

  const clearCompleted = () => {
    setAppointments(prev => prev.filter(a => a.status !== "Completed"));
  };

  const hasCompleted = appointments.some(a => a.status === "Completed");

  return (
    <div className="min-h-screen bg-[#FAFAFC] p-6"> {/* Soft background matching the app */}
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-brand tracking-tight">Doctor Dashboard</h1>
            <p className="text-slate-600 mt-1">Welcome back, {doctorName || "Loading..."}</p>
            <p className="text-xs text-slate-400 mt-1">Logged in as: {doctorPhone}</p>
          </div>
          <button onClick={onLogout} className="text-sm font-bold text-red-600 hover:text-red-700 transition">
            Sign Out
          </button>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-800">Your Queue</h2>
          {hasCompleted && (
            <button onClick={clearCompleted} className="text-sm font-bold text-slate-500 hover:text-brand transition">
              Clear Completed List
            </button>
          )}
        </div>
        
        {loading ? (
          <p className="text-slate-500">Loading appointments...</p>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">
            <p>{error}</p>
            <button onClick={onLogout} className="mt-2 bg-red-600 text-white px-4 py-2 rounded font-bold">Go Back</button>
          </div>
        ) : appointments.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-2xl shadow-sm border border-slate-200">
            <p className="text-slate-500">No appointments in the queue right now.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {appointments.map((appt) => {
              const isPending = appt.status === "Pending";
              const isCompleted = appt.status === "Completed";
              const isPaid = appt.paymentStatus === "Paid";
              
              return (
                <div key={appt.id} className={`p-6 rounded-2xl shadow-sm border flex justify-between items-center transition ${
                  isPending ? 'bg-amber-50 border-amber-200' : 
                  isCompleted ? 'bg-slate-50 border-slate-200 opacity-80' : 
                  'bg-white border-slate-200'
                }`}>
                  <div className="pr-4">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-slate-800">{appt.patient}</h3>
                      
                      {/* Status Badges */}
                      {isPending && <span className="bg-amber-200 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold">Pending Approval</span>}
                      {isCompleted && <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold">Completed</span>}
                    </div>
                    
                    <p className="text-sm text-slate-500">Phone: {appt.phone || "Not provided"}</p>
                    <p className="text-sm text-brand font-semibold mt-2">
                      {appt.dayLabel} at {appt.slot} <span className="text-slate-300 mx-1">|</span> Token #{appt.token}
                    </p>
                    
                    {appt.reason && (
                      <div className="mt-3 bg-white/60 border border-slate-200 p-3 rounded-xl">
                        <p className="text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Reason:</span> {appt.reason}
                        </p>
                      </div>
                    )}

                    {/* --- UPDATED: Payment Badge --- */}
                    <div className="mt-3 flex items-center gap-2">
                      <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                        isPaid 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-orange-50 text-orange-700 border-orange-200'
                      }`}>
                        {isPaid ? '💳 Payment Received' : '⏳ Payment Pending'}
                      </span>
                    </div>
                    
                  </div>
                  
                  <div className="flex-shrink-0 flex gap-2">
                    {/* PENDING ACTIONS */}
                    {isPending && (
                      <>
                        <button onClick={() => updateStatus(appt.id, "Upcoming")} className="bg-brand text-white px-5 py-2.5 rounded-xl font-bold hover:bg-opacity-90 transition shadow-sm">
                          Accept
                        </button>
                        <button onClick={() => updateStatus(appt.id, "Cancelled")} className="bg-white border border-red-200 text-red-600 px-4 py-2.5 rounded-xl font-bold hover:bg-red-50 transition">
                          Decline
                        </button>
                      </>
                    )}

                    {/* UPCOMING ACTIONS */}
                    {appt.status === "Upcoming" && (
                      <button onClick={() => updateStatus(appt.id, "Completed")} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-100 transition">
                        Complete
                      </button>
                    )}

                    {/* COMPLETED ACTIONS */}
                    {isCompleted && (
                      <button disabled className="bg-slate-100 text-slate-400 border border-slate-200 px-5 py-2.5 rounded-xl font-bold cursor-not-allowed">
                        Done
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}