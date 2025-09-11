import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Mail, Key, LogOut } from 'lucide-react';

const DashboardPage = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Shield className="text-indigo-600 w-8 h-8" />
              <span className="ml-2 text-xl font-bold text-gray-900">OnePass</span>
            </div>
            <div className="flex items-center">
              <span className="mr-4 text-gray-700">{user?.email}</span>
              <button
                onClick={logout}
                className="flex items-center text-sm text-red-600 hover:text-red-800"
              >
                <LogOut className="w-4 h-4 ml-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to your Dashboard</h1>
        <p className="text-gray-600">This is a protected area. Only logged-in users can see this.</p>
        
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <Mail className="text-blue-600 w-6 h-6" />
                    </div>
                    <div className="mr-3">
                        <p className="text-sm text-gray-600">Your Email</p>
                        <p className="text-lg font-bold text-gray-900">{user?.email}</p>
                    </div>
                </div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                        <Key className="text-green-600 w-6 h-6" />
                    </div>
                    <div className="mr-3">
                        <p className="text-sm text-gray-600">User ID</p>
                        <p className="text-lg font-bold text-gray-900">{user?.id}</p>
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
