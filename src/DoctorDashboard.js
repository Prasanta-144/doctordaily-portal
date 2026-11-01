import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export default function DoctorDashboard({ doctorId, onLogout }) {
  const [appointments, setAppointments] = useState([]);
  const [doctorName, setDoctorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      setError(null);
      
      // Debug log to see exactly what ID is being passed
      console.log("Attempting to fetch Doctor ID:", doctorId); 

      try {
        // 1. Fetch Doctor Details
        const doctorRef = doc(db, "doctors", doctorId);
        const doctorSnap = await getDoc(doctorRef);
        
        if (doctorSnap.exists()) {
          console.log("Doctor found:", doctorSnap.data().name);
          setDoctorName(doctorSnap.data().name);
        } else {
          console.error("Firestore says this document does NOT exist.");
          setError("Doctor ID not found. Please check the ID and try again.");
          setLoading(false);
          return;
        }

        // 2. Fetch Appointments directly using the ID
        const appointmentsRef = collection(db, "appointments");
        const apptQuery = query(appointmentsRef, where("doctorId", "==", doctorId));
        const apptSnapshot = await getDocs(apptQuery);
        
        console.log("Total appointments found:", apptSnapshot.size);

        const appts = apptSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).filter(a => a.status === "Upcoming");

        setAppointments(appts);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to connect to database. Check console for details.");
      }
      setLoading(false);
    };

    fetchAppointments();
  }, [doctorId, onLogout]);

  const markCompleted = async (appointmentId) => {
    if (!window.confirm("Mark this appointment as completed?")) return;
    try {
      await updateDoc(doc(db, "appointments", appointmentId), { status: "Past" });
      setAppointments(prev => prev.filter(a => a.id !== appointmentId));
    } catch (error) {
      alert("Error updating: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-brand">Doctor Dashboard</h1>
            <p className="text-gray-500">Welcome back, {doctorName || "Loading..."}</p>
            <p className="text-xs text-gray-400 mt-1">ID: {doctorId}</p>
          </div>
          <button onClick={onLogout} className="text-sm font-bold text-red-600 hover:underline">
            Sign Out
          </button>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-4">Your Upcoming Queue</h2>
        
        {loading ? (
          <p>Loading appointments...</p>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">
            <p>{error}</p>
            <button onClick={onLogout} className="mt-2 bg-red-600 text-white px-4 py-2 rounded font-bold">Go Back</button>
          </div>
        ) : appointments.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-xl shadow-sm border border-gray-100">
            <p className="text-gray-500">No upcoming appointments right now.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {appointments.map((appt) => (
              <div key={appt.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{appt.patient}</h3>
                  <p className="text-sm text-gray-500">Phone: {appt.phone}</p>
                  <p className="text-sm text-brand font-medium mt-1">
                    {appt.dayLabel} at {appt.slot} | Token #{appt.token}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => markCompleted(appt.id)}
                    className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold hover:bg-green-200 transition"
                  >
                    Complete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}