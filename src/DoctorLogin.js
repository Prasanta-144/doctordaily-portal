import React, { useState } from 'react';

export default function DoctorLogin({ onLogin }) {
  const [phone, setPhone] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (phone.length === 10) {
      onLogin(phone);
    } else {
      alert("Enter a valid 10-digit phone number");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Doctor Login</h2>
        <p className="text-sm text-gray-500 mb-6">Enter the phone number you registered with.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="tel" 
            placeholder="10-digit mobile number" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none text-center text-lg tracking-widest" 
          />
          <button type="submit" className="w-full bg-brand text-white p-3 rounded-lg font-bold hover:opacity-90 transition">
            Access Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}