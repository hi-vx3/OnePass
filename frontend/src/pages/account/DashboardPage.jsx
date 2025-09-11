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
    Activity
} from 'lucide-react'; // FeatherIcon is not used, lucide-react is. Let's stick to lucide-react.
import axios from 'axios';
import { Link } from 'react-router-dom';
import './DashboardPage.css';

const DashboardPage = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [stats, setStats] = useState({ totalMessages: 128, linkedSites: 5, apiKeys: 2, linkedSitesList: [], recentActivities: [] });
    const [apiKeys, setApiKeys] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [virtualEmail, setVirtualEmail] = useState('mohamed123@OnePass.me');
    const [isEmailActive, setIsEmailActive] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    useEffect(() => {
        loadDashboardData();
        const cards = document.querySelectorAll('.fade-in');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
        });
    }, []);

    const loadDashboardData = async () => {
        setIsLoading(true);
        try {
            const statsResponse = await axios.get('http://localhost:3001/api/dashboard/stats');
            setStats(statsResponse.data);
            const apiKeysResponse = await axios.get('http://localhost:3001/api/user/api-keys');
            setApiKeys(apiKeysResponse.data);
            const notificationsResponse = await axios.get('http://localhost:3001/api/notifications');
            setNotifications(notificationsResponse.data);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showError('حدث خطأ أثناء تحميل بيانات لوحة التحكم');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    const handleCopyEmail = () => {
        copyToClipboard(virtualEmail);
    };

    const handleToggleEmail = async () => {
        try {
            const response = await axios.patch('http://localhost:3001/api/user/virtual-email', {
                active: !isEmailActive
            });
            if (response.data.success) {
                setIsEmailActive(!isEmailActive);
            }
        } catch (error) {
            console.error('Error toggling virtual email:', error);
            showError('حدث خطأ أثناء تغيير حالة البريد الوهمي');
        }
    };

    const handleDeleteApiKey = async (keyId) => {
        if (!window.confirm('هل أنت متأكد من حذف مفتاح API هذا؟')) return;
        try {
            await axios.delete(`http://localhost:3001/api/user/api-keys/${keyId}`);
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
            await axios.delete(`http://localhost:3001/api/user/linked-sites/${siteId}`);
            loadDashboardData();
        } catch (error) {
            console.error('Error unlinking site:', error);
            showError('حدث خطأ أثناء فصل الموقع');
        }
    };

    const handleNotificationsToggle = async (e) => {
        const enabled = e.target.checked;
        try {
            await axios.patch('http://localhost:3001/api/user/notifications', { enabled });
            setNotificationsEnabled(enabled);
        } catch (error) {
            console.error('Error toggling notifications:', error);
            showError('حدث خطأ أثناء تغيير إعدادات الإشعارات');
            setNotificationsEnabled(!enabled);
        }
    };

    const formatTimeAgo = (timestamp) => {
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

    const getNotificationColor = (type) => {
        const colors = {
            security: { bg: 'bg-red-100', text: 'text-red-600' },
            message: { bg: 'bg-blue-100', text: 'text-blue-600' },
            warning: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
            success: { bg: 'bg-green-100', text: 'text-green-600' }
        };
        return colors[type] || colors.info;
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
        return colors[type] || colors.info;
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
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 flex items-center" >
                                <Shield className="text-indigo-600 w-8 h-8" />
                                <span className="ml-2 text-xl font-bold text-gray-900">OnePass</span>
                            </div>
                            <nav className="hidden md:ml-6 md:flex md:items-center md:space-x-4 mr-6">
                                <Link to="/" className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">الرئيسية</Link>
                                <a href="#" className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">المطورون</a>
                                <a href="#" className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">الإعدادات</a>
                            </nav>
                        </div>
                        <div className="flex items-center">
                            <div className="flex items-center mr-4">
                                <div className={`status-badge flex items-center bg-${isEmailActive ? 'green' : 'gray'}-100 text-${isEmailActive ? 'green' : 'gray'}-800 text-xs font-medium px-3 py-1 rounded-full`}>
                                    <div className={`w-2 h-2 bg-${isEmailActive ? 'green' : 'gray'}-500 rounded-full mr-1`}></div>
                                    {isEmailActive ? 'نشط' : 'موقوف'}
                                </div>
                            </div>
                            <div className="relative">
                                <button className="flex items-center text-sm focus:outline-none">
                                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium">م</div>
                                    <span className="mr-2 text-gray-700">محمد أحمد</span>
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

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
                                <Shield className="text-purple-600 w-6 h-6" />
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
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">البريد الوهمي</h2>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                    <Mail className="text-indigo-600 w-5 h-5 ml-2" />
                                    <span className="text-gray-700 font-medium">{virtualEmail}</span>
                                </div>
                                <button className="text-indigo-600 hover:text-indigo-800 transition-colors" onClick={handleCopyEmail}>
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className={`status-badge flex items-center bg-${isEmailActive ? 'green' : 'gray'}-100 text-${isEmailActive ? 'green' : 'gray'}-800 text-sm font-medium px-3 py-1 rounded-full`}>
                                    <div className={`w-2 h-2 bg-${isEmailActive ? 'green' : 'gray'}-500 rounded-full ml-1`}></div>
                                    {isEmailActive ? 'نشط' : 'موقوف'}
                                </div>
                                <button className="btn-secondary text-red-600 hover:text-red-800 text-sm font-medium transition-colors" onClick={handleToggleEmail}>
                                    <Power className="w-4 h-4 ml-1" />
                                    {isEmailActive ? 'إيقاف مؤقت' : 'تفعيل'}
                                </button>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-md p-6 card-hover fade-in">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-900">مفاتيح API</h2>
                                <Link to="/api-keys" className="btn-primary text-sm px-3 py-1 rounded-md flex items-center">
                                    <Plus className="w-4 h-4 ml-1" />
                                    جديد
                                </Link>
                            </div>
                            <div className="space-y-3">
                                {apiKeys.length === 0 ? (
                                    <div className="text-center py-4 text-gray-500">
                                        <Key className="w-8 h-8 mx-auto mb-2" />
                                        <p>لا توجد مفاتيح API</p>
                                    </div>
                                ) : (
                                    apiKeys.map(key => (
                                        <div key={key.id} className="flex items-center justify-between py-2">
                                            <div className="flex items-center">
                                                <Key className="text-gray-500 w-4 h-4 ml-2" />
                                                <span className="text-sm text-gray-700">{key.maskedKey}</span>
                                            </div>
                                            <div className="flex space-x-2">
                                                <button className="text-gray-500 hover:text-indigo-600 transition-colors" onClick={() => copyToClipboard(key.actualKey)}>
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <button className="text-gray-500 hover:text-red-600 transition-colors" onClick={() => handleDeleteApiKey(key.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-md p-6 card-hover fade-in">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-900">الإشعارات</h2>
                                {notifications.length > 0 && <span className="notification-dot w-2 h-2 bg-red-500 rounded-full"></span>}
                            </div>
                            <div className="space-y-4">
                                {notifications.length === 0 ? (
                                    <div className="text-center py-4 text-gray-500">
                                        <BellOff className="w-8 h-8 mx-auto mb-2" />
                                        <p>لا توجد إشعارات جديدة</p>
                                    </div>
                                ) : (
                                    notifications.map(notification => (
                                        <div key={notification.id} className="flex items-start">
                                            <div className="flex-shrink-0">
                                                <div className={`w-8 h-8 rounded-full ${getNotificationColor(notification.type).bg} flex items-center justify-center`}>{/* Icon logic needs to be updated if using lucide */}
                                                    <Bell className={`${getNotificationColor(notification.type).text} w-4 h-4`} /></div>
                                            </div>
                                            <div className="mr-3">
                                                <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                                                <p className="text-xs text-gray-500">{notification.message}</p>
                                                <p className="text-xs text-gray-400">{formatTimeAgo(notification.timestamp)}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <label className="flex items-center text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                        checked={notificationsEnabled}
                                        onChange={handleNotificationsToggle}
                                    />
                                    <span className="mr-2">تشغيل الإشعارات</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-xl shadow-md p-6 card-hover fade-in">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-semibold text-gray-900">المواقع المرتبطة</h2>
                                <span className="text-sm text-gray-500">{stats.linkedSites} مواقع</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">اسم الموقع</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">البريد المستخدم</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">آخر نشاط</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {stats.linkedSitesList.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                                                    <LinkIcon className="w-8 h-8 mx-auto mb-2" />
                                                    <p>لا توجد مواقع مرتبطة</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            stats.linkedSitesList.map(site => (
                                                <tr key={site.id}>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="flex items-center" >
                                                            <div className={`w-8 h-8 rounded-full ${getSiteColor(site.name).bg} flex items-center justify-center ml-3`}>{/* Icon logic needs to be updated if using lucide */}
                                                                <Globe className={`${getSiteColor(site.name).text} w-4 h-4`} /></div>
                                                            <div>
                                                                <div className="text-sm font-medium text-gray-900">{site.name}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{site.email}</td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{formatTimeAgo(site.lastActivity)}</td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                                        <a href={site.url} className="text-indigo-600 hover:text-indigo-900 mr-3">زيارة</a>
                                                        <button className="text-red-600 hover:text-red-900" onClick={() => handleUnlinkSite(site.id)}>فصل</button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-md p-6 card-hover fade-in">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-semibold text-gray-900">آخر النشاطات</h2>
                                <button className="text-sm text-indigo-600 hover:text-indigo-800">عرض الكل</button>
                            </div>
                            <div className="space-y-4">
                                {stats.recentActivities.length === 0 ? (
                                    <div className="text-center py-4 text-gray-500" >
                                    <Activity className="w-8 h-8 mx-auto mb-2" />
                                    <p>لا توجد نشاطات حديثة</p>
                                </div>
                                ) : (
                                    stats.recentActivities.map(activity => (
                                        <div key={activity.id} className="flex items-start">
                                            <div className="flex-shrink-0">
                                                <div className={`w-8 h-8 rounded-full ${getActivityColor(activity.type).bg} flex items-center justify-center`}>
                                                    <Activity className={`${getActivityColor(activity.type).text} w-4 h-4`} />
                                                </div>
                                            </div>
                                            <div className="mr-3">
                                                <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                                                <p className="text-xs text-gray-500">{activity.description}</p>
                                                <p className="text-xs text-gray-400">{formatTimeAgo(activity.timestamp)}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="bg-white border-t border-gray-200 mt-16 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <div className="flex items-center mb-4 md:mb-0">
                            <Shield className="text-indigo-600 w-5 h-5" />
                            <span className="mr-2 text-sm text-gray-600">© 2025 OnePass. جميع الحقوق محفوظة.</span>
                        </div>
                        <div className="flex space-x-6">
                            <a href="#" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors">سياسة الخصوصية</a>
                            <a href="#" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors">شروط الخدمة</a>
                            <a href="#" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors">اتصل بنا</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default DashboardPage;