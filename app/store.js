/**
 * app/store.js — Shared data layer for the Krea 2 Turbo Style Explorer.
 * Provides style-library loading, keyword search/scoring, "similar styles",
 * moodboard loading, and shared UI helpers (toast, clipboard, escaping).
 *
 * Exposes a single global: window.StyleStore
 */
(function () {
    'use strict';

    const StyleStore = {};

    // ---- Style library ----
    let allStyles = [];
    let allItemsMap = new Map(); // id -> { id, prompt, folder, image }

    /**
     * Load the style library from the global `galleryData` (defined in app/data.js).
     * Returns the array of normalized style objects.
     */
    StyleStore.init = function () {
        if (typeof galleryData === 'undefined') {
            console.warn('[StyleStore] galleryData not found. Is app/data.js loaded?');
            return [];
        }
        allStyles = galleryData.map((item, idx) => {
            const prompt = item.prompt || '';
            const words = prompt.split(/\s+/).filter(w => w.length > 0);
            const name = words.length > 0 ? words[0] + (words.length > 1 ? ' Style' : '') : 'Style';
            allStyles.push({
                id: String(item.id),
                prompt: item.prompt,
                folder: item.folder,
                index: idx,
                stars: item.stars || 0,
                name: name,
                descriptor: prompt,
                categories: item.categories || []
            });
        });
        allStyles = allStyles.filter(s => s.id); // remove any undefined
        allItemsMap = new Map(allStyles.map(s => [s.id, s]));
        return allStyles;
    };

    StyleStore.getAll = function () {
        return allStyles;
    };

    StyleStore.getById = function (id) {
        return allItemsMap.get(String(id)) || null;
    };

    StyleStore.getImagePath = function (id, folder) {
        return `images/${folder}/${String(id)}.webp`;
    };

    // ---- Keyword search / scoring ----
    // Tokenize a prompt into meaningful words (length > 2, alphanumeric).
    function tokenize(text) {
        return String(text || '')
            .toLowerCase()
            .split(/[\s,.\n;:()\[\]'"!?]+/)
            .map(w => w.replace(/[^a-z0-9]/g, ''))
            .filter(w => w.length > 2);
    }

    // Score a single style against a list of keywords.
    function scoreStyle(style, keywords) {
        const prompt = style.prompt.toLowerCase();
        let score = 0;
        const matched = [];

        keywords.forEach(kw => {
            const lower = kw.toLowerCase();
            if (prompt.includes(lower)) {
                score += 3;
                matched.push(lower);
            }
            // Word-boundary bonus for multi-word keywords
            const words = lower.split(/\s+/);
            words.forEach(w => {
                if (w.length > 2 && prompt.includes(w)) {
                    score += 1.5;
                    matched.push(w);
                }
            });
        });

        return { score, matched };
    }

    /**
     * Search the library by a query string or array of keywords.
     * @param {string|string[]} query
     * @param {number} limit
     * @returns {Array<{style, score, matched}>}
     */
    StyleStore.search = function (query, limit) {
        const keywords = Array.isArray(query)
            ? query
            : tokenize(query);

        if (!keywords.length) return [];

        const results = allStyles.map(style => {
            const { score, matched } = scoreStyle(style, keywords);
            return { style, score, matched };
        }).filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit || 50);

        return results;
    };

    /**
     * Find styles similar to a given style id, based on shared keyword overlap.
     * @param {string} id
     * @param {number} limit
     * @returns {Array<{style, score, shared}>}
     */
    StyleStore.similar = function (id, limit) {
        const target = allItemsMap.get(String(id));
        if (!target) return [];

        const targetTokens = new Set(tokenize(target.prompt));
        if (!targetTokens.size) return [];

        const results = allStyles
            .filter(s => s.id !== target.id)
            .map(style => {
                const styleTokens = new Set(tokenize(style.prompt));
                let shared = 0;
                styleTokens.forEach(t => {
                    if (targetTokens.has(t)) shared++;
                });
                return { style, score: shared, shared };
            })
            .filter(r => r.shared > 0)
            .sort((a, b) => b.shared - a.shared)
            .slice(0, limit || 12);

        return results;
    };

    // ---- Moodboards ----
    let moodboards = [];

    /**
     * Load moodboards from krea_moodboards.json (fetched at runtime).
     * Falls back gracefully if the file is missing or the fetch fails.
     * @returns {Promise<Array>}
     */
    StyleStore.loadMoodboards = async function () {
        if (moodboards.length) return moodboards;
        try {
            const res = await fetch('krea_moodboards.json');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            moodboards = Array.isArray(data) ? data : (data.moodboards || []);
        } catch (e) {
            console.warn('[StyleStore] Could not load moodboards:', e);
            moodboards = [];
        }
        return moodboards;
    };

    StyleStore.getMoodboards = function () {
        return moodboards;
    };

    // ---- Shared UI helpers ----
    StyleStore.escapeHtml = function (str) {
        const div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    };

    StyleStore.escapeAttr = function (str) {
        // Hex-escaped entity strings to survive auto-formatting (& " < > ')
        const AMP = '\x26amp;';
        const QUOT = '\x26quot;';
        const LT = '\x26lt;';
        const GT = '\x26gt;';
        const APOS = '\x26\x2339;';
        return String(str == null ? '' : str)
            .replace(/&/g, AMP)
            .replace(/"/g, QUOT)
            .replace(/'/g, APOS)
            .replace(/</g, LT)
            .replace(/>/g, GT);
    };

    StyleStore.copyToClipboard = function (text, onDone) {
        const done = () => { if (onDone) onDone(); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => {
                StyleStore.fallbackCopy(text, done);
            });
        } else {
            StyleStore.fallbackCopy(text, done);
        }
    };

    StyleStore.fallbackCopy = function (text, onDone) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            if (onDone) onDone();
        } catch (e) {
            console.warn('Copy failed:', e);
        }
        document.body.removeChild(ta);
    };

    StyleStore.showToast = function (message, duration) {
        const toast = document.getElementById('toast-notification')
            || document.getElementById('toast')
            || document.getElementById('studio-toast')
            || document.getElementById('admin-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toast._t);
        toast._t = setTimeout(() => toast.classList.remove('show'), duration || 2500);
    };

    // Expose
    window.StyleStore = StyleStore;
})();