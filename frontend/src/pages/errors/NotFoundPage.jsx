import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, AlertTriangle, Home, ArrowRight, HelpCircle, Mail } from 'lucide-react';

const NotFoundPage = () => {
    const navigate = useNavigate();

    // The CSS classes are based on the provided 404.html and should work with Tailwind CSS.
    // The fade-in animation is assumed to be defined in a global CSS file like index.css or similar.
    return (
        <div className="min-h-screen flex flex-col bg-gray-50 font-inter" dir="rtl">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center">
                            <Link to="/" className="flex-shrink-0 flex items-center">
                                <Shield className="text-indigo-600 w-8 h-8" />
                                <span className="ml-2 text-xl font-bold text-gray-900">OnePass</span>
                            </Link>
                        </div>
                        <div className="flex items-center">
                            <Link to="/" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors">
                                العودة للرئيسية
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl w-full space-y-8 text-center">
                    <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                        <AlertTriangle className="text-white w-12 h-12" />
                    </div>
                    
                    <h1 className="text-9xl font-bold text-gray-900 opacity-10">404</h1>
                    
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">الصفحة غير موجودة</h2>
                    
                    <p className="text-xl text-gray-600 mb-8 max-w-md mx-auto">
                        عذراً، لم نتمكن من العثور على الصفحة التي تبحث عنها.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 sm:space-x-reverse justify-center">
                        <Link to="/" className="btn-primary px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center justify-center">
                            <Home className="w-5 h-5 ml-2" />
                            العودة للرئيسية
                        </Link>
                        <button onClick={() => navigate(-1)} className="px-6 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 inline-flex items-center justify-center">
                            <ArrowRight className="w-5 h-5 ml-2" />
                            الرجوع للخلف
                        </button>
                    </div>
                    
                    <div className="mt-12 pt-8">
                        <div className="bg-white rounded-2xl shadow-md p-6 max-w-md mx-auto">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">هل تحتاج مساعدة؟</h3>
                            <p className="text-gray-600 mb-4">تصفح هذه الصفحات المفيدة:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Link to="/faq" className="flex items-center text-indigo-600 hover:text-indigo-800 transition-colors">
                                    <HelpCircle className="w-4 h-4 ml-2" />
                                    الأسئلة الشائعة
                                </Link>
                                <Link to="/contact" className="flex items-center text-indigo-600 hover:text-indigo-800 transition-colors">
                                    <Mail className="w-4 h-4 ml-2" />
                                    اتصل بنا
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default NotFoundPage;