import React from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center">
            <Shield className="text-indigo-600 w-5 h-5" />
            <span className="mr-2 text-sm font-semibold text-gray-800">OnePass</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link to="/contact" className="hover:text-indigo-600 transition-colors">اتصل بنا</Link>
            <Link to="/terms" className="hover:text-indigo-600 transition-colors">شروط الخدمة</Link>
            <Link to="/privacy" className="hover:text-indigo-600 transition-colors">سياسة الخصوصية</Link>
          </div>
          <span className="text-sm text-gray-500">© 2025 جميع الحقوق محفوظة.</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;