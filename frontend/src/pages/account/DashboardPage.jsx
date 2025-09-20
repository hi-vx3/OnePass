import React, { useState, useEffect } from 'react';
import {
    Shield,
    Mail,
    Link as LinkIcon,
    ChevronDown,
    Copy,
    Power,
    Plus,
    Key,
    Trash2,
    BellOff,
    Bell,
    Globe,
    Activity,
    Loader,
    ChevronRight,
    ChevronLeft,
    Check,
    User as UserIcon,
    Calendar,
    RefreshCw,
    Forward as MailForward,
    AlertTriangle,
    LogOut
} from 'lucide-react'; // FeatherIcon is not used, lucide-react is. Let's stick to lucide-react.
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom'; // <-- 1. استيراد useNavigate
import toast, { Toaster } from 'react-hot-toast'; // <-- 1. استيراد المكتبة
import './DashboardPage.css';

const DashboardPage = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [stats, setStats] = useState({ totalMessages: 128, linkedSites: 5, apiKeys: 2, linkedSitesList: [], recentActivities: [] });
    const [linkedSites, setLinkedSites] = useState([]);
    const [linkedSitesPagination, setLinkedSitesPagination] = useState({ currentPage: 1, totalPages: 1 });
    const [apiKeys, setApiKeys] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [virtualEmail, setVirtualEmail] = useState(null); // Set initial state to null
    const [isEmailActive, setIsEmailActive] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [isCopied, setIsCopied] = useState(false);
    const [alias, setAlias] = useState('');
    const [isDobCopied, setIsDobCopied] = useState(false);
    const [combinedFeed, setCombinedFeed] = useState([]);
    const [isForwardingActive, setIsForwardingActive] = useState(true);
    const [forwardedLogs, setForwardedLogs] = useState([]);
    const [logsPagination, setLogsPagination] = useState({ currentPage: 1, totalPages: 1 });
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [user, setUser] = useState({ name: 'مستخدم وهمي', dob: '1998-05-15' });
    const [isPushSubscribed, setIsPushSubscribed] = useState(false); // <-- 1. حالة جديدة لتتبع الاشتراك
    const navigate = useNavigate(); // <-- 2. الحصول على دالة navigate

    // --- Helper Function ---
    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return 'لم يستخدم بعد';
        const now = new Date();
        const time = new Date(timestamp);
        const diff = now - time;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (minutes < 60) return `منذ ${minutes} دقيقة`;
        if (hours < 24) return `منذ ${hours} ساعة`;
        return `منذ ${days} يوم`;
    };

    // --- New Component for Linked Site Card ---
    const LinkedSiteCard = ({ site, onUnlink }) => {
        const [gradientStyle, setGradientStyle] = useState({});

        const getDominantColor = (imageUrl) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = imageUrl;
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0);
                    const data = ctx.getImageData(0, 0, 1, 1).data;
                    const hex = `#${("000000" + ((data[0] << 16) | (data[1] << 8) | data[2]).toString(16)).slice(-6)}`;
                    if (hex === '#ffffff' || hex === '#000000') resolve(null);
                    resolve(hex);
                };
                img.onerror = () => resolve(null);
            });
        };

        useEffect(() => {
            if (site.apiKey?.logoUrl) {
                getDominantColor(site.apiKey.logoUrl).then(color => {
                    if (color) {
                        setGradientStyle({
                            background: `linear-gradient(to left, ${color}33, transparent)`
                        });
                    }
                });
            }
        }, [site.apiKey?.logoUrl]);

        return (
            <div className="linked-site-card" style={gradientStyle}>
                <div className="flex items-center">
                    <div className="linked-site-card__logo bg-white">
                        {site.apiKey?.logoUrl ? (
                            <img src={site.apiKey.logoUrl} alt={`${site.name} logo`} className="w-full h-full object-contain" />
                        ) : (
                            <Globe className="text-gray-500 w-5 h-5" />
                        )}
                    </div>
                    <div className="flex-grow">
                        <p className="font-semibold text-gray-800">{site.name}</p>
                        <p className="text-xs text-gray-500">آخر نشاط: {formatTimeAgo(site.lastActivity)}</p>
                    </div>
                    <button className="linked-site-card__unlink-btn" onClick={() => onUnlink(site.id)}><Trash2 className="w-4 h-4" /></button>
                </div>
            </div>
        );
    };

    const loadLinkedSites = async (page = 1) => {
        try {
            const response = await axios.get(`http://localhost:3001/api/user/linked-sites?page=${page}&limit=5`, { withCredentials: true });
            setLinkedSites(response.data.sites);
            setLinkedSitesPagination(response.data.pagination);
        } catch (error) {
            console.error('Error loading linked sites:', error);
            showError('حدث خطأ أثناء تحميل المواقع المرتبطة');
        }
    };

    const loadForwardedLogs = async (page = 1) => {
        try {
            const response = await axios.get(`http://localhost:3001/api/user/forwarded-logs?page=${page}&limit=5`, { withCredentials: true });
            setForwardedLogs(response.data.logs);
            setLogsPagination(response.data.pagination);
        } catch (error) {
            console.error('Error loading forwarded logs:', error);
            showError('حدث خطأ أثناء تحميل سجل الرسائل');
        }
    };

    // --- وظائف خاصة بإشعارات الدفع ---
    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const subscribeToPushNotifications = async () => {
        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                console.warn('Push messaging is not supported');
                return;
            }

            const registration = await navigator.serviceWorker.register('/sw.js');
            let subscription = await registration.pushManager.getSubscription();

            if (subscription === null) {
                console.log('Not subscribed, subscribing now...');
                const vapidPublicKey = 'BA..._YOUR_PUBLIC_KEY_...'; // <-- استبدل بمفتاحك العام
                if (!vapidPublicKey.startsWith('B')) {
                    console.error('VAPID public key is not configured correctly.');
                    return;
                }

                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
                });

                // إرسال الاشتراك إلى الخادم
                await axios.post('http://localhost:3001/api/user/push-subscription', subscription, { withCredentials: true });
                console.log('Successfully subscribed to push notifications.');
            } else {
                console.log('Already subscribed.');
            }
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
        }
    };

    const handlePushSubscriptionToggle = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            toast.error('إشعارات الدفع غير مدعومة في هذا المتصفح.');
            return;
        }

        const registration = await navigator.serviceWorker.ready;
        const currentSubscription = await registration.pushManager.getSubscription();

        if (currentSubscription) {
            // --- إلغاء الاشتراك ---
            await axios.delete('http://localhost:3001/api/user/push-subscription', {
                data: { endpoint: currentSubscription.endpoint },
                withCredentials: true,
            });
            await currentSubscription.unsubscribe();
            setIsPushSubscribed(false);
            toast.success('تم إلغاء الاشتراك في إشعارات الدفع بنجاح.');
        } else {
            // --- الاشتراك ---
            await subscribeToPushNotifications();
            setIsPushSubscribed(true);
            toast.success('تم الاشتراك في إشعارات الدفع بنجاح.');
        }
    };

    useEffect(() => {
        // 1. جلب البيانات الأولية عند تحميل الصفحة
        loadDashboardData();
        loadLinkedSites(1);
        loadForwardedLogs(1);

        // 2. تأثيرات بصرية
        const cards = document.querySelectorAll('.fade-in');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
        });

        // 3. التحقق من حالة الاشتراك في إشعارات الدفع
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then(registration => {
                registration.pushManager.getSubscription().then(subscription => {
                    if (subscription) {
                        setIsPushSubscribed(true);
                    }
                });
            });
        }

        // 3. إعداد اتصال SSE لاستقبال التحديثات الفورية
        const eventSource = new EventSource('http://localhost:3001/api/notifications/stream', { withCredentials: true });

        eventSource.onopen = () => {
            console.log('SSE connection established.');
        };

        // الاستماع لحدث إشعار عام (سواء كان نشاطاً أو إشعاراً)
        eventSource.addEventListener('new_notification', (event) => {
            const newEvent = JSON.parse(event.data);
            console.log('New event received via SSE:', newEvent);

            // 1. إضافة الحدث الجديد إلى قائمة "آخر التحديثات"
            setCombinedFeed(prevFeed => [ newEvent, ...prevFeed]);

            // 2. تحديث الإحصائيات بناءً على نوع الحدث
            setStats(prevStats => {
                switch (newEvent.type) {
                    case 'site_linked':
                        return { ...prevStats, linkedSites: prevStats.linkedSites + 1 };
                    case 'site_unlinked':
                        return { ...prevStats, linkedSites: prevStats.linkedSites - 1 };
                    case 'api_key_created':
                        return { ...prevStats, apiKeys: prevStats.apiKeys + 1 };
                    case 'api_key_deleted':
                        return { ...prevStats, apiKeys: prevStats.apiKeys - 1 };
                    default:
                        return prevStats; // لا تغيير في الإحصائيات
                }
            });

            // 3. عرض إشعار منبثق (Toast)
            const isActivity = newEvent.feedType === 'activity';
            const colors = isActivity ? getActivityColor(newEvent.type) : getNotificationColor(newEvent.type);
            // ملاحظة: getNotificationIcon و getActivityIcon قد لا تكونا معرفتين في هذا النطاق
            // سنقوم بتعريفهما أو استيرادهما إذا لزم الأمر، لكن للتبسيط سنستخدم أيقونة ثابتة الآن.
            const Icon = isActivity ? Activity : Bell; // استخدام أيقونات متاحة

            // 4. تحديد المسار المستهدف للنقر على الإشعار المنبثق
            const getPathForEvent = (event) => {
                switch (event.type) {
                    case 'profile_updated':
                    case 'settings_updated':
                    case 'api_key_created':
                    case 'api_key_updated':
                    case 'api_key_deleted':
                        return '/settings'; // كل هذه الأحداث مرتبطة بصفحة الإعدادات
                    default:
                        return null; // لا يوجد مسار محدد للأنواع الأخرى
                }
            };
            const path = getPathForEvent(newEvent);

            toast.custom((t) => (
                <div
                    // 5. إضافة onClick وتغيير شكل المؤشر إذا كان هناك مسار
                    onClick={() => {
                        if (path) navigate(path);
                        toast.dismiss(t.id);
                    }}
                    className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 ${path ? 'cursor-pointer' : ''}`}
                >
                    <div className="flex-1 w-0 p-4">
                        <div className="flex items-start">
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center`}>
                                <Icon className={`${colors.text} w-6 h-6`} />
                            </div>
                            <div className="mr-3 flex-1">
                                <p className="text-sm font-medium text-gray-900">{newEvent.title}</p>
                                <p className="mt-1 text-sm text-gray-500">{newEvent.message || newEvent.description}</p>
                            </div>
                        </div>
                    </div>
                </div>
            ), { duration: 6000 }); // يختفي الإشعار بعد 6 ثوانٍ
        });

        eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
            eventSource.close();
        };

        // 4. إغلاق الاتصال عند مغادرة الصفحة لمنع تسرب الذاكرة
        return () => {
            eventSource.close();
        };
    }, []); // مصفوفة فارغة تعني أن هذا الـ hook سيعمل مرة واحدة فقط عند تحميل المكون
        const loadDashboardData = async () => {
        setIsLoading(true);
        try {
            // Call the single, unified endpoint
            const response = await axios.get('http://localhost:3001/api/dashboard/stats', { withCredentials: true });
            const data = response.data;

            // Process responses after all have completed
            setStats(data);
            setVirtualEmail(data.virtualEmail);
            setIsEmailActive(data.isEmailActive);
            setIsForwardingActive(data.isForwardingActive);
            setApiKeys(data.apiKeysList);
            
            // Combine notifications and activities into a single feed
            const activities = data.recentActivities.map(item => ({ ...item, feedType: 'activity' }));
            const notifications = data.notificationsList.map(item => ({ ...item, feedType: 'notification' }));
            const feed = [...activities, ...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setCombinedFeed(feed);

            // Set fake user data from backend if available, otherwise use default
            setUser({
                name: data.name || data.email.split('@')[0] || 'مستخدم', // Show name from data or use email prefix if available
                dob: data.dob || '1998-05-15', // Assuming dob is part of the response
            });
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showError('حدث خطأ أثناء تحميل بيانات لوحة التحكم');
        } finally {
            setIsLoading(false);
        }
    };
    const copyToClipboard = (text) => {
        // Use the modern Clipboard API in secure contexts
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).catch(err => {
                console.error('Could not copy text using navigator: ', err);
            });
        } else {
            // Fallback for insecure contexts or older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            
            // Make the textarea non-editable and move it off-screen
            textArea.style.position = 'absolute';
            textArea.style.left = '-9999px';
            
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
            }
            
            document.body.removeChild(textArea);
        }
    };

    const handleCopyEmail = () => {
        copyToClipboard(virtualEmail);
        setIsCopied(true);
        // Reset the icon after 2 seconds
        setTimeout(() => {
            setIsCopied(false);
        }, 2000);
    };

    const handleCopyDob = () => {
        if (!user.dob) return;
        copyToClipboard(user.dob);
        setIsDobCopied(true);
        setTimeout(() => {
            setIsDobCopied(false);
        }, 2000);
    };

    const handleToggleForwarding = async () => {
        const newForwardingState = !isForwardingActive;
        try {
            await axios.patch('http://localhost:3001/api/user/virtual-email/forwarding', {
                enabled: newForwardingState,
            }, { withCredentials: true });
            setIsForwardingActive(newForwardingState);
        } catch (error) {
            console.error('Error toggling email forwarding:', error);
            showError('حدث خطأ أثناء تغيير حالة إعادة التوجيه');
            // Revert UI on failure
            setIsForwardingActive(!newForwardingState);
        }
    };

    const confirmDeactivateEmail = async () => {
        setIsLoading(true);
        try {
            await axios.patch('http://localhost:3001/api/user/virtual-email', {
                active: false,
            }, { withCredentials: true });
            setIsEmailActive(false);
            setShowDeactivateModal(false);
        } catch (error) {
            console.error('Error deactivating virtual email:', error);
            showError('حدث خطأ أثناء إيقاف البريد الوهمي');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleEmail = async () => {
        // If we are activating, do it directly without confirmation
        if (!isEmailActive) {
            try {
                const response = await axios.patch('http://localhost:3001/api/user/virtual-email', {
                    active: true,
                }, { withCredentials: true });
                if (response.data.success) {
                    setIsEmailActive(true);
                }
            } catch (error) {
                console.error('Error activating virtual email:', error);
                showError('حدث خطأ أثناء تفعيل البريد الوهمي');
            }
        } else {
            // If we are deactivating, show the confirmation modal
            setShowDeactivateModal(true);
        }
    };

    const handleLogout = async () => {
        try {
            await axios.post('http://localhost:3001/api/auth/logout', {}, { withCredentials: true });
            // Redirect to a public page, e.g., the login page
            window.location.href = '/';
        } catch (error) {
            console.error('Error logging out:', error);
            showError('حدث خطأ أثناء تسجيل الخروج.');
        }
    };

    const handleGenerateVirtualEmail = async (useAlias = false) => {
        setIsLoading(true);
        try {
            if (useAlias && (!alias || alias.length < 3)) {
                showError('يجب أن يتكون الاسم المستعار من 3 أحرف على الأقل.');
                setIsLoading(false);
                return;
            }

            const payload = useAlias && alias ? { alias } : {};
            const response = await axios.post('http://localhost:3001/api/user/virtual-email/generate', payload, { withCredentials: true });
            if (response.data.success) {
                setVirtualEmail(response.data.email);
                setIsEmailActive(true);
                setAlias(''); // Clear the input on success
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'حدث خطأ أثناء إنشاء البريد الوهمي';
            showError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteApiKey = async (keyId) => {
        if (!window.confirm('هل أنت متأكد من حذف مفتاح API هذا؟')) return;
        try {
            await axios.delete(`http://localhost:3001/api/user/api-keys/${keyId}`, { withCredentials: true });
            setApiKeys(apiKeys.filter(key => key.id !== keyId));
            setStats(prev => ({ ...prev, apiKeys: prev.apiKeys - 1 }));
        } catch (error) {
            console.error('Error deleting API key:', error);
            showError('حدث خطأ أثناء حذف مفتاح API');
        }
    };

    const handleUnlinkSite = async (siteId) => {
        if (!window.confirm('هل أنت متأكد من فصل هذا الموقع؟')) return;
        try {
            await axios.delete(`http://localhost:3001/api/user/linked-sites/${siteId}`, { withCredentials: true });
            loadLinkedSites(linkedSitesPagination.currentPage); // Reload the current page of sites
        } catch (error) {
            console.error('Error unlinking site:', error);
            showError('حدث خطأ أثناء فصل الموقع');
        }
    };

    const handleNotificationsToggle = async (e) => {
        const enabled = e.target.checked;
        try {
            await axios.patch('http://localhost:3001/api/user/notifications', { enabled }, { withCredentials: true });
            setNotificationsEnabled(enabled);
        } catch (error) {
            console.error('Error toggling notifications:', error);
            showError('حدث خطأ أثناء تغيير إعدادات الإشعارات');
            setNotificationsEnabled(!enabled);
        }
    };

    const handleClearAllNotifications = async () => {
        if (!window.confirm('هل أنت متأكد من رغبتك في مسح جميع الإشعارات؟ لا يمكن التراجع عن هذا الإجراء.')) {
            return;
        }

        try {
            // استدعاء نقطة الوصول الجديدة في الواجهة الخلفية
            await axios.delete('http://localhost:3001/api/user/notifications', { withCredentials: true });
            
            // تحديث الواجهة الأمامية فوراً عن طريق إزالة الإشعارات من الحالة
            setCombinedFeed(prevFeed => prevFeed.filter(item => item.feedType !== 'notification'));
            
            toast.success('تم مسح جميع الإشعارات بنجاح.');

        } catch (error) {
            console.error('Error clearing notifications:', error);
            showError('حدث خطأ أثناء مسح الإشعارات.');
        }
    };

    const getNotificationColor = (type) => {
        const colors = {
            security: { bg: 'bg-red-100', text: 'text-red-600' },
            message: { bg: 'bg-blue-100', text: 'text-blue-600' },
            warning: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
            success: { bg: 'bg-green-100', text: 'text-green-600' }
        };
        return colors[type] || { bg: 'bg-gray-100', text: 'text-gray-600' };
    };

    const getNotificationIcon = (type) => {
        const icons = {
            security: 'shield',
            message: 'mail',
            warning: 'alert-triangle',
            success: 'check-circle'
        };
        return icons[type] || 'bell';
    };

    const getSiteColor = (siteName) => {
        const siteColors = {
            'Amazon': { bg: 'bg-yellow-100', text: 'text-yellow-600' },
            'YouTube': { bg: 'bg-red-100', text: 'text-red-600' },
            'Twitter': { bg: 'bg-blue-100', text: 'text-blue-600' },
            'Netflix': { bg: 'bg-red-100', text: 'text-red-600' },
            'Facebook': { bg: 'bg-blue-100', text: 'text-blue-600' }
        };
        return siteColors[siteName] || { bg: 'bg-gray-100', text: 'text-gray-600' };
    };

    const getSiteIcon = (siteName) => {
        const siteIcons = {
            'Amazon': 'shopping-bag',
            'YouTube': 'video',
            'Twitter': 'message-square',
            'Netflix': 'tv',
            'Facebook': 'facebook'
        };
        return siteIcons[siteName] || 'globe';
    };

    const getActivityColor = (type) => {
        const colors = {
            login: { bg: 'bg-green-100', text: 'text-green-600' },
            message: { bg: 'bg-blue-100', text: 'text-blue-600' },
            create: { bg: 'bg-purple-100', text: 'text-purple-600' },
            update: { bg: 'bg-yellow-100', text: 'text-yellow-600' }
        };
        return colors[type] || { bg: 'bg-gray-100', text: 'text-gray-600' };
    };

    const getActivityIcon = (type) => {
        const icons = {
            login: 'log-in',
            message: 'mail',
            create: 'plus',
            update: 'edit'
        };
        return icons[type] || 'activity';
    };

    const showError = (message) => {
        console.error(message);
        // Add error notification logic here if needed
    };

    return (
        <div className="min-h-screen dashboard-container font-inter" dir="rtl">
            {/* 2. إضافة مكون Toaster لعرض الإشعارات */}
            <Toaster position="top-left" reverseOrder={false} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8 fade-in">
                    <h1 className="text-3xl font-bold text-gray-900">لوحة التحكم الخاصة بك</h1>
                    <p className="text-gray-600 mt-2">إدارة بريدك الوهمي، المواقع المرتبطة، والإشعارات.</p>
                </div>

                <div className="stats-grid mb-8 fade-in">
                    <div className="dashboard-stats__card bg-white rounded-xl shadow-md p-6 card-hover">
                        <div className="flex items-center">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                <Mail className="text-blue-600 w-6 h-6" />
                            </div>
                            <div className="mr-3">
                                <p className="text-sm text-gray-600">إجمالي الرسائل</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.totalMessages}</p>
                            </div>
                        </div>
                    </div>
                    <div className="dashboard-stats__card bg-white rounded-xl shadow-md p-6 card-hover">
                        <div className="flex items-center">
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                                <LinkIcon className="text-green-600 w-6 h-6" />
                            </div>
                            <div className="mr-3">
                                <p className="text-sm text-gray-600">المواقع المرتبطة</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.linkedSites}</p>
                            </div>
                        </div>
                    </div>
                    <div className="dashboard-stats__card bg-white rounded-xl shadow-md p-6 card-hover">
                        <div className="flex items-center">
                            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                                <Key className="text-purple-600 w-6 h-6" />
                            </div>
                            <div className="mr-3">
                                <p className="text-sm text-gray-600">مفاتيح API</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.apiKeys}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-xl shadow-md p-6 card-hover fade-in">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                <h2 className="text-lg font-semibold text-gray-900">البريد الوهمي</h2>
                                {virtualEmail && <span className={`w-2.5 h-2.5 rounded-full mr-2 ${isEmailActive ? 'bg-green-500' : 'bg-gray-400'}`}></span>}
                                </div>
                                {virtualEmail && (
                                    <button className={`text-sm font-medium transition-colors flex items-center p-1 rounded-md ${isEmailActive ? 'text-red-600 hover:bg-red-100' : 'text-green-600 hover:bg-green-100'}`} onClick={handleToggleEmail} title={isEmailActive ? 'إيقاف البريد الوهمي' : 'تفعيل البريد الوهمي'}>
                                        <Power className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            {virtualEmail ? (
                                <>
                                    <div className="flex items-center justify-between bg-gray-50 rounded-md border border-gray-200 p-3">
                                        <div className="flex items-center min-w-0">
                                            <Mail className="text-gray-500 w-5 h-5 ml-2" />
                                            <span className="text-gray-800 font-medium truncate">{virtualEmail}</span>
                                        </div>
                                        <button className="text-gray-500 hover:text-indigo-600 transition-colors mr-2" onClick={handleCopyEmail} disabled={isCopied} title="نسخ البريد">
                                                {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                    </div>
                                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">إعادة توجيه الرسائل</label>
                                            <span className="text-xs text-gray-500">إرسال الرسائل إلى بريدك الأساسي</span>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={isForwardingActive} onChange={handleToggleForwarding} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-gray-500 text-center">لم يتم تفعيل البريد المؤقت بعد.</p>
                                    <div>
                                        <label htmlFor="alias" className="block text-sm font-medium text-gray-700 text-right mb-1">اختر اسمًا مستعارًا (اختياري)</label>
                                        <div className="flex items-center w-full rounded-md shadow-sm border border-gray-300 focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                                            <input 
                                                type="text" 
                                                id="alias" 
                                                className="flex-grow block w-full px-3 py-2 border-0 rounded-r-md focus:outline-none sm:text-sm text-right"
                                                placeholder="my-alias"
                                                value={alias}
                                                onChange={(e) => setAlias(e.target.value)}
                                                disabled={isLoading}
                                            />
                                            <div className="flex items-center pl-3 pr-2 bg-gray-50 border-l border-gray-300 rounded-l-md">
                                                <span className="text-gray-500 sm:text-sm whitespace-nowrap">@onepass.me</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="btn-primary text-sm px-4 py-2 rounded-md flex items-center justify-center w-1/2" onClick={() => handleGenerateVirtualEmail(true)} disabled={isLoading || !alias || alias.length < 3}>
                                            {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 ml-2" /> إنشاء بريد</>}
                                        </button>
                                        <button className="btn-secondary text-sm px-4 py-2 rounded-md flex items-center justify-center w-1/2 border border-gray-300" onClick={() => handleGenerateVirtualEmail(false)} disabled={isLoading}>
                                            {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <><Power className="w-4 h-4 ml-2" /> إنشاء عشوائي</>}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="bg-white rounded-xl shadow-md p-6 card-hover fade-in">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-900">آخر التحديثات</h2>
                                <div className="flex items-center gap-3">
                                    {combinedFeed.some(item => item.feedType === 'notification' && !item.isRead) && <span className="notification-dot w-2 h-2 bg-red-500 rounded-full"></span>}
                                    {combinedFeed.some(item => item.feedType === 'notification') && (
                                        <button 
                                            onClick={handleClearAllNotifications}
                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                            title="مسح جميع الإشعارات"
                                        ><Trash2 className="w-4 h-4" /></button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-4">
                                {combinedFeed.length === 0 ? (
                                    <div className="text-center py-4 text-gray-500">
                                        <BellOff className="w-8 h-8 mx-auto mb-2" />
                                        <p>لا توجد تحديثات جديدة</p>
                                    </div>
                                ) : (
                                combinedFeed.slice(0, 5).map(item => { // Show latest 5 items
                                    const isActivity = item.feedType === 'activity';
                                    const colors = isActivity ? getActivityColor(item.type) : getNotificationColor(item.type);
                                    const Icon = isActivity ? getActivityIcon(item.type) : getNotificationIcon(item.type);

                                    return (
                                        <div key={`${item.feedType}-${item.id}`} className="flex items-start p-2 rounded-lg hover:bg-gray-50">
                                            <div className={`flex-shrink-0 w-8 h-8 rounded-full ${colors.bg} flex items-center justify-center`}>
                                                <Icon className={`${colors.text} w-4 h-4`} />
                                            </div>
                                            <div className="mr-3">
                                                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                                                <p className="text-xs text-gray-500">{item.message || item.description}</p>
                                                <p className="text-xs text-gray-400">{formatTimeAgo(item.createdAt)}</p>
                                            </div>
                                        </div>
                                    );
                                }))}
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-md p-6 card-hover fade-in">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">إعدادات الإشعارات</h2>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">إشعارات آخر التحديثات</label>
                                        <span className="text-xs text-gray-500">تحديثات فورية داخل لوحة التحكم</span>
                                    </div>
                                    <label className="toggle-switch">
                                        <input type="checkbox" checked={notificationsEnabled} onChange={handleNotificationsToggle} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">إشعارات الدفع الأمنية</label>
                                        <span className="text-xs text-gray-500">تنبيهات للحالات الحرجة على جهازك</span>
                                    </div>
                                    <button
                                        onClick={handlePushSubscriptionToggle}
                                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${isPushSubscribed ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                                    >
                                        {isPushSubscribed ? 'إلغاء الاشتراك' : 'اشتراك'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-xl shadow-md p-6 card-hover fade-in">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-semibold text-gray-900">المواقع المرتبطة</h2>
                                <span className="text-sm text-gray-500">{stats.linkedSites} مواقع</span>
                            </div>
                            <div className="space-y-4">
                                {linkedSites.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <LinkIcon className="w-8 h-8 mx-auto mb-2" />
                                        <p>لا توجد مواقع مرتبطة</p>
                                    </div>
                                ) : (
                                linkedSites.map(site => <LinkedSiteCard key={site.id} site={site} onUnlink={handleUnlinkSite} />)
                                )}
                            </div>
                            {linkedSitesPagination.totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4">
                                    <button
                                        onClick={() => loadLinkedSites(linkedSitesPagination.currentPage - 1)}
                                        disabled={linkedSitesPagination.currentPage === 1}
                                        className="flex items-center px-3 py-1 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight className="w-4 h-4 ml-1" /> السابق
                                    </button>
                                    <span className="text-sm text-gray-700">صفحة {linkedSitesPagination.currentPage} من {linkedSitesPagination.totalPages}</span>
                                    <button
                                        onClick={() => loadLinkedSites(linkedSitesPagination.currentPage + 1)}
                                        disabled={linkedSitesPagination.currentPage === linkedSitesPagination.totalPages}
                                        className="flex items-center px-3 py-1 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        التالي <ChevronLeft className="w-4 h-4 mr-1" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="bg-white rounded-xl shadow-md p-6 card-hover fade-in">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-semibold text-gray-900">سجل الرسائل المعاد توجيهها</h2>
                                <span className="text-sm text-gray-500">{logsPagination.totalItems} رسائل</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المرسل</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الموضوع</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الوقت</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {forwardedLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                                                    <MailForward className="w-8 h-8 mx-auto mb-2" />
                                                    <p>لا توجد رسائل معاد توجيهها بعد.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            forwardedLogs.map(log => (
                                                <tr key={log.id}>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{log.senderAddress}</td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-xs">{log.subject}</td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{formatTimeAgo(log.forwardedAt)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {logsPagination.totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4">
                                    <button onClick={() => loadForwardedLogs(logsPagination.currentPage - 1)} disabled={logsPagination.currentPage === 1} className="flex items-center px-3 py-1 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                        <ChevronRight className="w-4 h-4 ml-1" /> السابق
                                    </button>
                                    <span className="text-sm text-gray-700">صفحة {logsPagination.currentPage} من {logsPagination.totalPages}</span>
                                    <button onClick={() => loadForwardedLogs(logsPagination.currentPage + 1)} disabled={logsPagination.currentPage === logsPagination.totalPages} className="flex items-center px-3 py-1 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                        التالي <ChevronLeft className="w-4 h-4 mr-1" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

        </div>
    );
};

export default DashboardPage;