import React, { useState, useEffect } from 'react';
import feather from 'feather-icons';
import './styles.css';
import { Link } from 'react-router-dom';

const SectionCard = ({ children, id, title, icon, isCollapsible = true }) => {
  // On desktop, it's always expanded. On mobile, it's collapsible.
  const [isExpanded, setIsExpanded] = useState(window.innerWidth >= 768);

  const handleToggle = () => {
    if (isCollapsible && window.innerWidth < 768) {
      setIsExpanded(!isExpanded);
    }
  };

  useEffect(() => {
    feather.replace();
  });

  return (
    <section id={id} className="mb-12" >
      <h2 className="text-2xl font-bold mb-6 flex items-center">
        <i data-feather={icon} className="ml-2 text-indigo-600"></i>
        {title}
      </h2>
      <div className="mobile-collapsible bg-white rounded-xl shadow-md p-6 section-card" onClick={handleToggle}>
        {children}
        <div className={`mobile-content ${isExpanded ? 'expanded' : ''}`}>
            {children}
        </div>
      </div>
    </section>
  );
};

const CodeBlock = ({ children }) => (
  <pre className="code-block">{children}</pre>
);

const DocumentationPage = () => {
  useEffect(() => {
    // Initial icon replacement
    feather.replace();

    // The SDK script might load after the component mounts.
    // We'll use a small delay and check to ensure it's ready.
    const renderButtons = () => {
      if (window.onepass && window.onepass.renderButton) {
        const demoClientId = 'DEMO_CLIENT_ID';
        window.onepass.renderButton('#button-example-1', { clientId: demoClientId, theme: 'filled', shape: 'rect' });
        window.onepass.renderButton('#button-example-2', { clientId: demoClientId, theme: 'outline', shape: 'rect' });
        window.onepass.renderButton('#button-example-3', { clientId: demoClientId, theme: 'filled', shape: 'circle' });
        window.onepass.renderButton('#button-example-4', { clientId: demoClientId, theme: 'outline', shape: 'circle' });
        window.onepass.renderButton('#button-example-large', { clientId: demoClientId, size: 'large', text: 'زر كبير' });
        window.onepass.renderButton('#button-example-medium', { clientId: demoClientId, size: 'medium', text: 'زر متوسط' });
        window.onepass.renderButton('#button-example-small', { clientId: demoClientId, size: 'small', text: 'زر صغير' });
      }
    };
    setTimeout(renderButtons, 100); // A small delay to ensure the SDK is loaded
  }, []);

  return (
    <>
      <main className="container mx-auto px-4 py-8" dir="rtl">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              توثيق واجهة برمجة تطبيقات OnePass
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              دليل شامل للمطورين لاستخدام واجهة API للتسجيل بالبريد الوهمي في تطبيقاتهم
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a href="#buttons" className="px-5 py-2.5 rounded-lg text-white brand-gradient hover:opacity-90 focus:outline-none focus:brand-ring font-medium flex items-center">
                <i data-feather="layers" className="ml-2 w-4 h-4"></i>
                أزرار جاهزة
              </a>
              <a href="#sdk-usage" className="px-5 py-2.5 rounded-lg border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white focus:outline-none focus:brand-ring font-medium flex items-center">
                <i data-feather="code" className="ml-2 w-4 h-4"></i>
                استخدم SDK
              </a>
            </div>
          </div>

          <SectionCard id="overview" title="نظرة عامة" icon="home">
            <p className="text-gray-700 mb-6 leading-relaxed">
              واجهة برمجة تطبيقات OnePass تمكنك من إضافة نظام تسجيل دخول باستخدام البريد الوهمي إلى تطبيقك. 
              الخدمة تعمل بالكامل على VPS واحد وتوفر تجربة مستخدم سلسة وآمنة.
            </p>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-indigo-50 p-5 rounded-lg">
                <h3 className="font-semibold text-indigo-800 mb-3 flex items-center">
                  <i data-feather="star" className="ml-2 w-5 h-5"></i>
                  المميزات الرئيسية
                </h3>
                <ul className="space-y-2 text-indigo-700">
                  <li className="flex items-start">
                    <i data-feather="check-circle" className="ml-2 w-4 h-4 mt-0.5 text-indigo-600"></i>
                    تسجيل دخول بدون كلمة مرور
                  </li>
                  <li className="flex items-start">
                    <i data-feather="check-circle" className="ml-2 w-4 h-4 mt-0.5 text-indigo-600"></i>
                    بريد وهمي ثابت لكل مستخدم
                  </li>
                  <li className="flex items-start">
                    <i data-feather="check-circle" className="ml-2 w-4 h-4 mt-0.5 text-indigo-600"></i>
                    واجهة REST API كاملة
                  </li>
                  <li className="flex items-start">
                    <i data-feather="check-circle" className="ml-2 w-4 h-4 mt-0.5 text-indigo-600"></i>
                    أمان عالي باستخدام JWT
                  </li>
                </ul>
              </div>
              <div className="bg-green-50 p-5 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-3 flex items-center">
                  <i data-feather="zap" className="ml-2 w-5 h-5"></i>
                  البدء السريع
                </h3>
                <ul className="space-y-2 text-green-700">
                  <li className="flex items-start">
                    <i data-feather="key" className="ml-2 w-4 h-4 mt-0.5 text-green-600"></i>
                    احصل على مفتاح API
                  </li>
                  <li className="flex items-start">
                    <i data-feather="code" className="ml-2 w-4 h-4 mt-0.5 text-green-600"></i>
                    أضف SDK إلى مشروعك
                  </li>
                  <li className="flex items-start">
                    <i data-feather="settings" className="ml-2 w-4 h-4 mt-0.5 text-green-600"></i>
                    اضبط الإعدادات
                  </li>
                  <li className="flex items-start">
                    <i data-feather="user-plus" className="ml-2 w-4 h-4 mt-0.5 text-green-600"></i>
                    ابدأ بتسجيل المستخدمين
                  </li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="buttons" title="أزرار التسجيل" icon="layers" isCollapsible={false}>
            <h3 className="text-xl font-semibold mb-4 text-gray-800">أمثلة على الأزرار</h3>
            <p className="text-gray-600 mb-5">يمكنك الآن إنشاء أزرار متنوعة بسهولة باستخدام دالة `renderButton` الجديدة في الـ SDK.</p>
            <div className="flex flex-wrap gap-4 items-center mb-6">
              <div id="button-example-1"></div>
              <div id="button-example-2"></div>
              <div id="button-example-3"></div>
              <div id="button-example-4"></div>
            </div>
            <div className="flex flex-wrap gap-4 items-center mb-6">
              <div id="button-example-large"></div>
              <div id="button-example-medium"></div>
              <div id="button-example-small"></div>
            </div>
            <p className="text-gray-600 mb-5 mt-8">
              أصبح الآن كل ما تحتاجه هو عنصر `div` في صفحتك، والـ SDK سيتولى الباقي.
            </p>
            <p className="text-gray-600 mb-5">
              انتقل إلى قسم <a href="#sdk-usage" className="text-indigo-600 hover:underline">استخدام SDK</a> لمعرفة كيفية تنفيذ ذلك.
            </p>
          </SectionCard>

          <SectionCard id="authentication" title="نظام المصادقة" icon="key" >
            <p className="text-gray-700 mb-6 leading-relaxed">
              تستخدم OnePass نظام مصادقة مزدوج باستخدام JWT tokens لتوفير أقصى درجات الأمان وسهولة الاستخدام.
            </p>
            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 text-gray-800">Access Token</h3>
                <p className="text-sm text-gray-600 mb-2">توكن قصير الأمد (عادة 15 دقيقة)، يُرسل مع كل طلب في رأس HTTP للتحقق من هوية المستخدم:</p>
                <CodeBlock>Authorization: Bearer YOUR_ACCESS_TOKEN</CodeBlock>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 text-gray-800">Refresh Token</h3>
                <p className="text-sm text-gray-600 mb-2">توكن طويل الأمد (عادة 7 أيام)، يُخزن في HttpOnly cookie ويُستخدم لتجديد Access Token عند انتهاء صلاحيته:</p>
                <CodeBlock>Cookie: bm_rt=YOUR_REFRESH_TOKEN</CodeBlock>
              </div>
            </div>
            <div className="mobile-content">
              <div className="bg-amber-50 p-4 rounded-lg">
                <h3 className="font-semibold text-amber-800 mb-2">ملاحظات أمنية مهمة</h3>
                <ul className="space-y-2 text-amber-700 text-sm">
                  <li className="flex items-start">
                    <i data-feather="alert-circle" className="ml-2 w-4 h-4 mt-0.5 text-amber-600"></i>
                    احفظ مفتاح API الخاص بك في بيئة آمنة
                  </li>
                  <li className="flex items-start">
                    <i data-feather="alert-circle" className="ml-2 w-4 h-4 mt-0.5 text-amber-600"></i>
                    استخدم HTTPS دائمًا في الإنتاج
                  </li>
                  <li className="flex items-start">
                    <i data-feather="alert-circle" className="ml-2 w-4 h-4 mt-0.5 text-amber-600"></i>
                    تحقق من صلاحية التوكن قبل كل طلب
                  </li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="endpoints" title="نقاط الوصول الرئيسية" icon="code" >
            <div className="mobile-collapsible bg-white rounded-xl shadow-md p-6 section-card mb-6">
              <div className="flex flex-wrap items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">1. تسجيل المستخدم</h3>
                <span className="text-sm font-medium text-green-600 bg-green-100 px-2.5 py-0.5 rounded-full">POST</span>
              </div>
              <div className="flex items-center mb-4">
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">POST /api/register</span>
                <span className="mr-3 text-sm text-gray-500">إنشاء حساب جديد وإرسال رابط التحقق</span>
              </div>
              <div className="mobile-content">
                <CodeBlock>
{`// Request
{
  "email": "user@example.com"
}

// Response
{
  "status": "ok",
  "data": {
    "message": "verification_sent"
  }
}`}
                </CodeBlock>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2 text-gray-700">معلمات الطلب</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-2">المعلمة</th>
                          <th className="p-2">النوع</th>
                          <th className="p-2">الوصف</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2">email</td>
                          <td className="p-2">String</td>
                          <td className="p-2">البريد الإلكتروني الحقيقي للمستخدم</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 mobile-collapsible bg-white rounded-xl shadow-md p-6 section-card">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">تسجيل الدخول</h3>
              <div className="flex items-center mb-4">
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">POST /api/login</span>
                <span className="mr-3 text-sm text-gray-500">إرسال رابط تسجيل دخول مؤقت</span>
              </div>
              <div className="mobile-content">
                <CodeBlock>
{`// Request
{
  "email": "user@example.com"
}

// Response
{
  "status": "ok",
  "data": {
    "message": "login_link_sent"
  }
}`}
                </CodeBlock>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="sdk-usage" title="SDK للجافاسكريبت" icon="package" >
            <p className="text-gray-700 mb-4 leading-relaxed">
              استخدم الـ SDK الخاص بنا لتبسيط عملية الدمج. اتبع الخطوات التالية:
            </p>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-2">1. أضف الـ SDK إلى صفحتك</h4>
            <CodeBlock>
{`<!-- أضف هذا السطر قبل إغلاق وسم </body> -->
<script id="onepass-sdk-script" src="/sdk/onepass-sdk.js"></script>`}
            </CodeBlock>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-2">2. أضف حاوية للزر في HTML</h4>
            <CodeBlock>
{`<!-- سيتم عرض الزر داخل هذا العنصر -->
<div id="onepass-login-container"></div>`}
            </CodeBlock>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-2">3. قم بتهيئة الـ SDK وعرض الزر</h4>
            <CodeBlock>
{`<script>
  // عرض الزر داخل الحاوية مع دمج المفتاح مباشرة
  onepass.renderButton('#onepass-login-container', {
    clientId: 'YOUR_CLIENT_ID', // استبدل هذا بالمعرف الخاص بك
    scope: 'read:user', // الصلاحيات المطلوبة
    onSuccess: (result) => {
      console.log('تم تسجيل الدخول بنجاح:', result.userInfo);
      // هنا يمكنك توجيه المستخدم أو حفظ بياناته
    },
    onError: (error) => {
      console.error('فشل تسجيل الدخول:', error);
    }
  });
</script>`}
            </CodeBlock>
            <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-2">خيارات تخصيص الزر</h4>
            <p className="text-gray-700 mb-4">
              يمكنك تخصيص شكل الزر عبر الخيارات في دالة `renderButton`:
            </p>
            <CodeBlock>
{`onepass.renderButton('#container', {
  clientId: 'YOUR_CLIENT_ID',
  theme: 'outline', // 'filled' (افتراضي) أو 'outline'
  shape: 'circle',  // 'rect' (افتراضي) أو 'circle'
  size: 'large',    // 'small', 'medium' (افتراضي), 'large'
  text: 'دخول عبر OnePass', // نص مخصص للزر
  // ... باقي الخيارات
});`}
            </CodeBlock>
          </SectionCard>

          <SectionCard id="examples" title="أمثلة عملية" icon="book-open" >
            <div className="mobile-collapsible bg-white rounded-xl shadow-md p-6 section-card mb-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">مثال بتسجيل الدخول في React</h3>
              <div className="mobile-content">
                <CodeBlock>
{`import React, { useEffect } from 'react';

const LoginButton = () => {
  useEffect(() => {
    // تحميل SDK
    const script = document.createElement('script');
    script.src = 'https://OnePass.me/sdk/OnePass.js';
    script.onload = () => {
      window.OnePass.init({
        clientId: process.env.REACT_APP_OnePass_CLIENT_ID,
        redirectUri: \`\${window.location.origin}/callback\`
      });
      
      window.OnePass.on('success', (data) => {
        // حفظ بيانات المستخدم
        localStorage.setItem('user', JSON.stringify(data));
        window.location.href = '/dashboard';
      });
    };
    document.head.appendChild(script);
  }, []);

  const handleLogin = () => {
    window.OnePass.login();
  };

  return (
    <button 
      onClick={handleLogin}
      className="flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white brand-gradient hover:opacity-90 focus:outline-none focus:brand-ring"
    >
      <i data-feather="shield" className="ml-2 w-4 h-4"></i>
      تسجيل الدخول مع OnePass
    </button>
  );
};

export default LoginButton;`}
                </CodeBlock>
              </div>
            </div>
            <div className="mobile-collapsible bg-white rounded-xl shadow-md p-6 section-card">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">مثال بطلب API مباشر</h3>
              <div className="mobile-content">
                <CodeBlock>
{`// تسجيل مستخدم جديد باستخدام fetch
async function registerUser(email) {
  try {
    const response = await fetch('https://api.OnePass.me/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email })
    });
    
    const data = await response.json();
    
    if (data.status === 'ok') {
      console.log('تم إرسال رابط التحقق');
    } else {
      console.error('خطأ في التسجيل:', data.error);
    }
  } catch (error) {
    console.error('خطأ في الاتصال:', error);
  }
}

// استخدام الدالة
registerUser('user@example.com');`}
                </CodeBlock>
              </div>
            </div>
          </SectionCard>

          <section className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 md:p-8 mb-12">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">ابدأ باستخدام OnePass اليوم!</h2>
              <p className="text-gray-700 mb-6">
                انضم إلى الآلاف من المطورين الذين يستخدمون OnePass لتسجيل الدخول الآمن والبريد الوهمي في تطبيقاتهم.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a href="#" className="px-5 py-2.5 rounded-lg text-white brand-gradient hover:opacity-90 focus:outline-none focus:brand-ring font-medium flex items-center">
                  <i data-feather="key" className="ml-2 w-4 h-4"></i>
                  احصل على مفتاح API
                </a>
                <a href="#" className="px-5 py-2.5 rounded-lg border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white focus:outline-none focus:brand-ring font-medium flex items-center">
                  <i data-feather="book-open" className="ml-2 w-4 h-4"></i>
                  استعرض التوثيق الكامل
                </a>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default DocumentationPage;