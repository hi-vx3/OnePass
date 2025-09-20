import React, { useState } from 'react';
import { Check, Star, ArrowLeft, Loader } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './PricingPage.css';

const PricingPage = () => {
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' or 'yearly'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const plans = {
    monthly: [
      {
        name: 'مجاني',
        price: '0 ر.س',
        amount: 0,
        currency: 'SAR',
        period: '/شهر',
        description: 'مثالي للبدء والاستخدام الشخصي.',
        features: [
          'بريد وهمي واحد',
          'إعادة توجيه الرسائل',
          'تسجيل دخول آمن',
          'دعم عبر البريد الإلكتروني',
        ],
        cta: 'ابدأ الآن مجاناً',
        link: '/register',
        isActionable: false,
        isFeatured: false,
      },
      {
        name: 'احترافي (PRO)',
        price: '19 ر.س',
        amount: 19,
        currency: 'SAR',
        period: '/شهر',
        description: 'للمستخدمين المتقدمين والمطورين.',
        features: [
          'كل شيء في الباقة المجانية',
          'عدد غير محدود من البريد الوهمي',
          'إعادة توليد البريد الوهمي',
          'صلاحيات API متقدمة',
          'دعم فني ذو أولوية',
        ],
        cta: 'الترقية إلى PRO',
        link: '/register?plan=pro',
        isActionable: true,
        isFeatured: true,
      },
      {
        name: 'أعمال (Business)',
        price: 'تواصل معنا',
        amount: null,
        currency: null,
        period: '',
        description: 'حلول مخصصة للشركات والفرق.',
        features: [
          'كل شيء في باقة PRO',
          'إدارة أعضاء الفريق',
          'تقارير متقدمة',
          'مدير حساب مخصص',
          'اتفاقية مستوى الخدمة (SLA)',
        ],
        cta: 'اتصل بالمبيعات',
        link: '/contact',
        isActionable: false,
        isFeatured: false,
      },
    ],
    yearly: [
      {
        name: 'مجاني',
        price: '0 ر.س',
        amount: 0,
        currency: 'SAR',
        period: '/سنة',
        description: 'مثالي للبدء والاستخدام الشخصي.',
        features: [
          'بريد وهمي واحد',
          'إعادة توجيه الرسائل',
          'تسجيل دخول آمن',
          'دعم عبر البريد الإلكتروني',
        ],
        cta: 'ابدأ الآن مجاناً',
        link: '/register',
        isActionable: false,
        isFeatured: false,
      },
      {
        name: 'احترافي (PRO)',
        price: '190 ر.س',
        amount: 190,
        currency: 'SAR',
        period: '/سنة',
        description: 'للمستخدمين المتقدمين والمطورين.',
        features: [
          'كل شيء في الباقة المجانية',
          'عدد غير محدود من البريد الوهمي',
          'إعادة توليد البريد الوهمي',
          'صلاحيات API متقدمة',
          'دعم فني ذو أولوية',
        ],
        cta: 'الترقية إلى PRO',
        link: '/register?plan=pro',
        isActionable: true,
        isFeatured: true,
      },
      {
        name: 'أعمال (Business)',
        price: 'تواصل معنا',
        amount: null,
        currency: null,
        period: '',
        description: 'حلول مخصصة للشركات والفرق.',
        features: [
          'كل شيء في باقة PRO',
          'إدارة أعضاء الفريق',
          'تقارير متقدمة',
          'مدير حساب مخصص',
          'اتفاقية مستوى الخدمة (SLA)',
        ],
        cta: 'اتصل بالمبيعات',
        link: '/contact',
        isActionable: false,
        isFeatured: false,
      },
    ],
  };

  const currentPlans = plans[billingCycle];

  const handleUpgradeClick = async (plan) => {
    if (!plan.isActionable) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:3001/api/payment/create-tap-charge', 
        { amount: plan.amount, currency: plan.currency, description: `OnePass ${plan.name} - ${billingCycle}` },
        { withCredentials: true }
      );
      // Redirect to Stripe Checkout
      window.location.href = response.data.url;
    } catch (err) {
      console.error('Payment initiation failed:', err);
      setError('فشل بدء عملية الدفع. يرجى المحاولة مرة أخرى.');
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen pricing-page" dir="rtl">
      <div className="container mx-auto px-4 py-12 sm:py-16">
        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 max-w-3xl mx-auto" role="alert">
          <p>{error}</p>
        </div>}
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
            باقات أسعار مرنة للجميع
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            اختر الباقة التي تناسب احتياجاتك، سواء كنت مستخدماً فردياً أو مطوراً أو شركة.
          </p>
        </div>

        <div className="flex justify-center items-center my-10">
          <span className={`font-medium ${billingCycle === 'monthly' ? 'text-indigo-600' : 'text-gray-500'}`}>
            شهرياً
          </span>
          <label className="toggle-switch mx-4">
            <input
              type="checkbox"
              checked={billingCycle === 'yearly'}
              onChange={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            />
            <span className="toggle-slider"></span>
          </label>
          <span className={`font-medium ${billingCycle === 'yearly' ? 'text-indigo-600' : 'text-gray-500'}`}>
            سنوياً (خصم 20%)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {currentPlans.map((plan, index) => (
            <div
              key={index}
              className={`pricing-card ${plan.isFeatured ? 'featured' : ''}`}
            >
              {plan.isFeatured && (
                <div className="featured-badge">
                  <Star className="w-4 h-4 mr-1" />
                  الأكثر شيوعاً
                </div>
              )}
              <div className="p-8">
                <h3 className="text-2xl font-semibold text-gray-900">{plan.name}</h3>
                <p className="mt-2 text-gray-600">{plan.description}</p>
                <div className="mt-6">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-lg font-medium text-gray-500">{plan.period}</span>
                </div>
                <ul className="mt-8 space-y-4">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center">
                      <Check className="w-5 h-5 text-indigo-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.isActionable ? (
                  <button onClick={() => handleUpgradeClick(plan)} disabled={isLoading} className={`cta-button ${plan.isFeatured ? 'featured' : ''} disabled:opacity-70`}>
                    {isLoading ? (
                      <Loader className="w-5 h-5 animate-spin" />
                    ) : (
                      <><span>{plan.cta}</span><ArrowLeft className="w-5 h-5" /></>
                    )}
                  </button>
                ) : (
                  <Link to={plan.link} className={`cta-button ${plan.isFeatured ? 'featured' : ''}`}>
                    <span>{plan.cta}</span>
                    <ArrowLeft className="w-5 h-5" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingPage;