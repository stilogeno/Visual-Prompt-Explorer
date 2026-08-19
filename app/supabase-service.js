window.appSupabase = (function () {
    // ============================================================
    // Local Supabase Configuration
    // ============================================================
    // Configure these values via the Admin page or .env file.
    // Defaults are empty — the app will prompt for configuration.

    let SUPABASE_URL = '';
    let SUPABASE_ANON_KEY = '';

    // Local LLM provider (Ollama, LM Studio, etc.) — configure via Admin page
    const LOCAL_OMLX_URL = '';

    // No cloud Supabase - everything runs locally

    // A real Supabase anon key is a JWT (three dot-separated base64 segments, ~200+ chars).
    // We refuse to override the working default with obviously-invalid values so a stale
    // or truncated key saved in localStorage can't break sync.
    function isValidKey(key) {
        return typeof key === 'string'
            && key.length > 100
            && key.split('.').length === 3
            && !key.includes('...');
    }

    function setConfig(url, key) {
        if (url && url.startsWith('http://')) SUPABASE_URL = url;
        if (key && isValidKey(key)) SUPABASE_ANON_KEY = key;
    }

    // Detect environment - always uses local Supabase on laptop
    function detectEnvironment() {
        return 'local';
    }

    let _enableSync = true;
    let supabase = null;

    function setSyncEnabled(enabled) {
        _enableSync = enabled;
    }

    function isSyncEnabled() {
        return _enableSync;
    }

    function isConnected() {
        return !!supabase;
    }

    function init() {
        // Read admin settings from localStorage
        const SETTINGS_KEY = 'krea_admin_settings';
        let settings = {};

        try {
            const stored = localStorage.getItem(SETTINGS_KEY);
            if (stored) {
                settings = JSON.parse(stored);
            }
        } catch(e) {}

        // Use settings if available, otherwise use empty defaults
        const url = settings.supabaseUrl || '';
        const key = settings.supabaseKey || '';

        console.log('[Supabase] Using Supabase instance:', url);

        if (window.supabase) {
            try {
                supabase = window.supabase.createClient(url, key);
                console.log('[Supabase] Connected to:', url);
            } catch (e) {
                console.warn('[Supabase] Failed to initialize client:', e);
            }
        } else {
            console.warn('[Supabase] SDK script not found. Running in local-only mode.');
        }
    }

    function getUserId() {
        let id = localStorage.getItem('krea_user_uuid');
        if (!id) {
            id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            localStorage.setItem('krea_user_uuid', id);
        }
        return id;
    }

    async function syncFavorite(cardId, rating) {
        if (!rating) {
            if (!isSyncEnabled() || !supabase) return;

            try {
                const userId = getUserId();
                const { error } = await supabase
                    .from('user_favorites')
                    .delete()
                    .eq('user_id', userId)
                    .eq('card_id', String(cardId));

                if (error) console.warn('[Supabase] Sync warning:', error.message);
            } catch (err) {
                console.warn('[Supabase] Network sync failed:', err);
            }
        } else {
            if (!isSyncEnabled() || !supabase) return;

            try {
                const userId = getUserId();
                const { error } = await supabase
                    .from('user_favorites')
                    .upsert({
                        user_id: userId,
                        card_id: String(cardId),
                        rating: rating,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id,card_id' });

                if (error) console.warn('[Supabase] Sync warning:', error.message);
            } catch (err) {
                console.warn('[Supabase] Network sync failed:', err);
            }
        }
    }

    async function fetchGlobalCounts() {
        if (!supabase) return new Map();

        try {
            const { data, error } = await supabase
                .from('card_favorite_counts')
                .select('card_id, total_favs');

            if (error) throw error;

            const countsMap = new Map();
            if (data && Array.isArray(data)) {
                data.forEach(row => {
                    countsMap.set(String(row.card_id), row.total_favs);
                });
            }
            return countsMap;
        } catch (err) {
            console.warn('[Supabase] Failed to fetch global counts:', err);
            return new Map();
        }
    }

    let _bannerVisible = false;
    let _connectionAttempts = 0;
    const MAX_CONNECTION_ATTEMPTS = 3;

    function showBanner() {
        if (typeof document !== 'undefined') {
            const banner = document.getElementById('supabase-banner');
            if (banner) {
                banner.style.display = 'flex';
                _bannerVisible = true;
            }
        }
    }

    function hideBanner() {
        if (typeof document !== 'undefined') {
            const banner = document.getElementById('supabase-banner');
            if (banner) {
                banner.style.display = 'none';
                _bannerVisible = false;
            }
        }
    }

    return {
        init,
        syncFavorite,
        fetchGlobalCounts,
        setSyncEnabled,
        setConfig,
        isConnected,
        isLocalEnvironment: function() {
            return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        },
        getOmlxUrl: function() { return LOCAL_OMLX_URL; },
        showBanner,
        hideBanner
    };
})();