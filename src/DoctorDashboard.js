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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-brand">Doctor Dashboard</h1>
            <p className="text-gray-500">Welcome back, {doctorName || "Loading..."}</p>
            <p className="text-xs text-gray-400 mt-1">Logged in as: {doctorPhone}</p>
          </div>
          <button onClick={onLogout} className="text-sm font-bold text-red-600 hover:underline">
            Sign Out
          </button>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Your Queue</h2>
          {hasCompleted && (
            <button onClick={clearCompleted} className="text-sm font-bold text-gray-500 hover:text-gray-800">
              Clear Completed List
            </button>
          )}
        </div>
        
        {loading ? (
          <p>Loading appointments...</p>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">
            <p>{error}</p>
            <button onClick={onLogout} className="mt-2 bg-red-600 text-white px-4 py-2 rounded font-bold">Go Back</button>
          </div>
        ) : appointments.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-xl shadow-sm border border-gray-100">
            <p className="text-gray-500">No appointments in the queue right now.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {appointments.map((appt) => {
              const isPending = appt.status === "Pending";
              const isCompleted = appt.status === "Completed";
              
              return (
                <div key={appt.id} className={`p-6 rounded-xl shadow-sm border flex justify-between items-center transition ${
                  isPending ? 'bg-yellow-50 border-yellow-200' : 
                  isCompleted ? 'bg-gray-100 border-gray-200 opacity-75' : 
                  'bg-white border-gray-100'
                }`}>
                  <div className="pr-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-800">{appt.patient}</h3>
                      {isPending && <span className="bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded-full font-bold">Pending Approval</span>}
                      {isCompleted && <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">Completed</span>}
                    </div>
                    <p className="text-sm text-gray-500">Phone: {appt.phone}</p>
                    <p className="text-sm text-brand font-medium mt-1">
                      {appt.dayLabel} at {appt.slot} | Token #{appt.token}
                    </p>
                    {appt.reason && (
                      <div className="mt-3 bg-white/50 border border-gray-200 p-3 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold text-gray-900">Reason:</span> {appt.reason}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-shrink-0 flex gap-2">
                    {/* PENDING ACTIONS */}
                    {isPending && (
                      <>
                        <button onClick={() => updateStatus(appt.id, "Upcoming")} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition shadow-sm">
                          Accept
                        </button>
                        <button onClick={() => updateStatus(appt.id, "Cancelled")} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-bold hover:bg-red-200 transition">
                          Decline
                        </button>
                      </>
                    )}

                    {/* UPCOMING ACTIONS */}
                    {appt.status === "Upcoming" && (
                      <button onClick={() => updateStatus(appt.id, "Completed")} className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold hover:bg-green-200 transition">
                        Complete
                      </button>
                    )}

                    {/* COMPLETED ACTIONS */}
                    {isCompleted && (
                      <button disabled className="bg-gray-200 text-gray-400 px-4 py-2 rounded-lg font-bold cursor-not-allowed">
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