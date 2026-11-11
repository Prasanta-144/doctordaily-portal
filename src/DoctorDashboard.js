import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "./firebase";
import { getFunctions, httpsCallable } from "firebase/functions";

/* ---------- Small inline icons (stroke = currentColor) ---------- */
const Icon = ({ children, className = "w-[18px] h-[18px]" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {children}
  </svg>
);
const DashboardIcon = () => (
  <Icon><path d="M12 4a9 9 0 0 0-9 9v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a9 9 0 0 0-9-9z" /><path d="M12 13l3-3" /><circle cx="12" cy="13" r="1" /></Icon>
);
const CalendarIcon = () => (
  <Icon><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></Icon>
);
const HomeIcon = () => (
  <Icon><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></Icon>
);
const SignOutIcon = () => (
  <Icon><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></Icon>
);
const TrashIcon = () => (
  <Icon className="w-3.5 h-3.5"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></Icon>
);
const CardIcon = () => (
  <Icon className="w-3.5 h-3.5"><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20M6 15h4" /></Icon>
);
const HourglassIcon = () => (
  <Icon className="w-6 h-6"><path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" /></Icon>
);
const VerifiedIcon = () => (
  <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
);

const WarnIcon = ({ className = "w-3 h-3" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z" /></svg>
);

const CalendarPlusWatermark = () => (
  <svg viewBox="0 0 160 160" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-44 h-44">
    <rect x="18" y="28" width="104" height="96" rx="14" />
    <path d="M18 56h104M46 16v20M94 16v20" />
    <g strokeWidth="2.5">
      <path d="M34 72h6M52 72h6M70 72h6M34 88h6M52 88h6M34 104h6M52 104h6" />
    </g>
    <rect x="76" y="84" width="62" height="62" rx="12" fill="#3F3590" />
    <path d="M107 100v30M92 115h30" strokeWidth="5" />
  </svg>
);

export default function DoctorDashboard({ doctorPhone, onLogout }) {
  const [appointments, setAppointments] = useState([]);
  const [doctorName, setDoctorName] = useState('');
  const [doctorFee, setDoctorFee] = useState(0);
  const [doctorId, setDoctorId] = useState(null);
  const [doctorStream, setDoctorStream] = useState('MBBS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- VERIFICATION STATE ---
  const [verificationStatus, setVerificationStatus] = useState('pending');
  const [registrationId, setRegistrationId] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  // --- LEAVE NOTICE STATE ---
  const [leaveMessage, setLeaveMessage] = useState('');
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');

  // --- REAL-TIME CANCELLATION ALERT STATE ---
  const [cancellationAlert, setCancellationAlert] = useState(null);
  const prevAppointmentsRef = useRef([]);

  // Navigation & View States
  const [activeTab, setActiveTab] = useState('queue');
  const [earningsView, setEarningsView] = useState('daily');
  
  // Date Navigation State
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // --- PRESCRIPTION UPLOAD STATES ---
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // --- PATIENT HISTORY STATES ---
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [selectedPatientHistory, setSelectedPatientHistory] = useState([]);
  const [selectedPatientData, setSelectedPatientData] = useState(null);

  // Generate days for the selected month
  const getDaysInMonth = (year, month) => {
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      const fullDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      days.push({
        fullDate,
        dayNum: date.getDate(),
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' })
      });
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const daysInViewMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
  const monthYearLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handlePrevMonth = () => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    setViewDate(newDate);
    setSelectedDate(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-01`);
  };

  const handleNextMonth = () => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    setViewDate(newDate);
    setSelectedDate(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-01`);
  };

  // --- SUBSCRIPTION STATE ---
  const [subscription, setSubscription] = useState({
    status: 'trial',
    trialEndsAt: null,
    daysLeft: 0,
    isDue: false
  });

  // --- EDIT PROFILE STATE ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', clinicName: '', clinicAddress: '', mapLocation: '', consultationFee: 0
  });
  const [editPhoto, setEditPhoto] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // Schedule State (REMOVED dateToBlock / setDateToBlock)
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedule, setSchedule] = useState({
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    startTime: "10:00",
    endTime: "17:00",
    slotDuration: 30,
    maxDailyPatients: 20,
    blockedDates: []
  });

  useEffect(() => {
    let unsubscribeAppts = null;

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
        setDoctorStream(doctorData.medicalStream || 'MBBS');
        
        setVerificationStatus(doctorData.verificationStatus || 'pending');
        setRegistrationId(doctorData.registrationId || '');
        
        // --- Load Leave Data ---
        setLeaveMessage(doctorData.leaveMessage || '');
        setLeaveStartDate(doctorData.leaveStartDate || '');
        setLeaveEndDate(doctorData.leaveEndDate || '');
        
        setEditForm({
          name: doctorData.name || '',
          clinicName: doctorData.clinicName || '',
          clinicAddress: doctorData.clinicAddress || '',
          mapLocation: doctorData.mapLocation || '',
          consultationFee: doctorData.consultationFee || 500
        });
        setEditPhotoPreview(doctorData.photoUrl || null);

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
            maxDailyPatients: doctorData.schedule.maxDailyPatients || 20,
            blockedDates: doctorData.schedule.blockedDates || []
          });
        }

        const appointmentsRef = collection(db, "appointments");
        const apptQuery = query(appointmentsRef, where("doctorId", "==", doctorDoc.id));
        
        unsubscribeAppts = onSnapshot(apptQuery, (snapshot) => {
          const appts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })).filter(a => ["Pending", "Upcoming", "Completed", "Cancelled"].includes(a.status));

          appts.sort((a, b) => {
            if (a.status === "Pending" && b.status !== "Pending") return -1;
            if (a.status !== "Pending" && b.status === "Pending") return 1;
            return 0;
          });

          if (prevAppointmentsRef.current.length > 0) {
            appts.forEach(newAppt => {
              const oldAppt = prevAppointmentsRef.current.find(a => a.id === newAppt.id);
              if (oldAppt && oldAppt.status !== "Cancelled" && newAppt.status === "Cancelled") {
                setCancellationAlert(
                  `Patient ${newAppt.patient} has cancelled their appointment scheduled on ${newAppt.dayLabel} at ${newAppt.slot}.`
                );
              }
            });
          }

          prevAppointmentsRef.current = appts;
          setAppointments(appts);
          setLoading(false);
        });

      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to connect to database.");
        setLoading(false);
      }
    };

    fetchDoctorData();

    return () => {
      if (unsubscribeAppts) unsubscribeAppts();
    };
  }, [doctorPhone, onLogout]);

  const isCurrentlyOnLeave = () => {
    if (!leaveStartDate || !leaveEndDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return today >= leaveStartDate && today <= leaveEndDate;
  };

  const getVerificationLabel = () => {
    switch(doctorStream) {
      case 'Dentist': return 'DCI / State Dental Council Registration Number';
      case 'Homeopathy': return 'CCH Registration Number';
      case 'Ayurveda': return 'NCISM Registration Number';
      case 'Veterinary': return 'VCI Registration Number';
      default: return 'NMC Registration Number';
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (!verifyInput.trim()) return alert("Please enter a valid registration number.");
    
    setVerifyLoading(true);
    try {
      await updateDoc(doc(db, "doctors", doctorId), {
        registrationId: verifyInput.trim(),
        verificationStatus: "pending_review"
      });
      setVerificationStatus("pending_review");
      setRegistrationId(verifyInput.trim());
      setShowVerifyModal(false);
      alert(`${getVerificationLabel()} submitted successfully! We will review it shortly.`);
    } catch (error) {
      alert("Error submitting verification: " + error.message);
    }
    setVerifyLoading(false);
  };

  const handleEditPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditPhoto(file);
      setEditPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      let photoUrl = editPhotoPreview;

      if (editPhoto) {
        const storage = getStorage();
        const storageRef = ref(storage, `doctor_photos/${doctorId}_profile.jpg`);
        await uploadBytes(storageRef, editPhoto);
        photoUrl = await getDownloadURL(storageRef);
      }

      await updateDoc(doc(db, "doctors", doctorId), {
        name: editForm.name,
        clinicName: editForm.clinicName,
        clinicAddress: editForm.clinicAddress,
        mapLocation: editForm.mapLocation,
        consultationFee: Number(editForm.consultationFee),
        photoUrl: photoUrl
      });

      setDoctorName(editForm.name);
      setDoctorFee(Number(editForm.consultationFee));
      setShowEditModal(false);
      alert("Profile updated successfully!");

    } catch (error) {
      alert("Error updating profile: " + error.message);
    }
    setEditLoading(false);
  };

  const handlePrescriptionUpload = async (e) => {
    e.preventDefault();
    if (!prescriptionFile || !selectedAppt) return alert("Please select a file first.");
    
    setUploadLoading(true);
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `prescriptions/${doctorId}/${selectedAppt.id}_${prescriptionFile.name}`);
      
      await uploadBytes(storageRef, prescriptionFile);
      const downloadURL = await getDownloadURL(storageRef);

      await updateDoc(doc(db, "appointments", selectedAppt.id), {
        prescriptionUrl: downloadURL,
        prescriptionUploadedAt: new Date(),
        prescriptionFileName: prescriptionFile.name
      });

      const updatedAppts = appointments.map(a => 
        a.id === selectedAppt.id ? { ...a, prescriptionUrl: downloadURL } : a
      );
      setAppointments(updatedAppts);
      prevAppointmentsRef.current = updatedAppts;

      if (showPatientModal) {
        setSelectedPatientHistory(prev => prev.map(a => 
          a.id === selectedAppt.id ? { ...a, prescriptionUrl: downloadURL } : a
        ));
      }

      alert("Prescription uploaded successfully!");
      setShowUploadModal(false);
      setPrescriptionFile(null);
      setSelectedAppt(null);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error uploading prescription: " + error.message);
    }
    setUploadLoading(false);
  };

  const handlePatientClick = (appt) => {
    const history = appointments.filter(a => 
      (a.patientId && a.patientId === appt.patientId) || 
      (!a.patientId && a.phone === appt.phone && a.patient === appt.patient)
    ).sort((a, b) => new Date(b.createdAt?.toDate() || 0) - new Date(a.createdAt?.toDate() || 0));
    
    setSelectedPatientData({ name: appt.patient, phone: appt.phone });
    setSelectedPatientHistory(history);
    setShowPatientModal(true);
  };

  const handleSubscriptionPayment = async () => {
    try {
      const functions = getFunctions();
      const createOrder = httpsCallable(functions, 'createSubscriptionOrder');
      const result = await createOrder();
      const { orderId, amount } = result.data;

      const options = {
        key: "rzp_test_Tvbffal0a4v3Hu",
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
    } catch (error) { alert("Error updating: " + error.message); }
  };

  const requestReschedule = async (appt) => {
    if (!window.confirm(`Request ${appt.patient} to choose a new date or get a refund?`)) return;
    try {
      await updateDoc(doc(db, "appointments", appt.id), { status: "Pending", rescheduleRequested: true });
    } catch (error) { alert("Error updating: " + error.message); }
  };

   const saveSchedule = async () => {
    if (!doctorId) return;
    
    // Helper to convert any date string to YYYY-MM-DD
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      // Already in YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
      // In DD-MM-YYYY
      if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      // In DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      // Fallback: parse with JS Date object
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      } catch (e) {}
      return dateStr;
    };

    const formattedStart = formatDate(leaveStartDate);
    const formattedEnd = formatDate(leaveEndDate);

    try {
      await updateDoc(doc(db, "doctors", doctorId), { 
        schedule: schedule,
        leaveMessage: leaveMessage,
        leaveStartDate: formattedStart,
        leaveEndDate: formattedEnd
      });
      
      // Update local state to match the formatted dates
      setLeaveStartDate(formattedStart);
      setLeaveEndDate(formattedEnd);
      
      alert("Schedule & Leave Notice updated successfully!");
      setShowScheduleModal(false);
    } catch (error) { alert("Error saving schedule: " + error.message); }
  };
  const clearHistory = async () => {
    const toClear = appointments.filter(a => 
      (a.status === "Completed" || a.status === "Cancelled") && !a.clearedByDoctor
    );
    if (toClear.length === 0) return;

    try {
      const promises = toClear.map(appt =>
        updateDoc(doc(db, "appointments", appt.id), { clearedByDoctor: true })
      );
      await Promise.all(promises);
    } catch (error) {
      alert("Error clearing history: " + error.message);
    }
  };

  const getAppointmentDateStr = (appt) => {
    if (appt.createdAt) {
      const date = appt.createdAt.toDate();
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    
    if (appt.dayLabel === "Today") {
      const today = new Date();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    
    const parts = appt.dayLabel.split(", ");
    if (parts.length === 2) {
      const datePart = parts[1].split(" "); 
      if (datePart.length === 2) {
        const day = parseInt(datePart[0]);
        const monthName = datePart[1];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = monthNames.indexOf(monthName);
        if (month !== -1 && !isNaN(day)) {
          const year = new Date().getFullYear(); 
          return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }
    
    return null; 
  };

  const calculateEarnings = () => {
    const validAppts = appointments.filter(a => a.paymentStatus === "Paid" || a.status === "Completed");
    let filteredAppts = [];
    
    if (earningsView === 'daily') {
      filteredAppts = validAppts.filter(a => getAppointmentDateStr(a) === selectedDate);
    } else {
      const currentMonth = viewDate.getMonth() + 1; 
      const currentYear = viewDate.getFullYear();
      filteredAppts = validAppts.filter(a => {
        const dateStr = getAppointmentDateStr(a);
        if (!dateStr) return false;
        const parts = dateStr.split("-"); 
        return parseInt(parts[1]) === currentMonth && parseInt(parts[0]) === currentYear;
      });
    }
    
    const total = filteredAppts.reduce((sum, a) => sum + (a.consultationFee || doctorFee), 0);
    return { total, count: filteredAppts.length, appointments: filteredAppts };
  };

  const { total: totalEarnings, count: patientCount, appointments: earningsList } = calculateEarnings();
  const displayedAppointments = appointments.filter(a => !a.clearedByDoctor);

  return (
    <div className="flex h-screen bg-[#F7F6FC] font-sans overflow-hidden">
      <aside className="w-64 bg-gradient-to-b from-[#4C41A6] to-[#3B3188] hidden md:flex flex-col justify-between shadow-xl z-20 relative overflow-hidden">
        <div className="relative z-10">
          <div className="px-5 pt-6 pb-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-sm">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-extrabold text-white tracking-tight">DoctorDaily</span>
          </div>

          <nav className="px-4 mt-2 space-y-1.5">
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-white/15 text-white rounded-xl text-sm font-bold transition">
              <DashboardIcon /> Dashboard
            </button>
            <button onClick={() => setShowEditModal(true)} className="w-full flex items-center gap-3 px-4 py-3 text-white/90 hover:bg-white/10 rounded-xl text-sm font-bold transition">
              <span className="text-lg">✏️</span> Edit Profile
            </button>
            <button onClick={() => setShowScheduleModal(true)} className="w-full flex items-center gap-3 px-4 py-3 text-white/90 hover:bg-white/10 rounded-xl text-sm font-bold transition">
              <CalendarIcon /> Manage Schedule
            </button>
            
            <button onClick={() => { window.location.hash = ''; }} className="w-full flex items-center gap-3 px-4 py-3 text-white/90 hover:bg-white/10 rounded-xl text-sm font-bold transition">
              <HomeIcon /> Homepage
            </button>

            <div className="border-t border-white/15 my-4 mx-1" />

            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-[#FF8FA8] hover:bg-white/10 rounded-xl text-sm font-bold transition">
              <SignOutIcon /> Sign Out
            </button>
          </nav>
        </div>

        <div className="relative z-0 flex justify-start pl-4 pb-4 opacity-[0.12] pointer-events-none translate-y-4">
          <CalendarPlusWatermark />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-white via-[#F8F7FD] to-[#EFEDFA] relative">
        
        {cancellationAlert && (
          <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-rose-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-down">
            <WarnIcon className="w-6 h-6" />
            <div>
              <p className="font-bold text-sm">Appointment Cancelled</p>
              <p className="text-xs text-rose-100">{cancellationAlert}</p>
            </div>
            <button onClick={() => setCancellationAlert(null)} className="ml-4 bg-white/20 hover:bg-white/30 p-1.5 rounded-lg transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        )}

        <div className="max-w-5xl mx-auto p-6 md:p-10">
          
          {isCurrentlyOnLeave() && (
            <div className="mb-6 bg-rose-50 border border-rose-200 px-5 py-4 rounded-2xl flex items-start gap-4 shadow-sm">
              <div className="w-10 h-10 flex items-center justify-center rounded-full shrink-0 bg-white text-rose-600 shadow-sm mt-1">
                <WarnIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-rose-800">You are currently on leave</h3>
                <p className="text-sm text-rose-600 mt-0.5">
                  Patients are seeing an "On Leave" notice on your profile. <br/>
                  <b>Message:</b> {leaveMessage || "Not available"} <br/>
                  <b>Dates:</b> {leaveStartDate} to {leaveEndDate}
                </p>
              </div>
            </div>
          )}

          {verificationStatus !== 'verified' && (
            <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 px-5 py-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center rounded-full shrink-0 bg-white text-blue-600 shadow-sm">
                  <VerifiedIcon />
                </div>
                <div>
                  <h3 className="font-bold text-blue-900">
                    {verificationStatus === 'pending_review' ? "Verification Under Review" : "Get Verified!"}
                  </h3>
                  <p className="text-sm text-blue-700 mt-0.5">
                    {verificationStatus === 'pending_review' 
                      ? `We are currently reviewing your ${getVerificationLabel()}. This usually takes 24-48 hours.`
                      : `Submit your ${getVerificationLabel()} to get the Blue Tick and build instant patient trust.`}
                  </p>
                </div>
              </div>
              
              {verificationStatus !== 'pending_review' && (
                <button 
                  onClick={() => { setVerifyInput(registrationId || ''); setShowVerifyModal(true); }} 
                  className="w-full md:w-auto bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-md transition whitespace-nowrap"
                >
                  Verify Now →
                </button>
              )}
            </div>
          )}

          {subscription.isDue && (
            <div className={`mb-8 px-5 py-4 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm ${
              subscription.daysLeft <= 0 ? 'bg-rose-50 border-rose-200' : 'bg-[#F1EFFB] border-[#DDD8F3]'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 flex items-center justify-center rounded-full shrink-0 bg-white shadow-sm ${
                  subscription.daysLeft <= 0 ? 'text-rose-600' : 'text-[#6B5FC7]'
                }`}>
                  {subscription.daysLeft <= 0 ? <span className="text-xl">⚠️</span> : <HourglassIcon />}
                </div>
                <div>
                  <h3 className={`font-bold ${subscription.daysLeft <= 0 ? 'text-rose-800' : 'text-[#2B2468]'}`}>
                    {subscription.daysLeft <= 0 ? "Subscription Overdue" : "Payment Due Soon"}
                  </h3>
                  <p className={`text-sm mt-0.5 ${subscription.daysLeft <= 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                    {subscription.daysLeft <= 0
                      ? "Your free trial has ended. Please pay to avoid suspension."
                      : `Your monthly subscription of ₹2000 is due in ${subscription.daysLeft} days. Pay now to avoid service interruption.`}
                  </p>
                </div>
              </div>
              <button onClick={handleSubscriptionPayment} className="w-full md:w-auto bg-[#4C41A6] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#3F3590] shadow-md transition whitespace-nowrap">
                Pay ₹2000 →
              </button>
            </div>
          )}

          <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-4xl font-extrabold text-[#322B7B] tracking-tight">Doctor Dashboard</h1>
                {verificationStatus === 'verified' && <VerifiedIcon />}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <p className="text-slate-800 text-sm font-bold">Welcome back, {doctorName || "Loading..."}</p>
                {verificationStatus === 'verified' && (
                  <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-blue-200">
                    VERIFIED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Logged in as: <span className="text-[#5E5AA8] font-semibold">{doctorPhone}</span>
              </p>
            </div>

            <div className="hidden md:flex items-center gap-4 mt-1">
              <button onClick={() => setShowEditModal(true)} className="text-sm font-bold text-slate-600 hover:text-[#4C41A6] transition">Edit Profile</button>
              <button onClick={() => setShowScheduleModal(true)} className="text-sm font-bold text-[#4C41A6] border border-[#4C41A6] px-5 py-2 rounded-full hover:bg-[#4C41A6]/5 transition">Manage Schedule</button>
              
              <button onClick={() => { window.location.hash = ''; }} className="text-sm font-bold text-slate-800 hover:text-[#4C41A6] transition">Homepage</button>
              
              <span className="w-px h-5 bg-slate-300" />
              <button onClick={onLogout} className="text-sm font-bold text-[#E5456B] hover:text-rose-700 transition">Sign Out</button>
            </div>

            <div className="flex md:hidden gap-3 w-full">
              <button onClick={() => setShowEditModal(true)} className="flex-1 text-sm font-bold bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl">Edit Profile</button>
              <button onClick={() => setShowScheduleModal(true)} className="flex-1 text-sm font-bold bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl">Schedule</button>
              <button onClick={onLogout} className="flex-1 text-sm font-bold bg-rose-50 text-rose-600 px-4 py-2 rounded-xl">Sign Out</button>
            </div>
          </div>

          <div className="flex gap-8 mb-6 border-b border-slate-200">
            <button onClick={() => setActiveTab('queue')} className={`text-sm font-bold pb-3 -mb-px transition border-b-2 ${activeTab === 'queue' ? 'text-[#4C41A6] border-[#4C41A6]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
              Appointment Queue
            </button>
            <button onClick={() => setActiveTab('earnings')} className={`text-sm font-bold pb-3 -mb-px transition border-b-2 ${activeTab === 'earnings' ? 'text-[#4C41A6] border-[#4C41A6]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
              Earnings
            </button>
          </div>

          {activeTab === 'queue' && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">Your Queue <span className="text-slate-400">·</span></h2>
                {displayedAppointments.some(a => a.status === "Completed" || a.status === "Cancelled") && (
                  <button onClick={clearHistory} className="flex items-center gap-2 text-xs font-bold text-[#4C41A6] bg-[#EEEBFB] px-4 py-2 rounded-full hover:bg-[#E3DFF8] transition">
                    <TrashIcon /> Clear History
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
              ) : displayedAppointments.length === 0 ? (
                <div className="bg-white p-10 text-center rounded-3xl shadow-sm border border-slate-200">
                  <p className="text-slate-400 font-medium">No appointments in the queue right now.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {displayedAppointments.map((appt) => {
                    const isPending = appt.status === "Pending";
                    const isCompleted = appt.status === "Completed";
                    const isCancelled = appt.status === "Cancelled";

                    return (
                      <div key={appt.id} className={`bg-white rounded-2xl border border-[#E6E3F5] border-l-[6px] ${isCancelled ? 'border-l-rose-400 opacity-80' : 'border-l-[#C9C3EE]'} shadow-[0_2px_10px_rgba(76,65,166,0.07)] px-5 py-4 transition ${isCompleted ? 'opacity-70' : ''}`}>
                        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              
                              <h3 
                                onClick={() => handlePatientClick(appt)}
                                className={`text-lg font-extrabold hover:underline cursor-pointer transition ${isCancelled ? 'text-slate-500 line-through' : 'text-[#2B2468] hover:text-[#4C41A6]'}`}
                                title="Click to view patient history"
                              >
                                {appt.patient}
                              </h3>
                              
                              {isPending && !appt.rescheduleRequested && <span className="inline-flex items-center gap-1 bg-[#FDE4EA] text-[#D6456B] border border-[#F9C9D4] text-[10px] px-2.5 py-1 rounded-full font-bold"><WarnIcon /> Awaiting Patient Action</span>}
                              {appt.rescheduleRequested && <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2.5 py-1 rounded-full font-bold"><WarnIcon /> Awaiting Reschedule</span>}
                              {isCompleted && <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] px-2.5 py-1 rounded-full font-bold">Completed</span>}
                              
                              {isCancelled && <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] px-2.5 py-1 rounded-full font-bold">Cancelled by Patient</span>}

                              {appt.prescriptionUrl && <span className="bg-[#EEEBFB] text-[#4C41A6] border border-[#DDD8F3] text-[10px] px-2.5 py-1 rounded-full font-bold">Prescription Uploaded</span>}
                            
                            </div>
                            <p className="text-xs text-slate-600">Phone: {appt.phone || "Not provided"}</p>
                            <div className="flex items-center gap-2 mt-3">
                              <span className={`${isCancelled ? 'bg-slate-100 text-slate-400' : 'bg-[#EEEBFB] text-[#4C41A6]'} text-xs font-bold px-3 py-1.5 rounded-lg`}>{appt.dayLabel} at {appt.slot}</span>
                              <span className="w-px h-4 bg-slate-300" />
                              <span className={`${isCancelled ? 'bg-slate-100 text-slate-400' : 'bg-[#EEEBFB] text-[#4C41A6]'} text-xs font-bold px-3 py-1.5 rounded-lg`}>Token #{appt.token}</span>
                            </div>
                            {appt.reason && (
                              <div className="mt-3 inline-block border border-slate-200 bg-white rounded-xl px-3.5 py-2 text-xs text-slate-600 shadow-sm">
                                <span className="font-bold text-slate-800">Reason:</span> <span className="font-semibold ml-1">{appt.reason}</span>
                              </div>
                            )}

                            {appt.healthRecordUrl && (
                              <div className="mt-3">
                                <a 
                                  href={appt.healthRecordUrl} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 transition"
                                >
                                  📄 View Patient Report
                                </a>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col lg:items-end gap-3 shrink-0">
                            <span className={`inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full font-bold border w-max ${appt.paymentStatus === "Paid" ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-[#F7F6FC] text-slate-500 border-[#E6E3F5]'}`}>
                              {appt.paymentStatus === "Paid" ? <><CardIcon /> Paid</> : "💵 To be paid"}
                            </span>
                            
                            <div className="flex flex-wrap gap-2 items-center">
                                {appt.prescriptionUrl ? (
                                  <a href={appt.prescriptionUrl} target="_blank" rel="noreferrer" className="bg-[#EEEBFB] border border-[#DDD8F3] text-[#4C41A6] px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-[#E3DFF8] transition">
                                    View Prescription
                                  </a>
                                ) : (
                                  !isCancelled && (
                                    <button onClick={() => { setSelectedAppt(appt); setShowUploadModal(true); }} className="bg-white border border-slate-300 text-slate-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition">
                                      Upload Prescription
                                    </button>
                                  )
                                )}

                                {isPending && !appt.rescheduleRequested && (
                                  <>
                                    <button onClick={() => updateStatus(appt.id, "Upcoming")} className="bg-[#4C41A6] text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-[#3F3590] shadow-sm transition">Accept</button>
                                    <button onClick={() => updateStatus(appt.id, "Cancelled")} className="bg-white border border-slate-300 text-slate-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition">Decline</button>
                                  </>
                                )}
                                {appt.status === "Upcoming" && (
                                  <>
                                    <button onClick={() => updateStatus(appt.id, "Completed")} className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-100 transition">Complete</button>
                                    <button onClick={() => requestReschedule(appt)} className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-100 transition">Reschedule</button>
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

          {activeTab === 'earnings' && (
            <div>
              <div className="flex bg-[#EEEBFB] p-1 rounded-xl w-max mb-6">
                <button onClick={() => setEarningsView('daily')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${earningsView === 'daily' ? 'bg-white text-[#4C41A6] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Daily</button>
                <button onClick={() => setEarningsView('monthly')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${earningsView === 'monthly' ? 'bg-white text-[#4C41A6] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Monthly</button>
              </div>

              <div className="flex items-center justify-between mb-4">
                <button onClick={handlePrevMonth} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-bold">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <h3 className="text-lg font-extrabold text-[#2B2468]">{monthYearLabel}</h3>
                <button onClick={handleNextMonth} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-bold">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
              </div>

              {earningsView === 'daily' && (
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                  {daysInViewMonth.map(day => (
                    <button
                      key={day.fullDate}
                      onClick={() => setSelectedDate(day.fullDate)}
                      className={`flex flex-col items-center justify-center min-w-[70px] p-2.5 rounded-xl border transition ${
                        selectedDate === day.fullDate
                          ? 'bg-[#4C41A6] text-white border-[#4C41A6] shadow-md'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-bold uppercase">{day.dayName}</span>
                      <span className="text-xl font-black">{day.dayNum}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gradient-to-br from-[#4C41A6] to-[#3B3188] text-white p-8 rounded-3xl shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10 text-8xl font-serif">₹</div>
                  <p className="text-indigo-200 font-medium mb-1">
                    Total Earnings ({earningsView === 'daily' ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }) : monthYearLabel})
                  </p>
                  <h3 className="text-5xl font-black tracking-tight">₹{totalEarnings}</h3>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#E6E3F5] relative">
                  <div className="absolute top-0 right-0 p-6 opacity-5 text-8xl">👥</div>
                  <p className="text-slate-500 font-medium mb-1">
                    Patients Seen ({earningsView === 'daily' ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }) : monthYearLabel})
                  </p>
                  <h3 className="text-5xl font-black tracking-tight text-[#2B2468]">{patientCount}</h3>
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Transactions</h3>
              {earningsList.length === 0 ? (
                <div className="bg-white p-10 text-center rounded-3xl shadow-sm border border-slate-200">
                  <p className="text-slate-400 font-medium">No earnings recorded for this period yet.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-[#E6E3F5] overflow-hidden">
                  {earningsList.map((appt, index) => (
                    <div key={appt.id} className={`p-5 flex justify-between items-center ${index !== earningsList.length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <div>
                        <p className="font-bold text-[#2B2468]">{appt.patient}</p>
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

      {/* --- VERIFICATION MODAL --- */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-[#1E1A4D]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full">
            <div className="flex items-center gap-3 mb-2">
              <VerifiedIcon />
              <h3 className="text-2xl font-extrabold text-[#322B7B]">Get Verified</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Enter your {getVerificationLabel()} below. Once verified, you will receive the Blue Tick on your profile.
            </p>
            
            <form onSubmit={handleVerifySubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{getVerificationLabel()}</label>
                <input 
                  type="text" 
                  value={verifyInput}
                  onChange={(e) => setVerifyInput(e.target.value)}
                  placeholder="e.g., 12345"
                  required
                  className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6] text-sm" 
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowVerifyModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition">Cancel</button>
                <button type="submit" disabled={verifyLoading || !verifyInput.trim()} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-sm transition disabled:opacity-50">
                  {verifyLoading ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- PATIENT HISTORY MODAL --- */}
      {showPatientModal && selectedPatientData && (
        <div className="fixed inset-0 bg-[#1E1A4D]/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            
            <div className="bg-gradient-to-r from-[#4C41A6] to-[#3B3188] p-6 text-white flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-extrabold">{selectedPatientData.name}</h3>
                <p className="text-indigo-200 text-sm mt-1">📞 {selectedPatientData.phone || "No phone saved"}</p>
                <p className="text-indigo-200 text-sm mt-1">Total Visits with you: {selectedPatientHistory.length}</p>
              </div>
              <button 
                onClick={() => setShowPatientModal(false)}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Medical History</h4>
              
              <div className="space-y-4">
                {selectedPatientHistory.map((appt, idx) => (
                  <div key={appt.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                      appt.status === 'Completed' ? 'bg-emerald-400' : 
                      appt.status === 'Cancelled' ? 'bg-rose-400' : 'bg-[#4C41A6]'
                    }`}></div>
                    
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-slate-800">{appt.dayLabel} at {appt.slot}</p>
                        <p className="text-xs font-semibold text-slate-500">Token #{appt.token} · Status: {appt.status}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-md font-bold ${
                        appt.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                        appt.status === 'Cancelled' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'
                      }`}>
                        {appt.status}
                      </span>
                    </div>

                    {appt.reason && (
                      <p className="text-sm text-slate-600 mb-3">
                        <span className="font-bold text-slate-700">Reason:</span> {appt.reason}
                      </p>
                    )}

                    <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                      {appt.prescriptionUrl ? (
                        <a href={appt.prescriptionUrl} target="_blank" rel="noreferrer" className="flex-1 text-center bg-[#EEEBFB] border border-[#DDD8F3] text-[#4C41A6] px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#E3DFF8] transition">
                          View Prescription
                        </a>
                      ) : (
                        <button onClick={() => { setSelectedAppt(appt); setShowUploadModal(true); }} className="flex-1 text-center bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition">
                          Upload Prescription
                        </button>
                      )}

                      {appt.healthRecordUrl && (
                        <a href={appt.healthRecordUrl} target="_blank" rel="noreferrer" className="flex-1 text-center bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 transition">
                          View Patient Report
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-white border-t border-slate-200">
              <button onClick={() => setShowPatientModal(false)} className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition">
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- UPLOAD PRESCRIPTION MODAL --- */}
      {showUploadModal && selectedAppt && (
        <div className="fixed inset-0 bg-[#1E1A4D]/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full">
            <h3 className="text-2xl font-extrabold text-[#322B7B] mb-2">Upload Prescription</h3>
            <p className="text-sm text-slate-500 mb-6">
              Patient: <span className="font-bold text-slate-800">{selectedAppt.patient}</span><br/>
              Visit: {selectedAppt.dayLabel}
            </p>
            
            <form onSubmit={handlePrescriptionUpload} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Select File (Image or PDF)</label>
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  onChange={(e) => setPrescriptionFile(e.target.files[0])} 
                  required
                  className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6] text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#EEEBFB] file:text-[#4C41A6] hover:file:bg-[#E3DFF8]" 
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowUploadModal(false); setPrescriptionFile(null); }} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition">Cancel</button>
                <button type="submit" disabled={uploadLoading || !prescriptionFile} className="flex-1 bg-[#4C41A6] text-white py-3 rounded-xl font-bold hover:bg-[#3F3590] shadow-sm transition disabled:opacity-50">
                  {uploadLoading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT PROFILE MODAL --- */}
      {showEditModal && (
        <div className="fixed inset-0 bg-[#1E1A4D]/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full my-8">
            <h3 className="text-2xl font-extrabold text-[#322B7B] mb-4">Edit Profile</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="flex flex-col items-center mb-4">
                <div className="w-24 h-24 rounded-full border-4 border-slate-100 overflow-hidden bg-slate-50 flex items-center justify-center mb-3">
                  {editPhotoPreview ? <img src={editPhotoPreview} alt="Preview" className="w-full h-full object-cover" /> : <span className="text-3xl text-slate-300">📷</span>}
                </div>
                <label className="text-sm font-bold text-[#4C41A6] cursor-pointer hover:underline">
                  Change Photo
                  <input type="file" accept="image/*" onChange={handleEditPhotoChange} className="hidden" />
                </label>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Doctor Name</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6]" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Clinic Name</label>
                <input type="text" value={editForm.clinicName} onChange={(e) => setEditForm({...editForm, clinicName: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6]" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Clinic Address</label>
                <input type="text" value={editForm.clinicAddress} onChange={(e) => setEditForm({...editForm, clinicAddress: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6]" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Google Maps Link (Optional)</label>
                <input type="text" value={editForm.mapLocation} onChange={(e) => setEditForm({...editForm, mapLocation: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6]" placeholder="https://maps.google.com/..." />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Consultation Fee (₹)</label>
                <input type="number" value={editForm.consultationFee} onChange={(e) => setEditForm({...editForm, consultationFee: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6]" required />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition">Cancel</button>
                <button type="submit" disabled={editLoading} className="flex-1 bg-[#4C41A6] text-white py-3 rounded-xl font-bold hover:bg-[#3F3590] shadow-sm transition">
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SCHEDULE MODAL --- */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-[#1E1A4D]/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full my-8">
            <h3 className="text-2xl font-extrabold text-[#322B7B] mb-4">Manage Availability</h3>
            
            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-700 mb-2">Working Days</label>
              <div className="flex flex-wrap gap-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                  <button key={day} onClick={() => {
                      const newDays = schedule.workingDays.includes(day) ? schedule.workingDays.filter(d => d !== day) : [...schedule.workingDays, day];
                      setSchedule({ ...schedule, workingDays: newDays });
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-bold border transition ${schedule.workingDays.includes(day) ? "bg-[#4C41A6] text-white border-[#4C41A6] shadow-sm" : "bg-white text-slate-500 border-slate-300 hover:bg-slate-50"}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-4 mb-5">
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Start Time</label>
                <input type="time" value={schedule.startTime} onChange={(e) => setSchedule({ ...schedule, startTime: e.target.value })} className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6]" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">End Time</label>
                <input type="time" value={schedule.endTime} onChange={(e) => setSchedule({ ...schedule, endTime: e.target.value })} className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6]" />
              </div>
            </div>
            
            <div className="flex gap-4 mb-5">
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Slot Duration</label>
                <select value={schedule.slotDuration} onChange={(e) => setSchedule({ ...schedule, slotDuration: Number(e.target.value) })} className="w-full border border-slate-300 p-2.5 rounded-xl bg-white outline-none focus:border-[#4C41A6]">
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Max Patients/Day</label>
                <input 
                  type="number" 
                  value={schedule.maxDailyPatients} 
                  onChange={(e) => setSchedule({ ...schedule, maxDailyPatients: Number(e.target.value) })} 
                  className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6]" 
                  min="1"
                />
              </div>
            </div>

            <div className="mb-8 p-4 bg-[#F7F6FC] rounded-2xl border border-[#E6E3F5]">
              <h4 className="font-bold text-slate-800 mb-3 text-sm">Leave / Absence Notice</h4>
              <p className="text-xs text-slate-500 mb-3">Patients will see a red warning on your profile during these dates.</p>
              
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">Message</label>
                <input 
                  type="text" 
                  value={leaveMessage} 
                  onChange={(e) => setLeaveMessage(e.target.value)} 
                  placeholder="e.g. Attending a medical conference"
                  className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6] text-sm" 
                />
              </div>
              
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                  <input type="date" value={leaveStartDate} onChange={(e) => setLeaveStartDate(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6] text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Date</label>
                  <input type="date" value={leaveEndDate} onChange={(e) => setLeaveEndDate(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-[#4C41A6] text-sm" />
                </div>
              </div>

              {(leaveMessage || leaveStartDate || leaveEndDate) && (
                <button 
                  onClick={() => { setLeaveMessage(''); setLeaveStartDate(''); setLeaveEndDate(''); }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1"
                >
                  <TrashIcon /> Clear Notice
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowScheduleModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition">Cancel</button>
              <button onClick={saveSchedule} className="flex-1 bg-[#4C41A6] text-white py-3 rounded-xl font-bold hover:bg-[#3F3590] shadow-sm transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}