/**
 * معالجة إرسال نموذج البريد الإلكتروني لإرسال رمز TOTP
 * @async
 * @function handleEmailFormSubmit
 * @param {Event} e - حدث إرسال النموذج
 * @returns {Promise<void>} لا يرجع قيمة، ولكنه ينقل المستخدم إلى الخطوة الثانية في حالة النجاح
 * @throws {Error} إذا فشل إرسال الطلب إلى الخادم
 */
async function handleEmailFormSubmit(e) {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    
    if (!isValidEmail(email)) {
        showError(emailError, 'يرجى إدخال بريد إلكتروني صحيح');
        return;
    }
    
    hideError(emailError);
    
    setLoadingState(sendTOTPButton, true);
    
    try {
        const response = await fetch('/api/auth/request-totp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentEmail = email;
            userEmail.textContent = email;
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
            startResendTimer();
            startCountdown();
        } else {
            showError(emailError, data.message || 'حدث خطأ أثناء إرسال رمز التحقق');
        }
    } catch (error) {
        showError(emailError, 'حدث خطأ في الاتصال بالخادم');
    } finally {
        setLoadingState(sendTOTPButton, false);
    }
}

/**
 * معالجة إرسال نموذج رمز TOTP للتحقق
 * @async
 * @function handleTotpFormSubmit
 * @param {Event} e - حدث إرسال النموذج
 * @returns {Promise<void>} لا يرجع قيمة، ولكنه ينقل المستخدم إلى شاشة النجاح أو التوجيه في حالة النجاح
 * @throws {Error} إذا فشل التحقق من الرمز
 */
async function handleTotpFormSubmit(e) {
    e.preventDefault();
    
    const inputs = document.querySelectorAll('.code-input');
    const code = Array.from(inputs).map(input => input.value).join('');
    
    if (code.length !== 6 || !/^\d+$/.test(code)) {
        showError(totpError, 'يرجى إدخال رمز التحقق المكون من 6 أرقام');
        return;
    }
    
    hideError(totpError);
    
    setLoadingState(verifyTOTPButton, true);
    
    try {
        const response = await fetch('/api/auth/verify-totp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                email: currentEmail, 
                code: code 
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            clearInterval(resendInterval);
            clearInterval(countdownInterval);
            showSuccess(totpSuccess, 'تم التحقق بنجاح! يتم توجيهك الآن...');
            setTimeout(() => {
                step2.classList.add('hidden');
                step3.classList.remove('hidden');
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2000);
            }, 1500);
        } else {
            showError(totpError, data.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية');
        }
    } catch (error) {
        showError(totpError, 'حدث خطأ في الاتصال بالخادم');
    } finally {
        setLoadingState(verifyTOTPButton, false);
    }
}

/**
 * معالجة إعادة إرسال رمز TOTP
 * @async
 * @function handleResendCode
 * @returns {Promise<void>} لا يرجع قيمة، ولكنه يعيد إرسال رمز TOTP ويبدأ العدادات
 * @throws {Error} إذا فشل إرسال الطلب إلى الخادم
 */
async function handleResendCode() {
    if (!resendButton.disabled) {
        try {
            const response = await fetch('/api/auth/request-totp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: currentEmail })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showSuccess(totpSuccess, 'تم إعادة إرسال رمز التحقق إلى بريدك الإلكتروني');
                startResendTimer();
                startCountdown();
            } else {
                showError(totpError, data.message || 'حدث خطأ أثناء إعادة إرسال رمز التحقق');
            }
        } catch (error) {
            showError(totpError, 'حدث خطأ في الاتصال بالخادم');
        }
    }
}