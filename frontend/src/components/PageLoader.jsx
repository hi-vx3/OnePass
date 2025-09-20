import React from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

const PageLoader = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[100]"
    >
      <div className="relative flex items-center justify-center h-24 w-24">
        <div className="absolute h-full w-full bg-indigo-100 rounded-full animate-ping opacity-50"></div>
        <Shield className="text-indigo-600 w-12 h-12" />
      </div>
      <p className="mt-4 text-lg font-semibold text-gray-700">جاري التحميل...</p>
    </motion.div>
  );
};

export default PageLoader;