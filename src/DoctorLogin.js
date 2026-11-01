import React, { useState } from 'react';

export default function DoctorLogin({ onLogin }) {
  const [doctorId, setDoctorId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (doctorId.trim().length > 5) {
      onLogin(doctorId.trim());
    } else {
      alert("Please enter a valid Doctor ID");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Doctor Login</h2>
        <p className="text-sm text-gray-500 mb-6">Enter your unique Doctor ID to access your dashboard.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="text" 
            placeholder="e.g. 7g0wvlh3lpxymqnw6wcp" 
            value={doctorId} 
            onChange={(e) => setDoctorId(e.target.value)} 
            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none text-center" 
          />
          <button type="submit" className="w-full bg-brand text-white p-3 rounded-lg font-bold hover:opacity-90 transition">
            Access Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}