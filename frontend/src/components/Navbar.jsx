import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, LogOut, Settings, LayoutDashboard, Menu, X } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-40" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Right Side: Logo and Main Links */}
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <Shield className="text-indigo-600 w-8 h-8" />
              <span className="ml-2 text-xl font-bold text-gray-900">OnePass</span>
            </Link>
            <nav className="hidden md:mr-6 md:flex md:items-center md:space-x-4 md:space-x-reverse" lang="ar">
              <Link to="/dashboard" className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">لوحة التحكم</Link>
              {user && user.isDeveloper && (
                <Link to="/api-keys" className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">المطورون</Link>
              )}
              <Link to="/pricing" className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">الأسعار</Link>
            </nav>
          </div>

          {/* Left Side: User menu, Auth buttons, and Hamburger menu */}
          <div className="flex items-center">
            <div className="hidden md:flex items-center">
              {user ? (
                <div className="relative ml-3">
                  <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="flex items-center text-sm p-1 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name || 'User Avatar'} className="w-full h-full object-cover" />
                      ) : (
                        user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()
                      )}
                    </div>
                  </button>
                  {isProfileMenuOpen && (
                    <div
                      className="origin-top-left absolute left-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
                      onMouseLeave={() => setIsProfileMenuOpen(false)}
                    >
                      <div className="px-4 py-3 border-b border-gray-200">
                        {user.name ? (
                          <><p className="text-xs text-gray-500">مرحباً بك</p><p className="text-sm font-semibold text-indigo-600 truncate">{user.name}</p></>
                        ) : (
                          <p className="text-sm font-medium text-gray-800">مرحباً بك في حسابك</p>
                        )}
                      </div>
                      <Link to="/dashboard" className="flex items-center w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <LayoutDashboard className="w-4 h-4 ml-2" /> <span>لوحة التحكم</span>
                      </Link>
                      <Link to="/settings" className="flex items-center w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        <Settings className="w-4 h-4 ml-2" /> <span>الإعدادات</span>
                      </Link>
                      <button onClick={handleLogout} className="flex items-center w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-gray-100">
                        <LogOut className="w-4 h-4 ml-2" /> <span>تسجيل الخروج</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Link to="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors">
                    تسجيل الدخول
                  </Link>
                  <Link to="/register" className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                    إنشاء حساب
                  </Link>
                </div>
              )}
            </div>
            {/* Hamburger Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link to="/dashboard" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">لوحة التحكم</Link>
            {user && user.isDeveloper && (
              <Link to="/api-keys" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">المطورون</Link>
            )}
            <Link to="/pricing" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">الأسعار</Link>
          </div>
          {user ? (
            <div className="pt-4 pb-3 border-t border-gray-200">
              <div className="flex items-center px-5">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold overflow-hidden">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name || 'User Avatar'} className="w-full h-full object-cover" />
                    ) : (
                      user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>
                <div className="mr-3">
                  <div className="text-base font-medium text-gray-800">{user.name || 'مرحباً بك'}</div>
                  <div className="text-sm font-medium text-gray-500">{!user.name && user.email}</div>
                </div>
              </div>
              <div className="mt-3 px-2 space-y-1">
                <Link to="/settings" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">الإعدادات</Link>
                <button onClick={handleLogout} className="block w-full text-right px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-gray-900 hover:bg-gray-50">
                  تسجيل الخروج
                </button>
              </div>
            </div>
          ) : (
            <div className="px-5 py-3">
              <Link to="/register" className="block w-full text-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                إنشاء حساب
              </Link>
              <p className="mt-3 text-center text-base font-medium text-gray-500">
                لديك حساب بالفعل؟{' '}
                <Link to="/login" className="text-indigo-600 hover:text-indigo-500">
                  تسجيل الدخول
                </Link>
              </p>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;