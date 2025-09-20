import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Shield, User, Mail, Bell, CheckCircle, AlertCircle, Edit, RefreshCw, Monitor, Smartphone, LogOut, Loader, Check, Crown, LogOut as LogOutIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import './SettingsPage.css';
import { useAuth } from '../../context/AuthContext'; // <-- استيراد useAuth

const RelativeTime = React.memo(({ date }) => {
  const [relativeTime, setRelativeTime] = useState('');

  useEffect(() => {
    const calculateRelativeTime = () => {
      if (!date) {
        setRelativeTime('');
        return;
      }
      const then = new Date(date);
      const now = new Date();
      const seconds = Math.round((now - then) / 1000);
      const minutes = Math.round(seconds / 60);
      const hours = Math.round(minutes / 60);
      const days = Math.round(hours / 24);

      if (seconds < 10) setRelativeTime('الآن');
      else if (seconds < 60) setRelativeTime(`منذ ${seconds} ثانية`);
      else if (minutes === 1) setRelativeTime('منذ دقيقة');
      else if (minutes < 60) setRelativeTime(`منذ ${minutes} دقائق`);
      else if (hours === 1) setRelativeTime('منذ ساعة');
      else if (hours < 24) setRelativeTime(`منذ ${hours} ساعات`);
      else if (days === 1) setRelativeTime('أمس');
      else setRelativeTime(`منذ ${days} أيام`);
    };

    calculateRelativeTime();
    const intervalId = setInterval(calculateRelativeTime, 30000); // Update every 30 seconds

    return () => clearInterval(intervalId);
  }, [date]);

  return <>{relativeTime}</>;
});

