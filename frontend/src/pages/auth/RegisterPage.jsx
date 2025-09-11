import React, { useState, useEffect } from 'react';
import './RegisterPage.css';
import { Link } from 'react-router-dom';
import { Shield, Mail, UserPlus, Check, Loader } from 'lucide-react';
import api from '../../services/api';

const translations = {
    "Email is already registered": "هذا البريد الإلكتروني مسجل بالفعل. يمكنك تسجيل الدخول مباشرة.",
    "Server error during registration": "حدث خطأ في الخادم أثناء التسجيل. يرجى المحاولة مرة أخرى.",
};

const RegisterPage = () => {
    const [email, setEmail] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [countdownValue, setCountdownValue] = useState(60);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isEmailValid, setIsEmailValid] = useState(false);

    useEffect(() => {
        let countdownInterval;
        if (isSuccess && countdownValue > 0) {
            countdownInterval = setInterval(() => {
                setCountdownValue(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownInterval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(countdownInterval);
    }, [isSuccess, countdownValue]);

    const isValidEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleEmailChange = (e) => {
        const value = e.target.value;
        setEmail(value);
        setIsEmailValid(isValidEmail(value));
        if (isValidEmail(value)) {
            setErrorMessage('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isValidEmail(email)) {
            setErrorMessage('يرجى إدخال بريد إلكتروني صحيح');
            return;
        }
        setIsLoading(true);
        try {
            const response = await api.post('/auth/register', { email });
            if (response.status === 201) {
                setSuccessMessage('تم إرسال رابط التحقق إلى بريدك الإلكتروني');
                setIsSuccess(true);
                setCountdownValue(60);
            } else {
                throw new Error(response.data.error || 'حدث خطأ أثناء التسجيل');
            }
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.message || 'فشل الاتصال بالخادم';
            setErrorMessage(translations[errorMessage] || errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        if (countdownValue === 0) {
            try {
                const response = await api.post('/auth/send-verification-email', { email });
                if (response.status === 200) {
                    setSuccessMessage('تم إعادة إرسال الرابط بنجاح.');
                    setCountdownValue(60);
                } else {
                    throw new Error(response.data.error || 'فشل إعادة الإرسال');
                }
            } catch (error) {
                const errorMessage = error.response?.data?.error || error.message || 'حدث خطأ أثناء إعادة إرسال البريد';
                setErrorMessage(translations[errorMessage] || errorMessage);
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 font-inter" dir="rtl">
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center">
                            <Shield className="text-indigo-600 w-8 h-8" />
                            <span className="ml-2 text-xl font-bold text-gray-900">OnePass</span>
                        </div>
                        <div className="flex items-center">
                            <Link to="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors">
                                تسجيل الدخول
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <main className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 register-container">
                <div className="max-w-4xl w-full flex flex-col lg:flex-row items-center lg:items-start gap-10">
                    <div className="w-full lg:w-1/2">
                        {errorMessage && <div className="alert alert--error fade-in">{errorMessage}</div>}
                        {successMessage && <div className="alert alert--success fade-in">{successMessage}</div>}
                        {!isSuccess ? (
                            <div className="fade-in">
                                <div className="register-form">
                                    <div className="text-center mb-2">
                                        <Shield className="text-indigo-600 w-12 h-12 mx-auto" />
                                    </div>
                                    <h1 className="register-form__title">ابدأ رحلتك مع OnePass</h1>
                                    <p className="register-form__subtitle">
                                        سجّل بإيميلك فقط واحصل على بريد وهمي يحمي خصوصيتك.
                                    </p>
                                    <form className="space-y-6" onSubmit={handleSubmit}>
                                        <div className="form-group">
                                            <label htmlFor="email" className="form-group__label">البريد الإلكتروني</label>
                                            <div className="relative">
                                                <input
                                                    id="email"
                                                    name="email"
                                                    type="email"
                                                    autoComplete="email"
                                                    required
                                                    className={`form-group__input ${isEmailValid ? 'form-group__input--success' : email && !isEmailValid ? 'form-group__input--error' : ''}`}
                                                    placeholder="example@email.com"
                                                    value={email}
                                                    onChange={handleEmailChange}
                                                    dir="ltr"
                                                />
                                                <div className="form-group__icon">
                                                    <Mail className="h-5 w-5" />
                                                </div>
                                            </div>
                                            {email && !isEmailValid && <p className="form-group__error">يرجى إدخال بريد إلكتروني صحيح</p>}
                                        </div>
                                        <div>
                                            <button type="submit" className={`btn btn--primary ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={isLoading || !isEmailValid}>
                                                {isLoading ? (
                                                    <>
                                                        <Loader className="h-5 w-5 animate-spin" />
                                                        <span className="mr-2">جاري المعالجة...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="btn__icon">
                                                            <UserPlus className="h-5 w-5" />
                                                        </span>
                                                        <span>سجّل الآن</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        ) : (
                            <div className="success-state fade-in">
                                <div className="success-state__icon"><Check className="text-green-600 w-8 h-8" /></div>
                                <h2 className="success-state__title">تحقق من بريدك الإلكتروني</h2>
                                <p className="success-state__message">
                                    تم إرسال رابط التحقق إلى بريدك الإلكتروني. يرجى الضغط على الرابط لتفعيل حسابك.
                                </p>
                                <div className="email-display">
                                    <p className="email-display__text">{email}</p>
                                </div>
                                <button
                                    className={`btn btn--secondary ${countdownValue === 0 ? '' : 'opacity-50 cursor-not-allowed'}`}
                                    onClick={handleResend}
                                    disabled={countdownValue !== 0}
                                >
                                    <span>إعادة إرسال الرابط</span>
                                    {countdownValue > 0 && <span>({countdownValue})</span>}
                                </button>
                                <p className="text-sm text-gray-500 mt-4">لم تستلم البريد؟ تأكد من مجلد الرسائل غير المرغوب فيها</p>
                            </div>
                        )}
                    </div>
                    <div className="w-full lg:w-1/2">
                        <div className="space-y-6 slide-in">
                            <div className="feature-card bg-white p-6 rounded-xl shadow-md transition-all duration-300">
                                <div className="flex items-start mb-4">
                                    <div className="flex-shrink-0">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                            <Shield className="text-indigo-600 w-5 h-5" />
                                        </div>
                                    </div>
                                    <div className="mr-3">
                                        <h3 className="text-lg font-semibold text-gray-900">لا تحتاج إلى كلمة مرور</h3>
                                        <p className="text-gray-600 mt-1">تسجيل دخول آمن بدون تذكر كلمات مرور معقدة</p>
                                    </div>
                                </div>
                            </div>
                            <div className="feature-card bg-white p-6 rounded-xl shadow-md transition-all duration-300">
                                <div className="flex items-start mb-4">
                                    <div className="flex-shrink-0">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                            <Mail className="text-purple-600 w-5 h-5" />
                                        </div>
                                    </div>
                                    <div className="mr-3">
                                        <h3 className="text-lg font-semibold text-gray-900">بريد وهمي يحميك</h3>
                                        <p className="text-gray-600 mt-1">حافظ على خصوصيتك مع عناوين بريد مؤقتة</p>
                                    </div>
                                </div>
                            </div>
                            <div className="feature-card bg-white p-6 rounded-xl shadow-md transition-all duration-300">
                                <div className="flex items-start mb-4">
                                    <div className="flex-shrink-0">
                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                            <UserPlus className="text-green-600 w-5 h-5" />
                                        </div>
                                    </div>
                                    <div className="mr-3">
                                        <h3 className="text-lg font-semibold text-gray-900">تسجيل دخول سريع في كل مكان</h3>
                                        <p className="text-gray-600 mt-1">الدخول الفوري إلى حسابك من أي جهاز</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="footer">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="footer__content">
                        <div className="footer__copyright">
                            <Shield className="text-indigo-600 w-5 h-5" />
                            <span className="mr-2 text-sm">© 2025 OnePass. جميع الحقوق محفوظة.</span>
                        </div>
                        <div className="footer__links">
                            <a href="#" className="footer__link">سياسة الخصوصية</a>
                            <a href="#" className="footer__link">شروط الخدمة</a>
                            <a href="#" className="footer__link">اتصل بنا</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default RegisterPage;