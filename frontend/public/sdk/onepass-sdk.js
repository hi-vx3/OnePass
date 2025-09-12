/**
 * OnePass JavaScript SDK
 * Version: 1.0.0
 * Description: A lightweight library to simplify the OnePass OAuth2 integration for third-party developers.
 */
(function(window) {
    'use strict';

    // Avoid re-initialization
    if (window.onepass) {
        return;
    }

    const ONEPASS_AUTHORIZE_URL = 'http://localhost:3001/api/oauth/authorize'; // Default URL, can be overridden
    const ONEPASS_TOKEN_URL = 'http://localhost:3001/api/oauth/token'; // Default token URL
    const ONEPASS_USERINFO_URL = 'http://localhost:3001/api/oauth/userinfo'; // Default userinfo URL

    /**
     * The main OnePass client object.
     * @param {object} config - Configuration object.
     * @param {string} config.clientId - The Client ID obtained from the OnePass developer dashboard.
     * @param {string} [config.authorizeUrl] - The base URL for the OnePass authorization server.
     */
    function OnePassClient(config) {
        if (!config || !config.clientId) {
            throw new Error('OnePass SDK: clientId is required for initialization.');
        }
        this.clientId = config.clientId;
        this.authorizeUrl = config.authorizeUrl || ONEPASS_AUTHORIZE_URL;
        this.tokenUrl = config.tokenUrl || ONEPASS_TOKEN_URL;
        this.userInfoUrl = config.userInfoUrl || ONEPASS_USERINFO_URL;
    }

    // --- PKCE Helper Functions ---
    function generateRandomString(length) {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        let text = '';
        for (let i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

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
     */
    OnePassClient.prototype.signIn = function(options = {}) {
        return new Promise(async (resolve, reject) => {
            // 1. Generate a cryptographically secure random state for CSRF protection.
            const state = window.crypto.getRandomValues(new Uint32Array(4)).join('-');

            // 2. Conditionally generate PKCE parameters
            let codeVerifier = null;
            let codeChallenge = null;
            const usePKCE = window.crypto && window.crypto.subtle; // Check if the API is available

            if (usePKCE) {
                codeVerifier = generateRandomString(128);
                codeChallenge = await generateCodeChallenge(codeVerifier);
            } else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                // If not on localhost and crypto is not available, fail with a clear error.
                return reject(new Error('OnePass SDK: Crypto API is not available. PKCE is required and needs a secure context (HTTPS).'));
            }
            // If on localhost and crypto is not available, we proceed without PKCE.

            try {
                localStorage.setItem('onepass_oauth_state', state);
                if (usePKCE) {
                    localStorage.setItem('onepass_code_verifier', codeVerifier);
                }
            } catch (e) {
                return reject(new Error('OnePass SDK: Could not write to localStorage. The SDK may not work in private browsing mode.'));
            }

            // 3. Construct the authorization URL for the popup.
            const frontendOrigin = 'http://localhost:3000';
            const popupRedirectUri = new URL('/dev/test-oauth.html', frontendOrigin).href;
            const params = new URLSearchParams({
                response_type: 'code',
                client_id: this.clientId,
                redirect_uri: popupRedirectUri,
                scope: options.scope || 'read:user', // Default to 'read:user' if no scope is provided
                state: state,
                display: 'popup',
            });

            if (usePKCE) {
                params.set('code_challenge', codeChallenge);
                params.set('code_challenge_method', 'S256');
            }

            const url = `${this.authorizeUrl}?${params.toString()}`;

            // 4. Open the popup window.
            const popup = window.open(url, 'onepass-signin', `width=600,height=700,top=${(window.innerHeight/2)-350},left=${(window.innerWidth/2)-300}`);

            // 5. Listen for messages from the popup.
            const messageListener = (event) => {
                const popupOrigin = new URL(popupRedirectUri).origin;
                if (event.origin !== popupOrigin) {
                    return;
                }
                if (event.data && event.data.type === 'onepass-auth-response') {
                    window.removeEventListener('message', messageListener);
                    popup.close();

                    if (event.data.error) {
                        reject(new Error(`OnePass Error: ${event.data.error_description || event.data.error}`));
                    } else {
                        // The handleRedirect logic is now integrated here for the popup flow.
                        const storedState = localStorage.getItem('onepass_oauth_state');
                        const storedVerifier = usePKCE ? localStorage.getItem('onepass_code_verifier') : null;
                        localStorage.removeItem('onepass_oauth_state');
                        if (usePKCE) {
                            localStorage.removeItem('onepass_code_verifier');
                        }

                        if (event.data.state !== storedState) {
                            reject(new Error('OnePass SDK: Invalid state parameter. Possible CSRF attack.'));
                        } else {
                            // Instead of resolving with the code, exchange it for a token.
                            // Pass the stored verifier, which will be null if PKCE is not used.
                            this.exchangeCodeForToken(event.data.code, popupRedirectUri, storedVerifier, usePKCE)
                                .then(tokenData => this.getUserInfo(tokenData.access_token))
                                .then(userInfo => resolve(userInfo))
                                .catch(tokenError => reject(tokenError));
                        }
                    }
                }
            };
            window.addEventListener('message', messageListener);

            // Handle the case where the user closes the popup manually.
            const timer = setInterval(() => {
                if (popup.closed) {
                    clearInterval(timer);
                    window.removeEventListener('message', messageListener);
                    reject(new Error('OnePass SDK: Sign-in window closed by user.'));
                }
            }, 500);
        });
    };

    /**
     * Exchanges an authorization code for an access token.
     * This is now an internal part of the SDK.
     * @param {string} code - The authorization code.
     * @param {string} redirectUri - The redirect URI used in the initial request.
     * @param {string|null} codeVerifier - The PKCE code verifier.
     * @param {boolean} usePKCE - Flag indicating if PKCE is being used.
     * @returns {Promise<object>} A promise that resolves with the token data.
     * @private
     */
    OnePassClient.prototype.exchangeCodeForToken = function(code, redirectUri, codeVerifier, usePKCE) {
        const payload = {
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
            client_id: this.clientId,
        };

        if (usePKCE) {
            payload.code_verifier = codeVerifier;
        }

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
     * Initializes the OnePass SDK and returns a client instance.
     * @param {object} config - Configuration object.
     * @returns {OnePassClient} An instance of the OnePass client.
     */
    function init(config) {
        return new OnePassClient(config);
    }

    // Expose the init function to the global window object.
    window.onepass = {
        init: init
    };

})(window);