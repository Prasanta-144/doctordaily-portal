import React, { useState, useEffect } from 'react';
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export default function VerifyTicket({ appointmentId }) {
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAppointment = async () => {
      if (!appointmentId) {
        setError("Invalid QR Code. No Appointment ID found in the URL.");
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, "appointments", appointmentId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setAppointment({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError("Ticket Not Found. This ticket may be fake or deleted from the database.");
        }
      } catch (err) {
        console.error("Firebase Error:", err);
        setError("Database Connection Error. Please check internet or Firestore rules.");
      }
      setLoading(false);
    };

    fetchAppointment();
  }, [appointmentId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFC]">
        <div className="text-brand font-bold text-xl animate-pulse">Verifying Ticket...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFC] flex flex-col items-center justify-center p-6 font-sans">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-brand">DoctorDaily</h1>
        <p className="text-slate-500 font-medium mt-1">Ticket Verification</p>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100 text-center">
        {error ? (
          <div>
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-rose-600 mb-2">Verification Failed</h2>
            <p className="text-slate-600">{error}</p>
          </div>
        ) : (
          <div>
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-emerald-600 mb-6">Valid Ticket</h2>
            
            <div className="bg-slate-50 rounded-2xl p-6 text-left space-y-4 border border-slate-100">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Patient</p>
                <p className="text-lg font-bold text-slate-800">{appointment.patient || "Unknown"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Doctor ID</p>
                <p className="text-sm font-bold text-slate-800">{appointment.doctorId}</p>
              </div>
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Date</p>
                  <p className="text-md font-semibold text-slate-700">{appointment.dayLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Time</p>
                  <p className="text-md font-semibold text-slate-700">{appointment.slot}</p>
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Token</p>
                  <p className="text-2xl font-black text-brand">#{appointment.token}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  appointment.paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                }`}>
                  {appointment.paymentStatus === "Paid" ? "PAID" : "PAY AT CLINIC"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <p className="mt-8 text-sm text-slate-400 font-medium">Secured by DoctorDaily • Mina App Studios</p>
    </div>
  );
}