const SettingsPage = () => {
  const [userData, setUserData] = useState({
    email: '',
    name: '',
    pendingEmail: null,
    subscriptionTier: 'FREE', // Default value
    avatarUrl: '',
    notificationsEnabled: true,
    virtualEmail: null,
    twoFactorAuth: false,
    isDeveloper: false, // <-- إضافة الحالة الجديدة
  });
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState(''); // This state is for the modal input
  const [nameInput, setNameInput] = useState(''); // Separate state for name input
  const [is2faModalOpen, setIs2faModalOpen] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState({ secret: '', qrCodeUrl: '' });
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1 for email input, 2 for code input
  const [verificationCode, setVerificationCode] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameUpdateSuccess, setNameUpdateSuccess] = useState(false);
  const [isTogglingVirtualEmail, setIsTogglingVirtualEmail] = useState(false);
  const [isTogglingForwarding, setIsTogglingForwarding] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isCreatingVirtualEmail, setIsCreatingVirtualEmail] = useState(false);
  const [activeSessions, setActiveSessions] = useState([]);
  const otpInputsRef = useRef([]);
  const navigate = useNavigate();
  const { updateUser } = useAuth(); // <-- الحصول على دالة تحديث المستخدم

  useEffect(() => {
    const loadUserData = async () => {
      setIsLoading(true);
      try {
        // جلب بيانات المستخدم والجلسات في نفس الوقت
        const [userResponse, sessionsResponse] = await Promise.all([
          axios.get('http://localhost:3001/api/user/me', { withCredentials: true }),
          axios.get('http://localhost:3001/api/user/sessions', { withCredentials: true })
        ]);

        setUserData(userResponse.data);
        setNameInput(userResponse.data.name || '');
        setActiveSessions(sessionsResponse.data);

      } catch (error) {
        console.error('Error loading user data:', error);
        showError('حدث خطأ أثناء تحميل بيانات المستخدم');
      } finally {
        setIsLoading(false);
      }
    };

    const setupWebSocket = () => {
      const ws = new WebSocket('ws://localhost:3001');
      ws.onopen = () => console.log('WebSocket Connected');
      ws.onclose = () => console.log('WebSocket Disconnected');

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        setActiveSessions(currentSessions => {
          switch (message.type) {
            case 'session_online':
              return currentSessions.map(s => s.id === message.payload.sessionId ? { ...s, isOnline: true, connectedAt: new Date().toISOString() } : s);
            case 'session_offline':
              return currentSessions.map(s => s.id === message.payload.sessionId ? { ...s, isOnline: false, lastActivity: new Date().toISOString() } : s);
            case 'session_terminated':
              return currentSessions.filter(s => s.id !== message.payload.sessionId);
            default:
              return currentSessions;
          }
        });
      };

      // Cleanup on component unmount
      return () => { if (ws.readyState === WebSocket.OPEN) ws.close(); };
    };
    loadUserData();
    const cleanupWs = setupWebSocket();
    return cleanupWs;
  }, []);

  useEffect(() => {
    // Auto-focus the first OTP input when the modal step changes to 2
    if (modalStep === 2 && otpInputsRef.current[0]) {
      otpInputsRef.current[0].focus();
    }
  }, [modalStep]);

  const showSuccess = (message = 'تم حفظ التغييرات بنجاح') => {
    setSuccessMessage(message);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const showError = (message) => {
    setErrorMessage(message);
    setSuccessMessage('');
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const updateUsername = async () => {
    if (nameInput === userData.name) return; // لا تقم بالتحديث إذا لم يتغير الاسم
    setIsUpdatingName(true);
    setNameUpdateSuccess(false);
    try {
      const response = await axios.patch('http://localhost:3001/api/user/me', { name: nameInput }, { withCredentials: true });
      setUserData({ ...userData, name: response.data.user.name });
      setNameUpdateSuccess(true);
      setTimeout(() => setNameUpdateSuccess(false), 2500); // إعادة تعيين الحالة بعد 2.5 ثانية
    } catch (error) {
      console.error('Error updating username:', error);
      showError(error.response?.data?.message || 'حدث خطأ أثناء تحديث اسم المستخدم');
    } finally {
      setIsUpdatingName(false);
    }
  };

  const toggleVirtualEmail = async () => {
    if (!userData.virtualEmail) return;
    const isActive = !userData.virtualEmail?.isActive;
    setIsTogglingVirtualEmail(true);
    try {
      await axios.patch('/api/user/virtual-email', { active: isActive }, { withCredentials: true });
      setUserData({ ...userData, virtualEmail: { ...userData.virtualEmail, isActive } });
      showSuccess(`تم ${isActive ? 'تفعيل' : 'إيقاف'} البريد الوهمي بنجاح`);
    } catch (error) {
      console.error('Error toggling virtual email:', error);
      showError(error.response?.data?.message || 'فشل تغيير حالة البريد الوهمي');
    } finally {
      setIsTogglingVirtualEmail(false);
    }
  };

  const toggleForwarding = async () => {
    if (!userData.virtualEmail) return;
    const isForwardingActive = !userData.virtualEmail?.isForwardingActive;
    setIsTogglingForwarding(true);
    try {
      await axios.patch('/api/user/virtual-email/forwarding', { enabled: isForwardingActive }, { withCredentials: true });
      setUserData({ ...userData, virtualEmail: { ...userData.virtualEmail, isForwardingActive } });
      showSuccess(`تم ${isForwardingActive ? 'تفعيل' : 'إيقاف'} إعادة توجيه الرسائل`);
    } catch (error) {
      console.error('Error toggling forwarding:', error);
      showError(error.response?.data?.message || 'فشل تغيير حالة إعادة التوجيه');
    } finally {
      setIsTogglingForwarding(false);
    }
  };

  const regenerateVirtualEmail = async () => {
    if (!window.confirm('هل أنت متأكد من إعادة توليد البريد الوهمي؟ سيتم فصل جميع المواقع المرتبطة بالبريد الحالي.')) {
      return;
    }
    setIsRegenerating(true);
    try {
      const response = await axios.post('/api/user/regenerate-virtual-email', {}, { withCredentials: true });
      setUserData({ ...userData, virtualEmail: { ...userData.virtualEmail, address: response.data.email, canChange: response.data.canChange } });
      showSuccess('تم إعادة توليد البريد الوهمي بنجاح');
    } catch (error) {
      console.error('Error regenerating virtual email:', error);
      showError(error.response?.data?.message || 'فشل إعادة توليد البريد الوهمي');
    } finally {
      setIsRegenerating(false);
    }
  };

  const createVirtualEmail = async () => {
    setIsCreatingVirtualEmail(true);
    try {
      const response = await axios.post('/api/user/virtual-email/generate', {}, { withCredentials: true });
      // Assuming the response contains the new virtual email object
      setUserData({ ...userData, virtualEmail: response.data });
      showSuccess('تم إنشاء البريد الوهمي بنجاح!');
    } catch (error) {
      console.error('Error creating virtual email:', error);
      showError(error.response?.data?.message || 'فشل إنشاء البريد الوهمي.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNotifications = async () => {
    const isEnabled = !userData.notificationsEnabled;
    setIsLoading(true);
    try {
      await axios.patch('/api/user/notifications', { enabled: isEnabled }, { withCredentials: true });
      setUserData({ ...userData, notificationsEnabled: isEnabled });
      showSuccess(`تم ${isEnabled ? 'تفعيل' : 'إيقاف'} الإشعارات بنجاح`);
    } catch (error) {
      console.error('Error updating notification settings:', error);
      showError(error.response?.data?.message || 'حدث خطأ أثناء تحديث إعدادات الإشعارات');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDeveloperMode = async () => {
    const isEnabled = !userData.isDeveloper;
    setIsLoading(true);
    try {
      const response = await axios.patch('http://localhost:3001/api/user/developer-mode', { enabled: isEnabled }, { withCredentials: true });
      setUserData({ ...userData, isDeveloper: isEnabled });
      updateUser({ isDeveloper: response.data.isDeveloper }); // <-- تحديث الحالة العامة للمستخدم
      showSuccess(`تم ${isEnabled ? 'تفعيل' : 'إيقاف'} وضع المطورين بنجاح.`);
    } catch (error) {
      console.error('Error toggling developer mode:', error);
      showError(error.response?.data?.message || 'فشل في تغيير وضع المطورين.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle2FA = async () => {
    const isEnabled = !userData.twoFactorAuth;
    if (isEnabled) {
      // Start the process to enable 2FA
      setIsLoading(true);
      try {
        const response = await axios.post('http://localhost:3001/api/user/2fa/generate', {}, { withCredentials: true });
        const qrCodeResponse = await axios.get(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(response.data.otpauth_url)}`, { responseType: 'blob' });
        setTwoFactorData({
          secret: response.data.secret,
          qrCodeUrl: URL.createObjectURL(qrCodeResponse.data),
        });
        setIs2faModalOpen(true);
      } catch (error) {
        showError('فشل في بدء إعداد المصادقة الثنائية.');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Disable 2FA
      if (window.confirm('هل أنت متأكد من رغبتك في تعطيل المصادقة الثنائية؟')) {
        setIsLoading(true);
        try {
          await axios.post('http://localhost:3001/api/user/2fa/disable', {}, { withCredentials: true });
          setUserData({ ...userData, twoFactorAuth: false });
          showSuccess('تم تعطيل المصادقة الثنائية بنجاح.');
        } catch (error) {
          showError(error.response?.data?.message || 'فشل تعطيل المصادقة الثنائية.');
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  const handleVerify2FA = async () => {
    try {
      const response = await axios.post('http://localhost:3001/api/user/2fa/verify', { token: twoFactorCode }, { withCredentials: true });
      setUserData({ ...userData, twoFactorAuth: true });
      setIs2faModalOpen(false);
      showSuccess('تم تفعيل المصادقة الثنائية بنجاح!');
      // Show recovery codes
      setRecoveryCodes(response.data.recoveryCodes);
      setIsRecoveryModalOpen(true);
    } catch (error) {
      showError(error.response?.data?.message || 'رمز التحقق غير صحيح.');
    }
  };

  const handleRegenerateRecoveryCodes = async () => {
    if (window.confirm('هل أنت متأكد؟ سيتم إلغاء جميع أكواد الاسترداد القديمة وإنشاء مجموعة جديدة.')) {
      setIsLoading(true);
      try {
        const response = await axios.post('http://localhost:3001/api/user/2fa/regenerate-recovery', {}, { withCredentials: true });
        setRecoveryCodes(response.data.recoveryCodes);
        setIsRecoveryModalOpen(true); // Show the modal with new codes
        showSuccess('تم إنشاء أكواد استرداد جديدة بنجاح.');
      } catch (error) {
        console.error('Error regenerating recovery codes:', error);
        showError(error.response?.data?.message || 'فشل في إنشاء أكواد استرداد جديدة.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const openEmailModal = () => {
    setModalStep(1);
    setNewEmail('');
    setVerificationCode('');
    setIsEmailModalOpen(true);
  };
  const closeEmailModal = () => {
    setIsEmailModalOpen(false);
  };

  const handleRequestCode = async () => {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      showError('يرجى إدخال بريد إلكتروني جديد وصحيح.');
      return;
    }
    setIsLoading(true);
    try {
      await axios.post('http://localhost:3001/api/auth/request-email-change-code', {}, { withCredentials: true });
      setModalStep(2); // Move to the next step
      showSuccess(`تم إرسال رمز التحقق إلى بريدك الحالي: ${userData.email}`);
    } catch (error) {
      showError(error.response?.data?.message || 'فشل إرسال رمز التحقق.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmEmailChange = async () => {
    if (!verificationCode) {
      showError('يرجى إدخال رمز التحقق.');
      return;
    }
    setIsLoading(true);
    try {
      await axios.patch('http://localhost:3001/api/user/me', {
        email: newEmail,
        verificationCode: verificationCode,
      }, { withCredentials: true });

      setUserData({ ...userData, pendingEmail: newEmail }); // Update UI to show pending state
      closeEmailModal();
      showSuccess('تم استلام طلبك. يرجى التحقق من بريدك الجديد لتأكيد التغيير.');
    } catch (error) {
      console.error('Error confirming email change:', error);
      showError(error.response?.data?.message || 'فشل تأكيد تغيير البريد الإلكتروني.');
      setModalStep(1); // Go back to step 1 on failure
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (element, index) => {
    if (isNaN(element.value)) return false; // Only allow numbers

    setVerificationCode(prev => {
      const newCode = prev.split('');
      newCode[index] = element.value;
      return newCode.join('').substring(0, 6);
    });

    // Focus next input
    if (element.nextSibling) {
      element.nextSibling.focus();
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === "Backspace" && !verificationCode[index] && e.target.previousSibling) {
      e.target.previousSibling.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pastedData = e.clipboardData.getData('text');
    if (/^\d{6}$/.test(pastedData)) {
      setVerificationCode(pastedData);
      // Focus the last input after paste
      setTimeout(() => {
        if (otpInputsRef.current[5]) {
          otpInputsRef.current[5].focus();
        }
      }, 0);
    }
  };

  // TODO: Implement backend logic for these functions
  const resendVerification = async () => {
    setIsLoading(true);
    try {
      await axios.post('http://localhost:3001/api/user/resend-email-change', {}, { withCredentials: true });
      showSuccess(`تم إعادة إرسال رسالة التفعيل إلى ${userData.pendingEmail}`);
    } catch (error) {
      showError(error.response?.data?.message || 'فشل إعادة إرسال رسالة التفعيل.');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelEmailChange = async () => {
    setIsLoading(true);
    try {
      // استدعاء نقطة الوصول الجديدة في الواجهة الخلفية
      await axios.post('http://localhost:3001/api/user/cancel-email-change', {}, { withCredentials: true });
      // تحديث الحالة في الواجهة الأمامية لإخفاء إشعار الانتظار
      setUserData({ ...userData, pendingEmail: null });
      showSuccess('تم إلغاء طلب تغيير البريد الإلكتروني بنجاح.');
    } catch (error) {
      showError(error.response?.data?.message || 'فشل إلغاء طلب تغيير البريد.');
    } finally {
      setIsLoading(false);
    }
  };

  const terminateSession = async (sessionId) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في إنهاء هذه الجلسة؟')) return;

    try {
      await axios.delete(`http://localhost:3001/api/user/sessions/${sessionId}`, { withCredentials: true });
      setActiveSessions(prev => prev.filter(session => session.id !== sessionId));
      showSuccess('تم إنهاء الجلسة بنجاح.');
    } catch (error) {
      console.error('Error terminating session:', error);
      showError(error.response?.data?.message || 'فشل إنهاء الجلسة.');
    }
  };

  const terminateAllOtherSessions = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في إنهاء جميع الجلسات الأخرى؟ سيتم تسجيل خروجك من كل الأجهزة ما عدا هذا الجهاز.')) return;

    const otherSessions = activeSessions.filter(s => !s.isCurrent);
    try {
      await Promise.all(otherSessions.map(session => 
        axios.delete(`http://localhost:3001/api/user/sessions/${session.id}`, { withCredentials: true })
      ));
      setActiveSessions(prev => prev.filter(session => session.isCurrent));
      showSuccess('تم إنهاء جميع الجلسات الأخرى بنجاح.');
    } catch (error) {
      showError('فشل إنهاء بعض الجلسات. يرجى المحاولة مرة أخرى.');
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await axios.post('http://localhost:3001/api/auth/logout', {}, { withCredentials: true });
      // Redirect to login page after successful logout
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      showError(error.response?.data?.message || 'فشل تسجيل الخروج. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };
  if (isLoading && !userData.email) {
    return <div>جاري التحميل...</div>; // Or a proper loader component
  }

  return (
    <div className="min-h-screen settings-container" dir="rtl" lang="ar">

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 fade-in">
          <h1 className="text-3xl font-bold text-gray-900">إعدادات الحساب</h1>
          <p className="text-gray-600 mt-2">إدارة بريدك الوهمي، البريد الأساسي، وإشعاراتك.</p>
        </div>

        {successMessage && (
          <div className="success-message bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <CheckCircle className="text-green-600 w-5 h-5 mr-2" />
              <span className="text-green-800 font-medium">{successMessage}</span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="error-message bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="text-red-600 w-5 h-5 mr-2" />
              <span className="text-red-800 font-medium">{errorMessage}</span>
            </div>
          </div>
        )}

        {/* قسم البريد الإلكتروني المعلق */}
        {userData.pendingEmail && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 fade-in">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="mr-3">
                <p className="text-sm font-medium text-yellow-800">
                  تغيير البريد الإلكتروني قيد الانتظار
                </p>
                <p className="mt-1 text-sm text-yellow-700">
                  تم إرسال رسالة تفعيل إلى <span className="font-bold">{userData.pendingEmail}</span>. يرجى التحقق من بريدك لتأكيد التغيير.
                  <button onClick={resendVerification} className="font-bold text-yellow-800 hover:underline mr-2">إعادة الإرسال</button>
                  <button onClick={cancelEmailChange} className="font-bold text-gray-600 hover:underline mr-2">(إلغاء)</button>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <div className="bg-white rounded-xl shadow-md p-6 settings-card fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">المعلومات الشخصية</h2>
              <User className="text-indigo-600 w-5 h-5" />
            </div>
            <div className="space-y-4">
              <div className="profile-info__email">
                <label className="block text-sm font-medium text-gray-700 mb-2">البريد الأساسي</label>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{userData.email}</span>
                  <button
                    type="button"
                    className="btn-secondary text-indigo-600 hover:text-indigo-800 text-sm font-medium px-3 py-1 border border-gray-300 rounded-md transition-colors"
                    onClick={openEmailModal}
                    disabled={!!userData.pendingEmail} // تعطيل الزر إذا كان هناك طلب معلق
                  >
                    <Edit className="w-4 h-4 ml-1" />
                    تعديل
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">سيتم إرسال رسالة تفعيل إلى البريد الجديد عند التغيير</p>
              </div>
              <div className="profile-info__username">
                <label className="block text-sm font-medium text-gray-700 mb-2">اسم المستخدم (اختياري)</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={nameInput}
                    disabled={isUpdatingName}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                  />
                  <button
                    type="button"
                    className="btn-secondary text-gray-600 hover:text-gray-800 text-sm font-medium px-3 py-2 mr-2 border border-gray-300 rounded-md transition-colors w-20 flex justify-center items-center disabled:opacity-50"
                    onClick={updateUsername}
                    disabled={isUpdatingName || nameInput === userData.name}
                  >
                    {isUpdatingName ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : nameUpdateSuccess ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      'حفظ'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 settings-card fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">إعدادات البريد الوهمي</h2>
              <Mail className="text-indigo-600 w-5 h-5" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">حالة البريد الوهمي</label>
                  <span className={`text-sm font-medium ${userData.virtualEmail?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {userData.virtualEmail?.isActive ? 'نشط' : 'غير نشط'}
                  </span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={!!userData.virtualEmail?.isActive}
                    onChange={toggleVirtualEmail}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">إعادة توجيه الرسائل</label>
                  <span className={`text-sm font-medium ${userData.virtualEmail?.isForwardingActive ? 'text-green-600' : 'text-red-600'}`}>
                    {userData.virtualEmail?.isForwardingActive ? 'مفعل' : 'متوقف'}
                  </span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={!!userData.virtualEmail?.isForwardingActive}
                    onChange={toggleForwarding}
                    disabled={isTogglingForwarding || !userData.virtualEmail}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">البريد الوهمي الحالي</label>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{userData.virtualEmail?.address || 'لا يوجد'}</span>
                  {userData.virtualEmail ? (
                    userData.subscriptionTier === 'PRO' ? (
                      <button
                        type="button"
                        className="btn-secondary text-indigo-600 hover:text-indigo-800 text-sm font-medium px-3 py-1 border border-gray-300 rounded-md transition-colors w-28 flex justify-center items-center disabled:opacity-50"
                        onClick={regenerateVirtualEmail}
                        disabled={isRegenerating}
                      >
                        {isRegenerating ? <Loader className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 ml-1" />إعادة توليد</>}
                      </button>
                    ) : (
                      <Link to="/pricing" className="btn-secondary text-amber-600 hover:text-amber-800 bg-amber-50 border-amber-200 text-sm font-medium px-3 py-1 rounded-md transition-colors w-28 flex justify-center items-center">
                        <Crown className="w-4 h-4 ml-1" />
                        ترقية
                      </Link>
                    )
                  ) : (
                    <button
                      type="button"
                      className="btn-primary text-white bg-indigo-600 hover:bg-indigo-700 text-sm font-medium px-3 py-1 rounded-md transition-colors w-32 flex justify-center items-center disabled:opacity-50"
                      onClick={createVirtualEmail}
                      disabled={isCreatingVirtualEmail}
                    >
                      {isCreatingVirtualEmail ? <Loader className="w-4 h-4 animate-spin" /> : 'إنشاء بريد وهمي'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">سيتم إنشاء بريد وهمي جديد وفصل جميع المواقع المرتبطة بالبريد الحالي</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 settings-card fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">إعدادات الإشعارات</h2>
              <Bell className="text-indigo-600 w-5 h-5" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تفعيل الإشعارات</label>
                  <span className="text-sm text-gray-600">تلقي إشعارات حول نشاط حسابك</span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-1 rounded-md ml-2">قريباً</span>
                  <label className="toggle-switch opacity-50 cursor-not-allowed">
                    <input
                      type="checkbox"
                      checked={false}
                      disabled
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 settings-card fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">إعدادات الأمان</h2>
              <Shield className="text-indigo-600 w-5 h-5" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المصادقة الثنائية (2FA)</label>
                  <span className="text-sm text-gray-600">طبقة أمان إضافية لحسابك</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={!!userData.twoFactorAuth}
                    onChange={handleToggle2FA}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              {userData.twoFactorAuth && (
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={handleRegenerateRecoveryCodes}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading}
                  >
                    <RefreshCw className="w-4 h-4 ml-2" />
                    إعادة إنشاء أكواد الاسترداد
                  </button>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الأجهزة النشطة</label>
                <div className="border border-gray-200 rounded-lg">
                  <ul className="divide-y divide-gray-200">
                    {activeSessions.map(session => (
                      <li key={session.id} className={`p-3 flex items-center justify-between ${session.isCurrent ? 'bg-green-50' : ''}`}>
                        <div className="flex items-center">
                          {session.device.includes('Windows') || session.device.includes('Mac') ? 
                            <Monitor className="text-gray-500 w-5 h-5 ml-3" /> : 
                            <Smartphone className="text-gray-500 w-5 h-5 ml-3" />
                          }
                          <div>
                            <span className="text-sm text-gray-800 font-medium">{session.device}</span>
                            <div className="text-xs text-gray-500">
                              <span>IP: {session.ip}</span>
                              <span className="mx-1">·</span>
                              {session.isOnline ? (
                                <span className="text-green-600 font-medium">
                                  متصل <RelativeTime date={session.connectedAt} />
                                </span>
                              ) : (
                                <span>
                                  آخر نشاط <RelativeTime date={session.lastActivity} />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {session.isCurrent ? (
                          <span className="text-xs font-bold text-green-700 bg-green-200 px-2 py-1 rounded-full">الجهاز الحالي</span>
                        ) : (
                          <button onClick={() => terminateSession(session.id)} className="text-xs text-red-500 hover:underline">إنهاء</button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <button onClick={terminateAllOtherSessions} className="text-xs text-gray-600 hover:text-red-600 mt-3 flex items-center transition-colors">
                  <LogOutIcon className="w-3 h-3 ml-1" />
                  إنهاء جميع الجلسات الأخرى
                </button>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">وضع المطورين</label>
                    <span className="text-sm text-gray-600">الوصول إلى مفاتيح API وميزات المطورين</span>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={!!userData.isDeveloper}
                      onChange={toggleDeveloperMode}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
              {userData.isDeveloper && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">مفاتيح API</label>
                      <span className="text-sm text-gray-600">إدارة مفاتيح API الخاصة بتطبيقاتك</span>
                    </div>
                    <Link to="/api-keys" className="btn-secondary text-indigo-600 hover:text-indigo-800 text-sm font-medium px-3 py-1 border border-gray-300 rounded-md transition-colors">
                      إدارة المفاتيح
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">تغيير البريد الإلكتروني (الخطوة {modalStep}/2)</h3>
            {modalStep === 1 && (
              <>
                <p className="text-sm text-gray-600 mb-4">لأمان حسابك، سيتم إرسال رمز تحقق إلى بريدك الحالي.</p>
                <div className="mb-4">
                  <label htmlFor="newEmail" className="block text-sm font-medium text-gray-700 mb-2">البريد الإلكتروني الجديد</label>
                  <input type="email" id="newEmail" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div className="flex justify-end space-x-2 space-x-reverse">
                  <button type="button" className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors" onClick={closeEmailModal}>إلغاء</button>
                  <button type="button" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors" onClick={handleRequestCode} disabled={isLoading}>{isLoading ? 'جاري الإرسال...' : 'طلب الرمز'}</button>
                </div>
              </>
            )}
            {modalStep === 2 && (
              <>
                <p className="text-sm text-gray-600 mb-4">أدخل رمز التحقق المكون من 6 أرقام الذي تم إرساله إلى <strong>{userData.email}</strong>.</p>
                <div className="mb-4">
                  <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-2">رمز التحقق</label>
                  <div className="flex justify-center gap-2" dir="ltr" onPaste={handleOtpPaste}>
                    {Array(6).fill("").map((_, index) => (
                      <input
                        key={index}
                        ref={el => otpInputsRef.current[index] = el}
                        type="text"
                        maxLength="1"
                        className="w-12 h-14 text-center text-2xl font-semibold border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        value={verificationCode[index] || ''}
                        onChange={e => handleOtpChange(e.target, index)}
                        onFocus={e => e.target.select()}
                        onKeyDown={e => handleOtpKeyDown(e, index)}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <button type="button" className="text-sm text-indigo-600 hover:underline" onClick={() => setModalStep(1)}>العودة</button>
                  <div className="flex space-x-2 space-x-reverse">
                    <button type="button" className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors" onClick={closeEmailModal}>إلغاء</button>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
                      onClick={handleConfirmEmailChange}
                      disabled={isLoading}
                    >
                      {isLoading ? 'جاري التحقق...' : 'تأكيد التغيير'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {is2faModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">تفعيل المصادقة الثنائية</h3>
            <p className="text-sm text-gray-600 mb-4">امسح رمز QR باستخدام تطبيق المصادقة (مثل Google Authenticator).</p>
            <div className="flex justify-center my-4">
              {twoFactorData.qrCodeUrl ? (
                <img src={twoFactorData.qrCodeUrl} alt="QR Code" />
              ) : (
                <Loader className="w-8 h-8 animate-spin" />
              )}
            </div>
            <p className="text-xs text-gray-500 mb-4">أو أدخل المفتاح يدوياً: <br /><strong className="font-mono">{twoFactorData.secret}</strong></p>
            <div className="mb-4">
              <label htmlFor="2fa-code" className="block text-sm font-medium text-gray-700 mb-2">أدخل رمز التحقق</label>
              <input
                type="text"
                id="2fa-code"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-center tracking-widest text-lg"
                placeholder="xxxxxx"
              />
            </div>
            <button onClick={handleVerify2FA} className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">تفعيل</button>
            <button onClick={() => setIs2faModalOpen(false)} className="mt-2 w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">إلغاء</button>
          </div>
        </div>
      )}

      {isRecoveryModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 text-center">
            <h3 className="text-lg font-semibold text-red-600 mb-2">احفظ هذه الأكواد!</h3>
            <p className="text-sm text-gray-600 mb-4">
              استخدم هذه الأكواد لمرة واحدة للوصول إلى حسابك إذا فقدت جهازك. احفظها في مكان آمن.
            </p>
            <div className="grid grid-cols-2 gap-2 bg-gray-100 p-4 rounded-lg font-mono text-lg text-gray-800 my-4">
              {recoveryCodes.map((code, index) => (
                <div key={index}>{code}</div>
              ))}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(recoveryCodes.join('\n'));
                showSuccess('تم نسخ الأكواد!');
              }}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 mb-2"
            >
              نسخ الأكواد
            </button>
            <button onClick={() => setIsRecoveryModalOpen(false)} className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">لقد قمت بحفظها</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default SettingsPage;