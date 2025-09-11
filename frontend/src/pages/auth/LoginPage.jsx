import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles.css';
import { Shield, ArrowLeft, Loader, Github, Key, Check, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const translations = {
    "Email is already registered": "هذا البريد الإلكتروني مسجل بالفعل",
    "TOTP code sent successfully": "تم إرسال رمز التحقق بنجاح",
    "Email not registered": "البريد الإلكتروني غير مسجل",
    "Too many requests. Please wait 15 minutes before trying again.": "تم إرسال طلبات كثيرة جدًا، يرجى الانتظار 15 دقيقة قبل المحاولة مرة أخرى",
    "Server error during TOTP request": "حدث خطأ في الخادم أثناء طلب رمز التحقق",
    "TOTP code verified successfully": "تم التحقق من رمز التحقق بنجاح",
    "No valid TOTP code found": "لم يتم العثور على رمز تحقق صالح",
    "TOTP code expired": "رمز التحقق منتهي الصلاحية",
    "Invalid TOTP code": "رمز التحقق غير صحيح",
    "Too many verification attempts. Please wait 15 minutes.": "محاولات تحقق كثيرة جدًا، يرجى الانتظار 15 دقيقة",
    "Server error during TOTP verification": "حدث خطأ في الخادم أثناء التحقق من رمز التحقق"
};

const LoginPage = () => {
    const { login, user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [resendTimer, setResendTimer] = useState(90);
    const [countdownTimer, setCountdownTimer] = useState(90);
    const [emailError, setEmailError] = useState('');
    const [totpError, setTotpError] = useState('');
    const [totpSuccess, setTotpSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const codeInputsRef = useRef([]);

    useEffect(() => {
        let resendInterval, countdownInterval;
        if (step === 2) {
            setResendTimer(90);
            setCountdownTimer(90);
            resendInterval = setInterval(() => {
                setResendTimer(prev => {
                    if (prev <= 1) {
                        clearInterval(resendInterval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            countdownInterval = setInterval(() => {
                setCountdownTimer(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownInterval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            clearInterval(resendInterval);
            clearInterval(countdownInterval);
        };

        if (step === 2 && codeInputsRef.current[0]) {
            codeInputsRef.current[0].focus();
        }
    }, [step]);

    useEffect(() => {
        if (!authLoading && user) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, authLoading, navigate]);

    if (authLoading) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        if (!isValidEmail(email)) {
            setEmailError('يرجى إدخال بريد إلكتروني صحيح');
            return;
        }
        setEmailError('');
        setIsLoading(true);
        try {
            const response = await api.post('/auth/request-totp', { email });
            const data = response.data;
            // لا نعرض رسالة نجاح هنا، بل ننتقل مباشرة للخطوة التالية
            setStep(2);
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.message || 'حدث خطأ في الاتصال بالخادم';
            setEmailError(handleCooldownMessage(errorMessage));
        } finally {
            setIsLoading(false);
        }
    };

    const handleTotpSubmit = async (e) => {
        e.preventDefault();
        const totpCode = code.join('');
        if (totpCode.length !== 6 || !/^\d+$/.test(totpCode)) {
            setTotpError('يرجى إدخال رمز التحقق المكون من 6 أرقام');
            return;
        }
        setTotpError('');
        setIsLoading(true);
        try {
            const response = await api.post('/auth/verify-totp', { email, code: totpCode });
            const { data } = response;
            setTotpSuccess(translations[data.message] || data.message || 'تم التحقق من رمز التحقق بنجاح');
            login(data.user); // Update auth context
            setTimeout(() => {
                setStep(3);
                setTimeout(() => {
                    navigate('/dashboard'); // Use navigate for routing
                }, 2000);
            }, 1500);
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.message || 'حدث خطأ في الاتصال بالخادم';
            setTotpError(translations[errorMessage] || errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendTimer === 0) {
            try {
                setTotpError('');
                const { data } = await api.post('/auth/request-totp', { email });
                setTotpSuccess(translations[data.message] || data.message || 'تم إعادة إرسال رمز التحقق بنجاح');
                setResendTimer(90);
                setCountdownTimer(90);
            } catch (error) {
                const errorMessage = error.response?.data?.error || error.message || 'حدث خطأ في الاتصال بالخادم';
                setTotpError(handleCooldownMessage(errorMessage));
            }
        }
    };

    const handleCodeChange = (e, index) => {
        const { value } = e.target;
        if (value.length <= 1 && /^\d*$/.test(value)) {
            const newCode = [...code];
            newCode[index] = value;
            setCode(newCode);

            if (value && index < 5) {
                codeInputsRef.current[index + 1].focus();
            }

            if (newCode.every(c => c.length === 1)) {
                handleTotpSubmit(new Event('submit', { cancelable: true }));
            }
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            codeInputsRef.current[index - 1].focus();
        }
    };

    const isValidEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleCooldownMessage = (message) => {
        if (message.includes('Please wait') && message.includes('seconds')) {
            const secondsMatch = message.match(/\d+/); // Extract numbers from the string
            if (secondsMatch) {
                return `يرجى الانتظار ${secondsMatch[0]} ثانية قبل طلب رمز جديد`;
            }
        }
        return translations[message] || message || 'حدث خطأ غير متوقع';
    };

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-gray-50 font-inter" dir="rtl">
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <Shield className="text-indigo-600 w-8 h-8" />
                            <span className="ml-2 text-xl font-bold text-gray-900">OnePass</span>
                        </div>
                        <div className="hidden md:flex md:items-center md:space-x-4">
                            <a href="/info" className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900">الرئيسية</a>
                            <a href="/info/how-it-works" className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900">كيف تعمل</a>
                            <a href="/docs/overview" className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900">المطورون</a>
                        </div>
                        <div className="flex items-center">
                            <a href="/register" className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-indigo-600 to-purple-500 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                                إنشاء حساب
                            </a>
                        </div>
                    </div>
                </div>
            </header>

            <main className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 login-container">
                <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-xl">
                    {step === 1 && (
                        <div className="animate-fade-in">
                            <div className="flex justify-center">
                                <Shield className="text-indigo-600 w-12 h-12" />
                            </div>
                            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">تسجيل الدخول إلى حسابك</h2>
                            <p className="mt-2 text-center text-sm text-gray-600">
                                أو <a href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">إنشاء حساب جديد</a>
                            </p>
                            <form className="mt-8 space-y-6" onSubmit={handleEmailSubmit}>
                                <div className="rounded-md shadow-sm -space-y-px">
                                    <div>
                                        <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                                        <input
                                            id="email-address"
                                            name="email"
                                            type="email"
                                            autoComplete="email"
                                            required
                                            className="login-form__input"
                                            placeholder="example@OnePass.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <button
                                        type="submit"
                                        className={`login-form__button ${isLoading ? 'login-form__button--loading' : ''}`}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <span className="absolute right-0 inset-y-0 flex items-center pr-3">
                                                    <Loader className="h-5 w-5 animate-spin" />
                                                </span>
                                                جاري المعالجة...
                                            </>
                                        ) : (
                                            <>
                                                <span className="absolute right-0 inset-y-0 flex items-center pr-3">
                                                    <ArrowLeft className="h-5 w-5 text-indigo-300 group-hover:text-indigo-200" />
                                                </span>
                                                إرسال رمز التحقق
                                            </>
                                        )}
                                    </button>
                                </div>
                                {emailError && <div className={`login-form__${emailError.includes('تم إرسال') ? 'success' : 'error'}`}>{emailError}</div>}
                            </form>
                            <div className="relative mt-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-300"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white text-gray-500">أو الدخول عبر</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-4">
                                <a href="http://localhost:3001/api/auth/github" className="w-full inline-flex justify-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors" rel="noopener noreferrer">
                                    <Github className="h-5 w-5" />
                                </a>
                                <a href="http://localhost:3001/api/auth/google" className="w-full inline-flex justify-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors" rel="noopener noreferrer">
                                    {/* Google icon is not in lucide-react, using text or a generic icon is an option */}
                                    <span className="font-bold">G</span>
                                </a>
                            </div>
                        </div>
                    )}
                    {step === 2 && (
                        <div className="animate-fade-in">
                            <div className="flex justify-center">
                                <Key className="text-indigo-600 w-12 h-12" />
                            </div>
                            <h2 className="mt-6 text-center text-2xl font-extrabold text-gray-900">التحقق بخطوتين</h2>
                            <p className="mt-2 text-center text-sm text-gray-600">
                                تم إرسال رمز التحقق المكون من 6 أرقام إلى <span className="font-medium text-indigo-600">{email}</span>
                            </p>
                            <form className="mt-6 space-y-6" onSubmit={handleTotpSubmit}>
                                <div className="flex justify-between space-x-2">
                                    {code.map((digit, index) => (
                                        <input
                                            key={index}
                                            id={`code-${index}`}
                                            type="text"
                                            maxLength="1"
                                            className="code-input w-12 h-12 text-center text-xl border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            ref={el => codeInputsRef.current[index] = el}
                                            value={digit}
                                            onChange={(e) => handleCodeChange(e, index)}
                                            onKeyDown={(e) => handleKeyDown(e, index)}
                                            dir="ltr"
                                        />
                                    ))}
                                </div>
                                <div className="text-center text-sm text-gray-500 mt-4">
                                    <div className="h-1 w-full bg-gray-200 rounded-full mb-1">
                                        <div className="progress-bar h-1 bg-indigo-600 rounded-full" style={{ width: `${(countdownTimer / 90) * 100}%` }}></div>
                                    </div>
                                    <p>ينتهي الرمز خلال <span>{formatTime(countdownTimer)}</span></p>
                                </div>
                                <div>
                                    <button
                                        type="submit"
                                        className={`login-form__button ${isLoading ? 'login-form__button--loading' : ''}`}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <span className="absolute right-0 inset-y-0 flex items-center pr-3">
                                                    <Loader className="h-5 w-5 animate-spin" />
                                                </span>
                                                جاري المعالجة...
                                            </>
                                        ) : (
                                            <>
                                                <span className="absolute right-0 inset-y-0 flex items-center pr-3">
                                                    <Check className="h-5 w-5 text-indigo-300 group-hover:text-indigo-200" />
                                                </span>
                                                تأكيد الرمز
                                            </>
                                        )}
                                    </button>
                                </div>
                                {totpError && <div className="login-form__error">{totpError}</div>}
                                {totpSuccess && <div className="login-form__success">{totpSuccess}</div>}
                            </form>
                            <div className="text-center mt-4">
                                <button
                                    onClick={handleResend}
                                    className={`text-sm ${resendTimer === 0 ? 'text-indigo-600 hover:text-indigo-500' : 'text-gray-400'} transition-colors`}
                                    disabled={resendTimer !== 0}
                                >
                                    إعادة إرسال الرمز {resendTimer > 0 && `(${resendTimer})`}
                                </button>
                            </div>
                            <div className="text-center mt-4">
                                <button onClick={() => setStep(1)} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                                    <ArrowRight className="h-4 w-4 inline ml-1" />
                                    العودة لإدخال البريد الإلكتروني
                                </button>
                            </div>
                        </div>
                    )}
                    {step === 3 && (
                        <div className="animate-fade-in">
                            <div className="flex justify-center">
                                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                                    <Check className="text-green-600 w-8 h-8" />
                                </div>
                            </div>
                            <h2 className="mt-6 text-center text-2xl font-extrabold text-gray-900">تم تسجيل الدخول بنجاح!</h2>
                            <p className="mt-2 text-center text-sm text-gray-600">يتم توجيهك إلى لوحة التحكم...</p>
                            <div className="mt-6">
                                <div className="h-1.5 w-full bg-gray-200 rounded-full">
                                    <div className="h-1.5 bg-indigo-600 rounded-full animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <footer className="bg-white border-t border-gray-200 mt-12">
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <p className="text-sm text-gray-500 mb-4 md:mb-0">© 2025 OnePass. جميع الحقوق محفوظة.</p>
                        <div className="flex space-x-6">
                            <a href="/info/privacy-policy" className="text-sm text-gray-500 hover:text-gray-900">سياسة الخصوصية</a>
                            <a href="/info/terms-of-service" className="text-sm text-gray-500 hover:text-gray-900">الشروط والأحكام</a>
                            <a href="/support/contact-support" className="text-sm text-gray-500 hover:text-gray-900">اتصل بنا</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LoginPage;