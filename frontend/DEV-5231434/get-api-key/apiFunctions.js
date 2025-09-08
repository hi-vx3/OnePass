/**
 * جلب مفاتيح API من الخادم
 * @async
 * @function loadApiKeys
 * @returns {Promise<void>} لا يرجع قيمة، ولكنه يحدث حالة التطبيق ويعرض المفاتيح
 * @throws {Error} إذا فشل جلب البيانات من الخادم
 */
async function loadApiKeys() {
    try {
        const response = await fetch('/api/user/api-keys', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_ACCESS_TOKEN'
            }
        });
        
        if (!response.ok) {
            throw new Error('فشل في جلب مفاتيح API');
        }
        
        const data = await response.json();
        state.apiKeys = data.keys || [];
        renderApiKeys();
        
    } catch (error) {
        console.error('Error loading API keys:', error);
        showAlert('فشل في تحميل مفاتيح API', 'error');
        state.apiKeys = [
            {
                id: 'key_1',
                name: 'متجر الإلكتروني',
                key: 'brnd_cli_a1b2c3d4e5f6',
                secret: 'brnd_sec_x1y2z3a4b5c6d7e8f9g0h1i2j3',
                created: '2023-10-15',
                status: 'active'
            },
            {
                id: 'key_2',
                name: 'تطبيق الجوال',
                key: 'brnd_cli_z9y8x7w6v5u4',
                secret: 'brnd_sec_m1n2b3v4c5x6z7q8w9e0r1t2',
                created: '2023-09-22',
                status: 'disabled'
            }
        ];
        renderApiKeys();
    }
}

/**
 * معالجة إنشاء مفتاح API جديد
 * @async
 * @function handleApiKeyGeneration
 * @param {Event} e - حدث إرسال النموذج
 * @returns {Promise<void>} لا يرجع قيمة، ولكنه يضيف مفتاحًا جديدًا إلى الحالة ويعيد العرض
 * @throws {Error} إذا فشل إنشاء المفتاح
 */
async function handleApiKeyGeneration(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('website-name').value,
        url: document.getElementById('website-url').value,
        redirectUri: document.getElementById('redirect-uri').value
    };
    
    try {
        const response = await fetch('/api/user/api-keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_ACCESS_TOKEN'
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error('فشل في إنشاء مفتاح API');
        }
        
        const newKey = await response.json();
        state.apiKeys.unshift(newKey);
        renderApiKeys();
        hideApiKeyForm();
        showAlert('تم إنشاء مفتاح API بنجاح', 'success');
        
    } catch (error) {
        console.error('Error creating API key:', error);
        showAlert('فشل في إنشاء مفتاح API', 'error');
    }
}

/**
 * تأكيد حذف مفتاح API
 * @async
 * @function confirmDelete
 * @returns {Promise<void>} لا يرجع قيمة، ولكنه يحذف المفتاح من الحالة ويعيد العرض
 * @throws {Error} إذا فشل حذف المفتاح
 */
async function confirmDelete() {
    if (!state.keyToDelete) return;
    
    try {
        const response = await fetch(`/api/user/api-keys/${state.keyToDelete}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer YOUR_ACCESS_TOKEN'
            }
        });
        
        if (!response.ok) {
            throw new Error('فشل في حذف مفتاح API');
        }
        
        state.apiKeys = state.apiKeys.filter(key => key.id !== state.keyToDelete);
        renderApiKeys();
        hideDeleteModal();
        showAlert('تم حذف مفتاح API بنجاح', 'success');
        
    } catch (error) {
        console.error('Error deleting API key:', error);
        showAlert('فشل في حذف مفتاح API', 'error');
    }
}