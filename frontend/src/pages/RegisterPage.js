import React, { useState } from 'react';
import { Shield, Mail, UserPlus, Check, AlertCircle } from 'lucide-react';
import api from '../services/api';

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const translations = {
    "Email is already registered": "هذا البريد الإلكتروني مسجل بالفعل. يمكنك تسجيل الدخول مباشرة.",
    "Server error during registration": "حدث خطأ في الخادم أثناء التسجيل. يرجى المحاولة مرة أخرى.",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await api.post('/auth/register', { email });
      setSuccess(response.data.message || 'تم إرسال رابط التحقق إلى بريدك الإلكتروني');
      setIsSubmitted(true);
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'An unexpected error occurred';
      setError(translations[errorMessage] || errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full">
        {error && (
          <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        )}
        {success && !isSubmitted && (
           <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-lg relative mb-4 flex items-center">
            <Check className="w-5 h-5 mr-2" />
            <span>{success}</span>
          </div>
        )}

        {!isSubmitted ? (
          <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="text-center mb-4">
              <Shield className="text-indigo-600 w-12 h-12 mx-auto" />
            </div>
            <h1 className="text-2xl font-bold text-center text-gray-900">
              ابدأ رحلتك مع OnePass
            </h1>
            <p className="text-center text-gray-600 mt-2 mb-6">
              سجّل بإيميلك فقط واحصل على بريد وهمي يحمي خصوصيتك.
            </p>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="example@email.com"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <UserPlus className="h-5 w-5 mr-2" />
                      سجّل الآن
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-xl shadow-lg text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              تحقق من بريدك الإلكتروني
            </h2>
            <p className="text-gray-600 mt-2">
              تم إرسال رابط التحقق إلى <span className="font-semibold text-indigo-600">{email}</span>.
            </p>
            <p className="text-gray-600 mt-1">
              يرجى الضغط على الرابط لتفعيل حسابك.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterPage;
