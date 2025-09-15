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
import { Link } from 'react-router-dom';
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
    const [canChange, setCanChange] = useState(true);
    const [showRegenerateModal, setShowRegenerateModal] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [newAlias, setNewAlias] = useState('');
    const [user, setUser] = useState({ name: 'مستخدم وهمي', dob: '1998-05-15' });

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

    useEffect(() => {
        loadDashboardData();
        loadLinkedSites(1);
        loadForwardedLogs(1);
        const cards = document.querySelectorAll('.fade-in');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
        });
    }, []);
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
             setCanChange(data.canChange);
            
            // Combine notifications and activities into a single feed
            const activities = data.recentActivities.map(item => ({ ...item, feedType: 'activity' }));
            const notifications = data.notificationsList.map(item => ({ ...item, feedType: 'notification' }));
            const feed = [...activities, ...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setCombinedFeed(feed);

            // Set fake user data from backend if available, otherwise use default
            setUser({
                name: data.username || 'مستخدم وهمي', // Assuming username is part of the response
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

    const handleRegenerateVirtualEmail = async (useAlias = false) => {
        setIsLoading(true);
        try {
            if (useAlias && (!newAlias || newAlias.length < 3)) {
                showError('يجب أن يتكون الاسم المستعار من 3 أحرف على الأقل.');
                setIsLoading(false);
                return;
            }

            const payload = useAlias && newAlias ? { alias: newAlias } : {};
            const response = await axios.post('http://localhost:3001/api/user/virtual-email/regenerate', payload, { withCredentials: true });
            if (response.data.success) {
                setVirtualEmail(response.data.email);
                setIsEmailActive(true);
                setCanChange(response.data.canChange); // Update the canChange state
                setShowRegenerateModal(false);
                setNewAlias('');
                alert('تم إنشاء بريد وهمي جديد بنجاح.'); // Using alert for success feedback
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'حدث خطأ أثناء إنشاء البريد الوهمي الجديد';
            showError(errorMessage);
        } finally {
            setIsLoading(false);
        }
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
                                <Link to="/settings" className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">الإعدادات</Link>
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
                                <button 
                                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                                    className="flex items-center text-sm p-1 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                                >
                                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">{user.name.charAt(0)}</div>
                                    <span className="mr-2 text-gray-800 font-medium hidden sm:block">{user.name}</span>
                                    <ChevronDown className="w-4 h-4 text-gray-500 mr-1 hidden sm:block" />
                                </button>
                                {isProfileMenuOpen && (
                                    <div 
                                        className="origin-top-left absolute left-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none" 
                                        role="menu" 
                                        aria-orientation="vertical" 
                                        aria-labelledby="user-menu-button"
                                    >
                                        <Link to="/settings" className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">
                                            الإعدادات
                                        </Link>
                                        <button onClick={handleLogout} className="flex items-center w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-gray-100" role="menuitem">
                                            <LogOut className="w-4 h-4 ml-2" /> تسجيل الخروج
                                        </button>
                                    </div>
                                )}
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
                            <div className="flex items-center mb-4">
                                <h2 className="text-lg font-semibold text-gray-900">البريد الوهمي</h2>
                                {virtualEmail && <span className={`w-2.5 h-2.5 rounded-full mr-2 ${isEmailActive ? 'bg-green-500' : 'bg-gray-400'}`}></span>}
                            </div>
                            {virtualEmail ? (
                                <>
                                    <div className="flex items-center justify-between bg-gray-50 rounded-md border border-gray-200">
                                        <div className="flex items-center p-3">
                                            <Mail className="text-gray-500 w-5 h-5 ml-2" />
                                            <span className="text-gray-800 font-medium">{virtualEmail}</span>
                                        </div>
                                        <div className="flex items-center space-x-2 pl-3">
                                            <button className="text-gray-500 hover:text-indigo-600 transition-colors" onClick={handleCopyEmail} disabled={isCopied}>
                                                {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                         {canChange && (   <button className="text-gray-500 hover:text-blue-600 transition-colors" onClick={() => setShowRegenerateModal(true)}>
                                                <RefreshCw className="w-4 h-4" />
                                            </button>)}

                                            <button className={`text-sm font-medium transition-colors flex items-center p-1 rounded-md ${isEmailActive ? 'text-red-600 hover:bg-red-100' : 'text-green-600 hover:bg-green-100'}`} onClick={handleToggleEmail}>
                                                <Power className="w-4 h-4" />
                                            </button>
                                        </div>
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
                                {combinedFeed.some(item => item.feedType === 'notification' && !item.isRead) && <span className="notification-dot w-2 h-2 bg-red-500 rounded-full"></span>}
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

            {showRegenerateModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md m-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">إعادة إنشاء البريد الوهمي</h3>
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 mb-4" role="alert">
                            <p className="font-bold">تحذير</p>
                            <p>هذا الإجراء سيحذف بريدك الحالي نهائياً. ستفقد الوصول إلى أي حسابات مرتبطة به.</p>
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-gray-500 text-center">يمكنك اختيار اسم مستعار جديد أو إنشاء واحد عشوائي.</p>
                            <div>
                                <label htmlFor="new-alias" className="block text-sm font-medium text-gray-700 text-right mb-1">اسم مستعار جديد (اختياري)</label>
                                <div className="flex items-center w-full rounded-md shadow-sm border border-gray-300 focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                                    <input 
                                        type="text" 
                                        id="new-alias" 
                                        className="flex-grow block w-full px-3 py-2 border-0 rounded-r-md focus:outline-none sm:text-sm text-right"
                                        placeholder="my-new-alias"
                                        value={newAlias}
                                        onChange={(e) => setNewAlias(e.target.value)}
                                        disabled={isLoading}
                                    />
                                    <div className="flex items-center pl-3 pr-2 bg-gray-50 border-r border-gray-300 rounded-l-md">
                                        <span className="text-gray-500 sm:text-sm whitespace-nowrap">@onepass.me</span>
                                    </div>
                                </div>
                            </div>
                            <button className="btn-primary text-sm px-4 py-2 rounded-md flex items-center justify-center w-full" onClick={() => handleRegenerateVirtualEmail(true)} disabled={isLoading}>
                                {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 ml-2" /> إنشاء بريد جديد</>}
                            </button>
                            <button className="btn-secondary text-sm px-4 py-2 rounded-md flex items-center justify-center w-full border border-gray-300" onClick={() => handleRegenerateVirtualEmail(false)} disabled={isLoading}>
                                {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 ml-2" /> إنشاء بريد عشوائي جديد</>}
                            </button>
                            <button className="text-sm text-gray-600 hover:text-gray-900 w-full mt-2" onClick={() => setShowRegenerateModal(false)} disabled={isLoading}>
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDeactivateModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md m-4">
                        <div className="flex items-start">
                            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                                <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                            </div>
                            <div className="mt-3 text-center sm:mt-0 sm:mr-4 sm:text-right">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    إيقاف البريد الوهمي
                                </h3>
                                <div className="mt-2">
                                    <p className="text-sm text-gray-500">
                                        هل أنت متأكد؟ عند إيقاف البريد، لن تتمكن من استقبال أي رسائل جديدة على هذا العنوان.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                            <button type="button" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:mr-3 sm:w-auto sm:text-sm" onClick={confirmDeactivateEmail} disabled={isLoading}>{isLoading ? <Loader className="w-5 h-5 animate-spin" /> : 'تأكيد الإيقاف'}</button>
                            <button type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:w-auto sm:text-sm" onClick={() => setShowDeactivateModal(false)} disabled={isLoading}>إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

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