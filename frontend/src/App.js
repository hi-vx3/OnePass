import React from 'react';
import AnimatedRoutes from './components/AnimatedRoutes';
// استيراد المكونات المشتركة
import Navbar from './components/Navbar';
import Footer from './components/Footer';

function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        {/* AnimatedRoutes يعرض محتوى الصفحة الحالية */}
        <AnimatedRoutes />
      </main>
      <Footer />
    </div>
  );
}

export default App;
