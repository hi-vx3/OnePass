/**
 * OnePass JavaScript SDK
 * Version: 1.1.0 (with full PKCE support)
 * Version: 1.2.0 (Refactored for clarity and robustness)
 * Description: A lightweight library to simplify the OnePass OAuth2 integration for third-party developers.
 */
(function(window) {
    'use strict';

    // Avoid re-initialization
    if (window.onepass && window.onepass.init) {
        return;
    }

    const PKCE_STORAGE_KEY = 'onepass_pkce_verifier';
    const STATE_STORAGE_KEY = 'onepass_oauth_state';

    /**
     * The main OnePass client object.
     * @param {object} config - Configuration object.
     * @param {string} config.clientId - The Client ID obtained from the OnePass developer dashboard.
     * @param {string} [config.authorizeUrl] - The base URL for the OnePass authorization server.
     * @param {string} config.clientId - The Client ID from the OnePass developer dashboard.
     * @param {string} [config.baseUrl='http://localhost:3001'] - The base URL for the OnePass authorization server.
     */
    function OnePassClient(config = {}) {
        if (!config || !config.clientId) {
            throw new Error('OnePass SDK: clientId is required for initialization.');
        }
        this.clientId = config.clientId;

        // --- تحسين: تحديد الرابط الأساسي ديناميكياً ---
        // 1. استخدم الرابط المخصص إذا تم توفيره.
        // 2. إذا لم يتم توفيره، حاول تحديده من رابط ملف الـ SDK نفسه.
        // 3. إذا فشل كل شيء، استخدم الرابط الافتراضي لبيئة التطوير.
        let baseUrl = config.baseUrl;
        // **تحسين:** تم تثبيت الرابط الافتراضي على 3001 لتجنب الالتباس مع خادم الواجهة الأمامية.
        // الكود السابق كان يحاول تحديد الرابط تلقائياً، مما قد يؤدي إلى استخدام 3000 عن طريق الخطأ.
        // لا يزال بإمكان المطورين تخصيصه عبر `baseUrl` في الإعدادات.
        baseUrl = baseUrl || 'http://localhost:3001';

        this.authorizeUrl = `${baseUrl}/api/oauth/authorize`;
        this.tokenUrl = `${baseUrl}/api/oauth/token`;
        this.userInfoUrl = `${baseUrl}/api/oauth/userinfo`;
        
        // Use a provided baseUrl or default to the development server.
        // This is more explicit and avoids potential issues with auto-detection.
        this.baseUrl = config.baseUrl || 'http://localhost:3001';
        this.authorizeUrl = `${this.baseUrl}/api/oauth/authorize`;
        this.tokenUrl = `${this.baseUrl}/api/oauth/token`;
        this.userInfoUrl = `${this.baseUrl}/api/oauth/userinfo`;
    }

    // --- PKCE Helper Functions ---

    /**
     * Generates a cryptographically secure random string for the code verifier.
     * @param {number} length - The length of the string to generate.
     * @returns {string} A random string.
     */
    function generateCodeVerifier(length) {
        const array = new Uint32Array(length / 2);
        window.crypto.getRandomValues(array);
        return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
    }

    /**
     * Hashes the code verifier to create the code challenge.
     * @param {string} verifier - The code verifier string.
     * @returns {Promise<string>} The base64-url-encoded SHA-256 hash.
     */
    async function generateCodeChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        // Base64-URL encode
        return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * Initiates the sign-in process by redirecting the user to the OnePass authorization page.
     * @param {object} options - Configuration for the sign-in request.
     * @param {string} [options.scope='read:user'] - The requested scopes, space-separated.
     * @returns {Promise<object>} A promise that resolves with the user information object.
     * @param {string} [options.scope='read:user'] - The requested scopes (space-separated).
     * @returns {Promise<{tokenData: object, userInfo: object}>} A promise that resolves with token and user info.
     */
    OnePassClient.prototype.signIn = function(options = {}) {
        return new Promise(async (resolve, reject) => {
            // 1. Generate a secure state for CSRF protection.
            const state = generateCodeVerifier(40);
            try {
                // 1. Generate state for CSRF protection and PKCE values.
                const state = generateCodeVerifier(40);
                const codeVerifier = generateCodeVerifier(128);
                const codeChallenge = await generateCodeChallenge(codeVerifier);

            // 2. Conditionally generate PKCE parameters.
            // PKCE is highly recommended, but we can make it optional for non-secure development environments.
            const usePKCE = !!(window.crypto && window.crypto.subtle);
            let codeVerifier = null;
            let codeChallenge = null;

            if (usePKCE) {
                codeVerifier = generateCodeVerifier(128);
                codeChallenge = await generateCodeChallenge(codeVerifier);
            } else {
                console.warn('OnePass SDK: Crypto API not available. Proceeding without PKCE. This is not recommended for production environments.');
            }

            try {
                // Use sessionStorage to store state and verifier. It's more secure as it's tab-specific and clears on close.
                // 2. Store state and verifier in sessionStorage. It's tab-specific and clears on close.
                sessionStorage.setItem(STATE_STORAGE_KEY, state);
                sessionStorage.setItem(PKCE_STORAGE_KEY, codeVerifier);
            } catch (e) {
                return reject(new Error('OnePass SDK: Could not write to sessionStorage. The SDK may not work in private browsing mode.'));
            }

            // 3. Construct the authorization URL for the popup.
            // **تصحيح نهائي:** استخدام رابط نظيف بدون معلمات لتجنب مشاكل إعادة التحميل غير المتوقعة.
            // سيتم تمرير المعلمات الأخرى (clientId, scopes) عبر sessionStorage.
            const popupRedirectUri = window.location.href.split('?')[0];
            const params = new URLSearchParams({
                response_type: 'code',
                client_id: this.clientId,
                redirect_uri: popupRedirectUri,
                scope: options.scope || 'read:user', // Default to 'read:user' if no scope is provided
                state: state,
                display: 'popup',
            });
                // 3. Construct the authorization URL for the popup.
                // Using a clean redirect URI (without query params) prevents the main page from
                // reloading and clearing sessionStorage, which would invalidate the state.
                const popupRedirectUri = window.location.href.split('?')[0];
                const params = new URLSearchParams({
                    response_type: 'code',
                    client_id: this.clientId,
                    redirect_uri: popupRedirectUri,
                    scope: options.scope || 'read:user',
                    state: state,
                    display: 'popup',
                    code_challenge: codeChallenge,
                    code_challenge_method: 'S256',
                });

            if (usePKCE) {
                params.set('code_challenge', codeChallenge);
                params.set('code_challenge_method', 'S256');
            }
                const url = `${this.authorizeUrl}?${params.toString()}`;

            const url = `${this.authorizeUrl}?${params.toString()}`;
                // 4. Open the popup window.
                const popup = window.open(url, 'onepass-signin', `width=600,height=700,top=${(window.innerHeight/2)-350},left=${(window.innerWidth/2)-300}`);

            // 4. Open the popup window.
            const popup = window.open(url, 'onepass-signin', `width=600,height=700,top=${(window.innerHeight/2)-350},left=${(window.innerWidth/2)-300}`);
                // 5. Listen for messages from the popup.
                const messageListener = async (event) => {
                    // Ensure the message is from our own origin.
                    if (event.origin !== window.location.origin) {
                        return;
                    }

            // 5. Listen for messages from the popup.
            const messageListener = async (event) => {
                const popupOrigin = window.location.origin;
                if (event.origin !== popupOrigin) {
                    return;
                }
                if (event.data && event.data.type === 'onepass-auth-response') {
                    // **تصحيح:** إيقاف المؤقت فوراً عند استلام الرسالة لمنع حدوث سباق زمني.
                    clearInterval(timer);
                    window.removeEventListener('message', messageListener);
                    popup.close();
                    if (event.data && event.data.type === 'onepass-auth-response') {
                        // Stop listening for messages and close the popup.
                        clearInterval(timer);
                        window.removeEventListener('message', messageListener);
                        popup.close();

                    try {
                        if (event.data.error) {
                            throw new Error(`OnePass Error: ${event.data.error_description || event.data.error}`);
                        }
                        try {
                            if (event.data.error) {
                                throw new Error(`OnePass Error: ${event.data.error_description || event.data.error}`);
                            }

                        const storedState = sessionStorage.getItem(STATE_STORAGE_KEY);
                        const storedVerifier = usePKCE ? sessionStorage.getItem(PKCE_STORAGE_KEY) : null;
                            const storedState = sessionStorage.getItem(STATE_STORAGE_KEY);
                            const storedVerifier = sessionStorage.getItem(PKCE_STORAGE_KEY);

                        if (event.data.state !== storedState) {
                            throw new Error('OnePass SDK: Invalid state parameter. Possible CSRF attack. This can happen if the main page reloads during login.');
                        }
                            if (event.data.state !== storedState) {
                                throw new Error('OnePass SDK: Invalid state parameter. Possible CSRF attack.');
                            }

                        // **CRITICAL FIX:** Pass the *original* clean redirect URI to the token exchange function.
                        // Using the main window's full URL here can cause an unnecessary page reload,
                        // which wipes sessionStorage and invalidates the state.
                        const tokenData = await this.exchangeCodeForToken(event.data.code, popupRedirectUri, storedVerifier, usePKCE);
                        const userInfo = await this.getUserInfo(tokenData.access_token);
                            const tokenData = await this.exchangeCodeForToken(event.data.code, popupRedirectUri, storedVerifier);
                            const userInfo = await this.getUserInfo(tokenData.access_token);

                        resolve({ tokenData, userInfo });
                            resolve({ tokenData, userInfo });

                    } catch (error) {
                        reject(error);
                    } finally {
                        sessionStorage.removeItem(STATE_STORAGE_KEY);
                        if (usePKCE) sessionStorage.removeItem(PKCE_STORAGE_KEY);
                        } catch (error) {
                            reject(error);
                        } finally {
                            // Clean up storage regardless of outcome.
                            sessionStorage.removeItem(STATE_STORAGE_KEY);
                            sessionStorage.removeItem(PKCE_STORAGE_KEY);
                        }
                    }
                }
            };
            window.addEventListener('message', messageListener);
                };
                window.addEventListener('message', messageListener);

            // Handle the case where the user closes the popup manually.
            const timer = setInterval(() => { // **تحسين:** إضافة تحقق من وجود النافذة.
                if (!popup || popup.closed) {
                    clearInterval(timer);
                    window.removeEventListener('message', messageListener);
                    reject(new Error('OnePass SDK: Sign-in window closed by user.'));
                }
            }, 500);
                // Handle the case where the user closes the popup manually.
                const timer = setInterval(() => {
                    if (!popup || popup.closed) {
                        clearInterval(timer);
                        window.removeEventListener('message', messageListener);
                        reject(new Error('OnePass SDK: Sign-in window closed by user.'));
                    }
                }, 500);

            } catch (e) {
                reject(new Error(`OnePass SDK: Initialization failed. ${e.message}`));
            }
        });
    };

    /**
     * Exchanges an authorization code for an access token.
     * This is now an internal part of the SDK.
     * @param {string} code - The authorization code.
     * @param {string} redirectUri - The redirect URI used in the initial request.
     * @param {string|null} codeVerifier - The PKCE code verifier.
     * @param {boolean} usePKCE - Flag indicating if PKCE is being used.
     * @param {string} codeVerifier - The PKCE code verifier.
     * @returns {Promise<object>} A promise that resolves with the token data.
     * @private
     */
    OnePassClient.prototype.exchangeCodeForToken = function(code, redirectUri, codeVerifier, usePKCE) {
    OnePassClient.prototype.exchangeCodeForToken = function(code, redirectUri, codeVerifier) {
        const payload = {
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
            client_id: this.clientId,
        };

        if (usePKCE && codeVerifier) {
            payload.code_verifier = codeVerifier;
            console.log('SDK: Sending code_verifier to /token endpoint:', codeVerifier); // Added for debugging
        }
        payload.code_verifier = codeVerifier;

        return fetch(this.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).then(response => {
            return response.json().then(data => {
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to exchange code for token.');
                }
                return data;
            });
        });
    };

    /**
     * Fetches user information using an access token.
     * This is now an internal part of the SDK.
     * @param {string} accessToken - The access token.
     * @returns {Promise<object>} A promise that resolves with the user info.
     * @private
     */
    OnePassClient.prototype.getUserInfo = function(accessToken) {
        return fetch(this.userInfoUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        }).then(response => {
            return response.json().then(data => {
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch user information.');
                }
                return data;
            });
        });
    };

     /**
      * Renders a "Sign in with OnePass" button into a target element.
      * @param {string|HTMLElement} target - The CSS selector or HTML element to render the button into.
      * @param {object} [options] - Configuration for the button and sign-in flow.
      * @param {string} options.clientId - The Client ID for your application.
      * @param {string} [options.theme='filled'] - The button theme ('filled' or 'outline').
      * @param {string} [options.shape='rect'] - The button shape ('rect' or 'circle').
      * @param {string} [options.size='medium'] - The button size ('small', 'medium', 'large').
      * @param {string} [options.text='تسجيل الدخول مع OnePass'] - The button text (for rect shape).
      * @param {string} [options.scope='read:user'] - The requested scopes.
      * @param {function} options.onSuccess - Callback function on successful sign-in. Receives an object with tokenData and userInfo.
      * @param {function} options.onError - Callback function on sign-in failure. Receives an error.
      */
    function renderButton(target, options = {}) {
        const targetElement = typeof target === 'string' ? document.querySelector(target) : target;

        if (!targetElement) {
            console.error('OnePass SDK: Target element for renderButton not found.');
            return;
        }
        
        if (!options.clientId) {
            console.error('OnePass SDK: `clientId` is required in the options for renderButton.');
            targetElement.innerHTML = '<p style="color: red;">Error: OnePass Client ID is missing.</p>';
            return;
        }

        // Create a client instance internally
        const client = new OnePassClient({ clientId: options.clientId });

        const theme = options.theme || 'filled';
        const shape = options.shape || 'rect';
        const size = options.size || 'medium';
        const text = options.text || 'تسجيل الدخول مع OnePass';
        const scope = options.scope || 'read:user';
        const onSuccess = options.onSuccess || function(result) { console.log('OnePass Success:', result); };
        const onError = options.onError || function(error) { console.error('OnePass Error:', error); };

        // --- Button Styling ---
        // We will use CSS classes to match the design in Documentation.html
        const button = document.createElement('button');
        button.className = 'flex items-center justify-center gap-2.5 font-semibold cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';

        // Apply size-specific styles
        if (shape === 'circle') {
            switch (size) {
                case 'small':
                    button.classList.add('p-2', 'rounded-full');
                    break;
                case 'large':
                    button.classList.add('p-3', 'rounded-full');
                    break;
                default: // medium
                    button.classList.add('p-2.5', 'rounded-full');
                    break;
            }
        } else {
            switch (size) {
                case 'small':
                    button.classList.add('px-3', 'py-2', 'text-sm', 'rounded-md');
                    break;
                case 'large':
                    button.classList.add('px-6', 'py-3', 'text-lg', 'rounded-lg');
                    break;
                default: // medium
                    button.classList.add('px-4', 'py-2.5', 'text-sm', 'rounded-lg');
                    break;
            }
        }

        if (theme === 'filled') {
            button.classList.add('text-white', 'brand-gradient', 'hover:opacity-90');
        } else { // outline
            button.classList.add('text-gray-700', 'bg-white', 'border', 'border-gray-300', 'hover:bg-gray-50');
        }

        // --- Icon and Text ---
        const iconSize = size === 'large' ? 24 : (size === 'small' ? 16 : 20);
        const iconSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${theme === 'outline' ? 'text-indigo-600' : ''}">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
        `;

        if (shape === 'circle') {
            button.innerHTML = iconSvg;
        } else {
            button.innerHTML = `${iconSvg}<span>${text}</span>`;
        }

        // --- Event Listener ---
        button.addEventListener('click', () => {
            button.disabled = true;
            const originalContent = button.innerHTML;
            const spinnerSize = size === 'large' ? 24 : (size === 'small' ? 16 : 20);
            
            button.innerHTML = `
                <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="${spinnerSize}" height="${spinnerSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span>جاري...</span>
            `;

            client.signIn({ scope: scope })
                .then(onSuccess)
                .catch(onError)
                .finally(() => {
                    button.disabled = false;
                    button.innerHTML = originalContent;
                });
        });

        // Clear target and append button
        targetElement.innerHTML = '';
        targetElement.appendChild(button);
    }

    /**
     * Initializes the OnePass SDK and returns a client instance.
     * @param {object} config - Configuration object.
     * @returns {OnePassClient} An instance of the OnePass client.
     */
    function init(config) {
        return new OnePassClient(config);
    }

    // Expose the init function to the global window object.
    window.onepass = {
        init: init,
        renderButton: renderButton // Expose the new main function
    };

})(window);