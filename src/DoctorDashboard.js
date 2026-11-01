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
        // 1. Format the phone number to match how Firebase Auth saves it
        const phoneE164 = doctorPhone.startsWith("+91") ? doctorPhone : `+91${doctorPhone}`;
        
        // 2. Find the doctor using their phone number
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

        // 3. Fetch Appointments using the Doctor's ID
        const appointmentsRef = collection(db, "appointments");
        const apptQuery = query(appointmentsRef, where("doctorId", "==", doctorId));
        const apptSnapshot = await getDocs(apptQuery);

        const appts = apptSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).filter(a => a.status === "Upcoming");

        setAppointments(appts);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to connect to database.");
      }
      setLoading(false);
    };

    fetchAppointments();
  }, [doctorPhone, onLogout]);

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
            <p className="text-xs text-gray-400 mt-1">Logged in as: {doctorPhone}</p>
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
                <div className="pr-4">
                  <h3 className="text-lg font-bold text-gray-800">{appt.patient}</h3>
                  <p className="text-sm text-gray-500">Phone: {appt.phone}</p>
                  <p className="text-sm text-brand font-medium mt-1">
                    {appt.dayLabel} at {appt.slot} | Token #{appt.token}
                  </p>
                  
                  {/* --- NEW: Display Reason if it exists --- */}
                  {appt.reason && (
                    <div className="mt-3 bg-gray-50 border border-gray-200 p-3 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <span className="font-semibold text-gray-900">Reason for visit:</span> {appt.reason}
                      </p>
                    </div>
                  )}
                  
                </div>
                <div className="flex-shrink-0">
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