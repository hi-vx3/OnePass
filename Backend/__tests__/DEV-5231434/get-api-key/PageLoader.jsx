import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Smartphone, Monitor, Server, Wifi, WifiOff } from 'lucide-react';

const Loader = () => (
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

const DeviceIcon = ({ os }) => {
  if (os?.toLowerCase().includes('windows') || os?.toLowerCase().includes('mac')) {
    return <Monitor className="w-6 h-6 text-gray-500" />;
  }
  if (os?.toLowerCase().includes('android') || os?.toLowerCase().includes('ios')) {
    return <Smartphone className="w-6 h-6 text-gray-500" />;
  }
  return <Server className="w-6 h-6 text-gray-500" />;
};

const ActiveDevicesPage = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- WebSocket Logic ---
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001'); // تأكد من أن العنوان والمنفذ صحيحان

    ws.onopen = () => console.log('WebSocket Connected');
    ws.onclose = () => console.log('WebSocket Disconnected');

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Received WS message:', message);

      setDevices(currentDevices => {
        switch (message.type) {
          case 'session_online':
            return currentDevices.map(d => d.id === message.payload.sessionId ? { ...d, isOnline: true } : d);
          case 'session_offline':
            return currentDevices.map(d => d.id === message.payload.sessionId ? { ...d, isOnline: false } : d);
          case 'session_terminated':
            return currentDevices.filter(d => d.id !== message.payload.sessionId);
          default:
            return currentDevices;
        }
      });
    };

    // Cleanup on component unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);


  // --- Initial Data Fetch ---
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        // ملاحظة: يجب التأكد من وجود توكن المصادقة
        const response = await fetch('/api/sessions/active', {
          headers: {
            // 'Authorization': `Bearer ${token}`
          },
        });
        if (!response.ok) {
          throw new Error('فشل في جلب الأجهزة النشطة');
        }
        const data = await response.json();
        setDevices(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, []);

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">{error}</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">الأجهزة النشطة</h1>
      {devices.length === 0 ? (
        <p>لا توجد أجهزة نشطة حاليًا.</p>
      ) : (
        devices.map((device) => (
          <div key={device.id} className="flex items-center p-4 border-b">
            <DeviceIcon os={device.os} />
            <div className="ml-4 flex-grow">
              <p className="font-semibold">{device.os} - {device.browser}</p>
              <p className="text-sm text-gray-500">IP: {device.ip} {device.isCurrent && <span className="text-green-500">(الجهاز الحالي)</span>}</p>
            </div>
            <div className="flex items-center text-sm">
              {device.isOnline ? (
                <><Wifi className="w-4 h-4 text-green-500 mr-1" /> <span className="text-green-600">متصل</span></>
              ) : (
                <><WifiOff className="w-4 h-4 text-gray-400 mr-1" /> <span className="text-gray-500">خامل</span></>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ActiveDevicesPage;