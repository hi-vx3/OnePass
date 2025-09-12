import React, { useState, useEffect } from 'react';
import {
    Shield,
    Menu,
    Bell,
    User,
    BarChart2,
    Key,
    PieChart,
    Settings,
    HelpCircle,
    LogOut,
    Edit,
    Plus,
    PlayCircle,
    X,
    Copy,
    Trash2,
    AlertTriangle,
    Loader,
    Check,
    BarChartHorizontal,
    Clock
} from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './styles.css';

const ApiKeysPage = () => {
    const [apiKeys, setApiKeys] = useState([]);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [keyToDelete, setKeyToDelete] = useState(null);
    const [keyToEdit, setKeyToEdit] = useState(null); // State to hold the key being edited
    const [isEditMode, setIsEditMode] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(null); // Store ID of key being deleted
    const [toasts, setToasts] = useState([]);
    const [newlyCreatedKey, setNewlyCreatedKey] = useState(null); // To show the secret once
    const [copiedStates, setCopiedStates] = useState({});
    const [formData, setFormData] = useState({
        name: '',
        redirectUris: '',
        logoUrl: '',
        scopes: []
    });
    const [isSidebarActive, setIsSidebarActive] = useState(false);

    const AVAILABLE_SCOPES = [
        { id: 'read:user', description: 'قراءة معلومات المستخدم الأساسية (الاسم، البريد الوهمي)' },
        // { id: 'write:user', description: 'تعديل معلومات المستخدم (مثل الاسم)' }, // Example for future use
        { id: 'read:email', description: 'الوصول إلى البريد الوهمي وعرض الرسائل' },
        { id: 'write:email', description: 'إرسال رسائل من خلال البريد الوهمي' },
    ];

    useEffect(() => {
        loadApiKeys();
    }, []);

    const loadApiKeys = async () => {
        setPageLoading(true);
        try {
            // Use credentials to send session cookie
            const response = await axios.get('http://localhost:3001/api/user/api-keys', { withCredentials: true });
            setApiKeys(response.data || []);
        } catch (error) {
            console.error('Error loading API keys:', error);
            addToast('فشل في تحميل مفاتيح API', 'error');
        } finally {
            setPageLoading(false);
        }
    };

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleScopeChange = (e) => {
        const { value, checked } = e.target;
        setFormData(prev => {
            const newScopes = checked
                ? [...prev.scopes, value]
                : prev.scopes.filter(scope => scope !== value);
            return { ...prev, scopes: newScopes };
        });
    };

    const openEditForm = (key) => {
        setKeyToEdit(key);
        setIsEditMode(true);
        setFormData({
            name: key.name,
            redirectUris: key.redirectUris.join(', '),
            logoUrl: key.logoUrl || '',
            scopes: key.scopes || []
        });
        setIsFormVisible(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        // Automatically add the required SDK callback URI if it's not already present.
        const sdkCallbackUri = 'http://localhost:3000/dev/test-oauth.html'; // The correct callback URI
        
        // Filter out invalid local file paths and ensure the correct SDK URI is present.
        const cleanedUris = formData.redirectUris
            .split(',')
            .map(uri => uri.trim())
            .filter(uri => uri && !uri.startsWith('http://localhost/b1/Backend/')); // Remove the unwanted URI

        if (!cleanedUris.includes(sdkCallbackUri)) {
            cleanedUris.push(sdkCallbackUri);
        }

        const payload = {
            ...formData,
            redirectUris: cleanedUris,
            scopes: formData.scopes,
        };

        setIsCreating(true);
        try {
            if (isEditMode) {
                // Handle Update
                const response = await axios.patch(`http://localhost:3001/api/user/api-keys/${keyToEdit.id}`, payload, { withCredentials: true });
                const updatedKey = response.data;
                setApiKeys(apiKeys.map(k => (k.id === updatedKey.id ? updatedKey : k)));
                addToast('تم تحديث المفتاح بنجاح', 'success');
            } else {
                // Handle Create
                const response = await axios.post('http://localhost:3001/api/user/api-keys', payload, { withCredentials: true });
                const newKey = response.data;
                
                // Ensure the new key's scopes are an array, just like the backend does for the GET request.
                const formattedNewKey = {
                    ...newKey,
                    scopes: newKey.scopes ? newKey.scopes.split(',') : [],
                };
                setNewlyCreatedKey(formattedNewKey); // Store the newly created key to show the secret
                setApiKeys([formattedNewKey, ...apiKeys]); // Add the formatted key to the list
                addToast('تم إنشاء مفتاح API بنجاح', 'success');
            }

            setIsFormVisible(false);
            resetFormState();
        } catch (error) {
            const actionText = isEditMode ? 'تحديث' : 'إنشاء';
            console.error(`Error ${actionText} API key:`, error);
            addToast(`فشل في ${actionText} مفتاح API`, 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const confirmDelete = async () => {
        if (!keyToDelete) return;
        setIsDeleting(keyToDelete);
        try {
            await axios.delete(`http://localhost:3001/api/user/api-keys/${keyToDelete}`, { withCredentials: true });
            setApiKeys(apiKeys.filter(key => key.id !== keyToDelete));
            setIsDeleteModalVisible(false);
            setKeyToDelete(null);
            addToast('تم حذف مفتاح API بنجاح', 'success');
        } catch (error) {
            console.error('Error deleting API key:', error);
            addToast('فشل في حذف مفتاح API', 'error');
        } finally {
            setIsDeleting(null);
        }
    };

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text)
            .then(() => {
                setCopiedStates(prev => ({ ...prev, [id]: true }));
                setTimeout(() => {
                    setCopiedStates(prev => ({ ...prev, [id]: false }));
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
                addToast('فشل في نسخ النص', 'error');
            });
    };

    const addToast = (message, type) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            removeToast(id);
        }, 5000);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    const resetFormState = () => {
        setIsFormVisible(false);
        setIsEditMode(false);
        setKeyToEdit(null);
        setNewlyCreatedKey(null);
        setFormData({ name: '', redirectUris: '', logoUrl: '', scopes: ['read:user'] }); // Default to read:user for new keys
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-SA');
    };

    const formatTimeAgo = (dateString) => {
        if (!dateString) {
            return 'لم يستخدم بعد';
        }
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.round((now - date) / 1000);
        const minutes = Math.round(seconds / 60);
        const hours = Math.round(minutes / 60);
        const days = Math.round(hours / 24);

        if (seconds < 60) return `منذ ثوانٍ`;
        if (minutes < 60) return `منذ ${minutes} دقيقة`;
        if (hours < 24) return `منذ ${hours} ساعة`;
        if (days < 7) return `منذ ${days} يوم`;
        return new Intl.DateTimeFormat('ar-SA').format(date);
    };

    const toggleMobileMenu = () => {
        setIsSidebarActive(!isSidebarActive);
    };

    return (
        <div className="min-h-screen text-gray-800 font-inter" dir="rtl">
            {/* Toast Notifications Container */}
            <div className="fixed top-5 left-5 z-50 space-y-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`flex items-center px-4 py-3 rounded-lg shadow-lg border-r-4 animate-fade-in ${
                            toast.type === 'success'
                                ? 'bg-green-100 border-green-500 text-green-700'
                                : 'bg-red-100 border-red-500 text-red-700'
                        }`}
                    >
                        <p>{toast.message}</p>
                        <button onClick={() => removeToast(toast.id)} className="mr-4 text-lg">&times;</button>
                    </div>
                ))}
            </div>
            <header className="bg-white shadow-sm sticky top-0 z-20">
                <div className="container mx-auto px-4 py-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center">
                            <button className="lg:hidden text-gray-600 mr-3" onClick={toggleMobileMenu}>
                                <Menu className="text-xl" />
                            </button>
                            <div className="bg-indigo-100 p-2 rounded-lg">
                                <Shield className="text-indigo-600 text-xl" />
                            </div>
                            <span className="mr-3 text-xl font-bold brand-text-gradient">OnePass</span>
                        </div>
                        <nav className="hidden md:flex space-x-6 space-x-reverse">
                            <Link to="/dashboard" className="text-gray-600 hover:text-indigo-600">الرئيسية</Link>
                            <a href="#" className="text-gray-600 hover:text-indigo-600">المطورون</a>
                            <a href="#" className="text-gray-600 hover:text-indigo-600">التوثيق</a>
                            <Link to="/dashboard" className="text-indigo-600 font-medium">لوحة التحكم</Link>
                        </nav>
                        <div className="flex items-center space-x-4 space-x-reverse">
                            <button className="relative text-gray-600">
                                <Bell className="text-xl" />
                                <span className="absolute -top-1 -left-1 bg-red-500 text-white rounded-full text-xs w-4 h-4 flex items-center justify-center">3</span>
                            </button>
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                <User className="text-indigo-600" />
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className={`overlay ${isSidebarActive ? 'active' : ''}`} onClick={toggleMobileMenu}></div>

            <div className="flex h-[calc(100vh-4rem)]">
                <aside className={`sidebar bg-white shadow-lg h-screen sticky top-16 ${isSidebarActive ? 'active' : ''}`}>
                    <div className="p-5 border-l border-gray-200 h-full">
                        <div className="mb-8">
                            <h2 className="font-bold text-lg text-gray-800">لوحة المطورين</h2>
                        </div>
                        <nav className="space-y-2">
                            <Link to="/dashboard" className="flex items-center py-2 px-3 text-gray-600 hover:bg-gray-100 rounded-lg">
                                <BarChart2 className="ml-2" />
                                <span>نظرة عامة</span>
                            </Link>
                            <Link to="/api-keys" className="flex items-center py-2 px-3 text-indigo-600 bg-indigo-50 rounded-lg font-medium">
                                <Key className="ml-2" />
                                <span>مفاتيح API</span>
                            </Link>
                            <a href="#" className="flex items-center py-2 px-3 text-gray-600 hover:bg-gray-100 rounded-lg">
                                <PieChart className="ml-2" />
                                <span>الإحصائيات</span>
                            </a>
                            <a href="#" className="flex items-center py-2 px-3 text-gray-600 hover:bg-gray-100 rounded-lg">
                                <Settings className="ml-2" />
                                <span>الإعدادات</span>
                            </a>
                            <a href="#" className="flex items-center py-2 px-3 text-gray-600 hover:bg-gray-100 rounded-lg">
                                <HelpCircle className="ml-2" />
                                <span>المساعدة</span>
                            </a>
                            <a href="#" className="flex items-center py-2 px-3 text-gray-600 hover:bg-gray-100 rounded-lg mt-4">
                                <LogOut className="ml-2" />
                                <span>تسجيل الخروج</span>
                            </a>
                        </nav>
                    </div>
                </aside>

                <main className="transition-all duration-300 flex-1 overflow-y-auto">
                    <div className="container mx-auto px-4 py-6">
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-gray-900">مفاتيح API</h1>
                            <p className="text-gray-600">إدارة مفاتيح API لتطبيقاتك المتكاملة مع OnePass</p>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                            <div className="mb-3 sm:mb-0">
                                <h2 className="font-medium text-gray-800">مفاتيح API الخاصة بك</h2>
                                <p className="text-sm text-gray-500">يمكنك إنشاء وإدارة مفاتيح API لتطبيقاتك</p>
                            </div>
                            <button className="btn-primary py-2 px-4 rounded-lg font-medium flex items-center" onClick={() => {
                                resetFormState(); // Reset first
                                setIsFormVisible(true);
                            }}>
                                <Plus className="ml-2" />
                                إنشاء مفتاح جديد
                            </button>
                        </div>
                        {isFormVisible && (
                            <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
                                <div className="flex justify-between items-center mb-5">
                                    <h3 className="font-bold text-lg text-gray-800">إنشاء مفتاح API جديد</h3>
                                    <button className="text-gray-500 hover:text-gray-700" onClick={() => setIsFormVisible(false)}>
                                        <X className="text-xl" />
                                    </button>
                                </div>
                                <form onSubmit={handleFormSubmit}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                        <div>
                                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">اسم التطبيق</label>
                                            <input
                                                type="text"
                                                id="name"
                                                name="name"
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                placeholder="مثال: متجرنا الإلكتروني"
                                                required
                                                value={formData.name}
                                                onChange={handleFormChange}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 mb-2">رابط شعار التطبيق (اختياري)</label>                                            
                                            <input
                                                type="url"
                                                id="logoUrl"
                                                name="logoUrl"
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                placeholder="https://example.com/logo.png"
                                                value={formData.logoUrl}
                                                onChange={handleFormChange}
                                            />
                                        </div>
                                    </div>
                                    <div className="mb-5">
                                        <label htmlFor="redirectUris" className="block text-sm font-medium text-gray-700 mb-2">روابط إعادة التوجيه (Redirect URIs)</label>                                        
                                        <input
                                            type="text"
                                            id="redirectUris"
                                            name="redirectUris"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="https://example.com/callback, https://app.example.com/login"
                                            required
                                            value={formData.redirectUris}
                                            onChange={handleFormChange}
                                        />
                                        <p className="text-sm text-gray-500 mt-2">سيتم توجيه المستخدمين إلى هذه الروابط بعد التسجيل. افصل بين الروابط بفاصلة (,).</p>
                                    </div>
                                    <div className="mb-5">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">الصلاحيات (Scopes)</label>                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border border-gray-200 rounded-lg">
                                            {AVAILABLE_SCOPES.map(scope => (
                                                <label key={scope.id} className="flex items-start space-x-3 space-x-reverse">
                                                    <input
                                                        type="checkbox"
                                                        name="scopes"
                                                        value={scope.id}
                                                        checked={formData.scopes.includes(scope.id)}
                                                        onChange={handleScopeChange}
                                                        className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                                    />
                                                    <div>
                                                        <span className="font-medium text-gray-800">{scope.id}</span>
                                                        <p className="text-xs text-gray-500">{scope.description}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-2">حدد الصلاحيات التي سيتمكن هذا المفتاح من الوصول إليها.</p>
                                    </div>
                                    <div className="flex justify-end space-x-3 space-x-reverse">
                                        <button type="button" className="btn-secondary py-2 px-4 rounded-lg font-medium" onClick={resetFormState}>
                                            إلغاء
                                        </button>
                                        <button type="submit" className="btn-primary py-2 px-4 rounded-lg font-medium flex items-center" disabled={isCreating}>
                                            {isCreating ? (
                                                <Loader className="w-5 h-5 animate-spin ml-2" />
                                            ) : (
                                                isEditMode ? <Check className="ml-2" /> : <Key className="ml-2" />
                                            )}
                                            {isCreating ? (isEditMode ? 'جاري الحفظ...' : 'جاري الإنشاء...') : (isEditMode ? 'حفظ التغييرات' : 'إنشاء المفتاح')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                        {newlyCreatedKey && (
                            <div className="mb-6 p-5 rounded-lg border bg-blue-50 border-blue-200">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-lg text-blue-800">تم إنشاء تطبيقك بنجاح!</h3>
                                    <button className="text-gray-500 hover:text-gray-700" onClick={() => setNewlyCreatedKey(null)}>
                                        <X className="text-xl" />
                                    </button>
                                </div>
                                <p className="text-sm text-blue-700 mb-4">
                                    هذا هو <span className="font-bold">السر الخاص بتطبيقك (Client Secret)</span>. يرجى نسخه وحفظه في مكان آمن.
                                    <span className="font-bold text-red-600"> لن تتمكن من رؤيته مرة أخرى.</span>
                                </p>
                                <div className="flex items-center bg-blue-100 rounded-lg p-2">
                                    <input type="text" value={newlyCreatedKey.clientSecret} className="flex-1 bg-transparent text-blue-900 font-mono text-sm" readOnly />
                                    <button
                                        className="copy-btn text-blue-600 px-3 py-1 rounded-md hover:bg-blue-200 w-24 text-center"
                                        onClick={() => copyToClipboard(newlyCreatedKey.clientSecret, 'newly-created')}
                                    >
                                        {copiedStates['newly-created'] ? (
                                            <span className="flex items-center justify-center text-green-600"><Check className="w-4 h-4 ml-1" /> تم النسخ</span>
                                        ) : (
                                            <span className="flex items-center justify-center"><Copy className="w-4 h-4 ml-1" /> نسخ</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                        {pageLoading ? (
                            <div className="flex justify-center items-center py-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                <span className="mr-3">جاري تحميل مفاتيح API...</span>
                            </div>
                        ) : apiKeys.length === 0 && !isFormVisible ? (
                            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <Key className="text-gray-400 text-2xl" />
                                </div>
                                <h3 className="font-medium text-gray-800 mb-2">لا توجد مفاتيح API حتى الآن</h3>
                                <p className="text-gray-600 mb-4">ابدأ بإنشاء مفتاح API الأول لتطبيقك</p>
                                <button className="btn-primary py-2 px-4 rounded-lg font-medium inline-flex items-center" onClick={() => setIsFormVisible(true)}>
                                    <Plus className="ml-2" />
                                    إنشاء مفتاح API
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {apiKeys.map(key => (
                                    <div key={key.id} className="api-key-card rounded-lg p-5">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-medium text-gray-800">{key.name}</h3>
                                                <p className="text-sm text-gray-500">تم الإنشاء في {formatDate(key.createdAt)}</p>
                                            </div>
                                            <span className={`status-badge--active text-xs px-3 py-1 rounded-full font-medium`}>
                                                نشط
                                            </span>
                                        </div>
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Client ID</label>
                                            <div className="flex items-center">
                                                <input
                                                    type="text"
                                                    value={key.clientId}
                                                    className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-l-lg text-sm"
                                                    readOnly
                                                />
                                                <button
                                                    className="copy-btn bg-gray-100 px-3 py-2 rounded-r-lg border border-l-0 border-gray-300 text-gray-600 w-24 text-center"
                                                    onClick={() => copyToClipboard(key.clientId, key.id)}
                                                >
                                                    {copiedStates[key.id] ? (
                                                        <span className="flex items-center justify-center text-green-600"><Check className="w-4 h-4 ml-1" /> تم</span>
                                                    ) : (
                                                        <span className="flex items-center justify-center"><Copy className="w-4 h-4 ml-1" /> نسخ</span>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
                                            <div className="flex items-center text-sm text-gray-600">
                                                <BarChartHorizontal className="w-4 h-4 ml-2 text-gray-400" />
                                                <span>عدد الطلبات:</span>
                                                <span className="font-medium text-gray-800 mr-1">{key.requestCount.toLocaleString('ar-SA')}</span>
                                            </div>
                                            <div className="flex items-center text-sm text-gray-600">
                                                <Clock className="w-4 h-4 ml-2 text-gray-400" />
                                                <span>آخر استخدام:</span>
                                                <span className="font-medium text-gray-800 mr-1">
                                                    {formatTimeAgo(key.lastUsedAt)}
                                                </span>
                                            </div>
                                        </div>
                                        {key.scopes && key.scopes.length > 0 && (
                                            <div className="mt-3">
                                                <p className="text-xs font-medium text-gray-600 mb-2">الصلاحيات الممنوحة:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {key.scopes.map(scope => (
                                                        <span key={scope} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-md font-mono">
                                                            {scope}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center space-x-2 space-x-reverse">
                                                <a
                                                    href={`/dev/test-oauth.html?clientId=${key.clientId}&scopes=${encodeURIComponent(key.scopes.join(' '))}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-green-600 px-3 py-1 rounded-lg border border-green-200 hover:bg-green-50 flex items-center"
                                                >
                                                    <PlayCircle className="ml-1 inline w-4 h-4" />
                                                    اختبار
                                                </a>
                                                <button
                                                    className="text-sm text-blue-600 px-3 py-1 rounded-lg border border-blue-200 hover:bg-blue-50 flex items-center"
                                                    onClick={() => openEditForm(key)}
                                                >
                                                    <Edit className="ml-1 inline w-4 h-4" />
                                                    تعديل
                                                </button>
                                                <button
                                                    className="text-sm text-red-600 px-3 py-1 rounded-lg border border-red-200 hover:bg-red-50 flex items-center disabled:opacity-50"
                                                    onClick={() => { setKeyToDelete(key.id); setIsDeleteModalVisible(true); }}
                                                    disabled={isDeleting === key.id}
                                                >
                                                    {isDeleting === key.id ? <Loader className="w-4 h-4 animate-spin ml-1" /> : <Trash2 className="ml-1 inline w-4 h-4" />}
                                                    {isDeleting === key.id ? 'جاري الحذف...' : 'حذف'}
                                                </button>
                                            </div>
                                            <span className="text-xs text-gray-500">ID: {key.id}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {isDeleteModalVisible && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-5 w-full max-w-md">
                        <div className="flex items-center mb-4">
                            <div className="bg-red-100 p-2 rounded-full">
                                <AlertTriangle className="text-red-600" />
                            </div>
                            <h3 className="font-bold text-lg text-gray-800 mr-3">حذف مفتاح API</h3>
                        </div>
                        <p className="text-gray-600 mb-5">هل أنت متأكد من رغبتك في حذف مفتاح API هذا؟ لن تتمكن من التراجع عن هذا الإجراء.</p>
                        <div className="flex justify-end space-x-3 space-x-reverse">
                            <button className="btn-secondary py-2 px-4 rounded-lg font-medium" onClick={() => { setIsDeleteModalVisible(false); setKeyToDelete(null); }}>
                                إلغاء
                            </button>
                            <button className="bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700" onClick={confirmDelete}>
                                نعم، احذف
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApiKeysPage;