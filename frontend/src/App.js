import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import DashboardPage from './pages/account/DashboardPage.jsx';
import ApiKeysPage from './pages/account/management/ApiKeysPage.jsx';
import ProtectedRoute from './components/ProtectedRoute';
// مثال على استيراد دالة من مكتبتك الخاصة
// import { capitalize } from './lib/bariqa';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected Routes */}
      <Route 
        path="/dashboard" 
        element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} 
      />
      <Route 
        path="/api-keys" 
        element={<ProtectedRoute><ApiKeysPage /></ProtectedRoute>} 
      />
    </Routes>
  );
}

export default App;
