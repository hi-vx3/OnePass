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
    Plus,
    X,
    Copy,
    Trash2,
    AlertTriangle,
    Loader
} from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './styles.css';

const ApiKeysPage = () => {
    const [apiKeys, setApiKeys] = useState([]);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [keyToDelete, setKeyToDelete] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [alert, setAlert] = useState({ message: '', type: '' });
    const [newlyCreatedKey, setNewlyCreatedKey] = useState(null); // To show the secret once
    const [formData, setFormData] = useState({
        name: '',
        redirectUris: '', // Will be a comma-separated string in the form
        logoUrl: ''
    });
    const [isSidebarActive, setIsSidebarActive] = useState(false);

    useEffect(() => {
        loadApiKeys();
    }, []);

    const loadApiKeys = async () => {
        setIsLoading(true);
        try {
            // Use credentials to send session cookie
            const response = await axios.get('http://localhost:3001/api/user/api-keys', { withCredentials: true });
            setApiKeys(response.data || []);
        } catch (error) {
            console.error('Error loading API keys:', error);
            showAlert('فشل في تحميل مفاتيح API', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleApiKeyGeneration = async (e) => {
        e.preventDefault();
        const payload = {
            ...formData,
            // Convert comma-separated string to an array of trimmed, non-empty strings
            redirectUris: formData.redirectUris.split(',').map(uri => uri.trim()).filter(uri => uri)
        };

        try {
            const response = await axios.post('http://localhost:3001/api/user/api-keys', payload, { withCredentials: true });
            setNewlyCreatedKey(response.data); // Store the newly created key to show the secret
            setApiKeys([response.data, ...apiKeys]); // Add to the list, but secret won't be visible on refresh
            setIsFormVisible(false);
            setFormData({ name: '', redirectUris: '', logoUrl: '' });
            showAlert('تم إنشاء مفتاح API بنجاح', 'success');
        } catch (error) {
            console.error('Error creating API key:', error);
            showAlert('فشل في إنشاء مفتاح API', 'error');
        }
    };

    const confirmDelete = async () => {
        if (!keyToDelete) return;
        try {
            await axios.delete(`http://localhost:3001/api/user/api-keys/${keyToDelete}`, { withCredentials: true });
            setApiKeys(apiKeys.filter(key => key.id !== keyToDelete));
            setIsDeleteModalVisible(false);
            setKeyToDelete(null);
            showAlert('تم حذف مفتاح API بنجاح', 'success');
        } catch (error) {
            console.error('Error deleting API key:', error);
            showAlert('فشل في حذف مفتاح API', 'error');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
            .then(() => showAlert('تم نسخ النص إلى الحافظة', 'success'))
            .catch(err => {
                console.error('Failed to copy: ', err);
                showAlert('فشل في نسخ النص', 'error');
            });
    };

    const showAlert = (message, type) => {
        setAlert({ message, type });
        setTimeout(() => setAlert({ message: '', type: '' }), 5000);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-SA');
    };

    const toggleMobileMenu = () => {
        setIsSidebarActive(!isSidebarActive);
    };

    return (
        <div className="min-h-screen text-gray-800 font-inter" dir="rtl">
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

            <aside className={`sidebar bg-white shadow-lg ${isSidebarActive ? 'active' : ''}`}>
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

            <main className="main-content transition-all duration-300">
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
                        <button className="btn-primary py-2 px-4 rounded-lg font-medium flex items-center" onClick={() => setIsFormVisible(true)}>
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
                            <form onSubmit={handleApiKeyGeneration}>
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
                                <div className="flex justify-end space-x-3 space-x-reverse">
                                    <button type="button" className="btn-secondary py-2 px-4 rounded-lg font-medium" onClick={() => setIsFormVisible(false)}>
                                        إلغاء
                                    </button>
                                    <button type="submit" className="btn-primary py-2 px-4 rounded-lg font-medium flex items-center">
                                        <Key className="ml-2" />
                                        إنشاء المفتاح
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                    {alert.message && (
                        <div className={`mb-6 px-4 py-3 rounded border ${alert.type === 'success' ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'}`}>
                            {alert.message}
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
                                <button className="copy-btn text-blue-600 px-3 py-1 rounded-md hover:bg-blue-200" onClick={() => copyToClipboard(newlyCreatedKey.clientSecret)}>
                                    <Copy />
                                </button>
                            </div>
                        </div>
                    )}
                    {isLoading ? (
                        <div className="flex justify-center items-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            <span className="mr-3">جاري تحميل مفاتيح API...</span>
                        </div>
                    ) : apiKeys.length === 0 ? (
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
                                            <button className="copy-btn bg-gray-100 px-3 py-2 rounded-r-lg border border-l-0 border-gray-300 text-gray-600" onClick={() => copyToClipboard(key.clientId)}>
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex space-x-2 space-x-reverse">
                                            <button className="text-sm text-red-600 px-3 py-1 rounded-lg border border-red-200 hover:bg-red-50" onClick={() => { setKeyToDelete(key.id); setIsDeleteModalVisible(true); }}>
                                                <Trash2 className="ml-1 inline w-4 h-4" /> حذف
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