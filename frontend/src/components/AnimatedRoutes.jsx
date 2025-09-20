import React, { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

// استيراد الصفحات والمكونات
import ProtectedRoute from './ProtectedRoute';
import PageLoader from './PageLoader'; // استيراد مكون التحميل

// --- تحويل استيراد الصفحات إلى ديناميكي (Lazy Loading) ---
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage.jsx'));
const DashboardPage = lazy(() => import('../pages/account/DashboardPage.jsx'));
const SettingsPage = lazy(() => import('../pages/account/profile-settings.jsx'));
const ApiKeysPage = lazy(() => import('../pages/account/management/ApiKeysPage.jsx'));
const NotFoundPage = lazy(() => import('../pages/errors/NotFoundPage.jsx'));
const PricingPage = lazy(() => import('../pages/info/PricingPage.jsx'));
const DocumentationPage = lazy(() => import('../pages/docs/Documentation.jsx')); // <-- إضافة صفحة التوثيق


// تعريف متغيرات الحركة
const pageVariants = {
initial: {
  opacity: 0,
  y: 20, // تبدأ الصفحة من الأسفل قليلاً
},
in: {
  opacity: 1,
  y: 0, // تتحرك إلى مكانها الطبيعي
},
  out: {
    opacity: 0,
    y: -20, // تخرج الصفحة إلى الأعلى قليلاً
  },
};

// تعريف خصائص الانتقال
const pageTransition = {
  type: 'tween',
  ease: 'anticipate', // تأثير حركة لطيف
  duration: 0.4,
};

// مكون لتغليف كل صفحة بالحركة
const PageLayout = ({ children }) => (
  <motion.div
    initial="initial"
    animate="in"
    exit="out"
    variants={pageVariants}
    transition={pageTransition}
  >
    {children}
  </motion.div>
);

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <Suspense fallback={<PageLoader />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Public Routes */}
          <Route path="/" element={<PageLayout><LoginPage /></PageLayout>} />
          <Route path="/login" element={<PageLayout><LoginPage /></PageLayout>} />
          <Route path="/register" element={<PageLayout><RegisterPage /></PageLayout>} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><PageLayout><DashboardPage /></PageLayout></ProtectedRoute>} />
          <Route path="/api-keys" element={<ProtectedRoute><PageLayout><ApiKeysPage /></PageLayout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><PageLayout><SettingsPage /></PageLayout></ProtectedRoute>} />
          <Route path="/pricing" element={<PageLayout><PricingPage /></PageLayout>} />
          <Route path="/docs" element={<PageLayout><DocumentationPage /></PageLayout>} /> {/* <-- إضافة المسار الجديد */}
          

          {/* Catch-all Route */}
          <Route path="*" element={<PageLayout><NotFoundPage /></PageLayout>} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
};

export default AnimatedRoutes;