/**
 * app/enhancements.js — Gallery enhancements for index.html:
 *   - URL state (shareable hash: #q=..., #sort=..., #min=...)
 *   - Keyboard shortcuts (S = star cycle, F = folders, C = compare toggle, ? = help)
 *   - Similar-styles modal + Compare view
 *   - Moodboard browser (krea_moodboards.json)
 *   - Batch operations (copy, clear ratings)
 *   - Quick stats panel
 *
 * Requires app/store.js and the app's window.appGlobals to be available.
 */
(function () {
    'use strict';

    const ST = window.StyleStore;
    const G = () => window.appGlobals;

    // Lazily build DOM once
    let rootEl, modalEl, compareBarEl, statsEl, moodboardEl;

    function ensureDom() {
        if (rootEl) return;
        rootEl = document.createElement('div');
        rootEl.className = 'kx-enhancements';

        // Modal (similar styles / compare)
        modalEl = document.createElement('div');
        modalEl.className = 'kx-modal';
        modalEl.style.display = 'none';
        rootEl.appendChild(modalEl);

        // Compare bar
        compareBarEl = document.createElement('div');
        compareBarEl.className = 'kx-compare-bar';
        compareBarEl.style.display = 'none';
        rootEl.appendChild(compareBarEl);

        // Stats panel
        statsEl = document.createElement('div');
        statsEl.className = 'kx-stats';
        statsEl.style.display = 'none';
        rootEl.appendChild(statsEl);

        // Moodboard panel
        moodboardEl = document.createElement('div');
        moodboardEl.className = 'kx-moodboard';
        moodboardEl.style.display = 'none';
        rootEl.appendChild(moodboardEl);

        document.body.appendChild(rootEl);
        injectCss();
    }

    function injectCss() {
        if (document.getElementById('kx-enhancements-css')) return;
        const style = document.createElement('style');
        style.id = 'kx-enhancements-css';
        style.textContent = `
            .kx-enhancements { position: fixed; z-index: 20000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            .kx-modal { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; padding: 20px; }
            .kx-modal-inner { background: var(--card-background, #1e1e2e); border: 1px solid var(--border-color, #444); border-radius: 14px; max-width: 900px; width: 100%; max-height: 80vh; overflow: auto; padding: 20px; }
            .kx-modal h3 { margin: 0 0 12px; }
            .kx-close { position: absolute; top: 0; right: 0; transform: translate(50%, -50%); background: var(--card-background, #1e1e2e); border: 1px solid var(--border-color, #444); color: var(--text-color, #eee); border-radius: 50%; width: 32px; height: 32px; cursor: pointer; }
            .kx-modal-inner { position: relative; }
            .kx-similar-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
            .kx-similar-card { border: 1px solid var(--border-color, #444); border-radius: 10px; overflow: hidden; cursor: pointer; }
            .kx-similar-card img { width: 100%; display: block; }
            .kx-similar-card .p { padding: 8px; font-size: 12px; color: var(--secondary-text-color, #aaa); }
            .kx-compare-bar { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: var(--card-background, #1e1e2e); border: 1px solid var(--border-color, #444); border-radius: 12px; padding: 10px 16px; display: flex; gap: 10px; align-items: center; box-shadow: 0 8px 24px rgba(0,0,0,.5); }
            .kx-stats { position: fixed; top: 12px; right: 12px; background: var(--card-background, #1e1e2e); border: 1px solid var(--border-color, #444); border-radius: 12px; padding: 14px 18px; font-size: 13px; min-width: 200px; box-shadow: 0 8px 24px rgba(0,0,0,.5); }
            .kx-stats table { width: 100%; border-collapse: collapse; }
            .kx-stats td { padding: 3px 0; }
            .kx-stats td:last-child { text-align: right; font-weight: 600; }
            .kx-moodboard { position: fixed; inset: 0; background: rgba(0,0,0,.75); display: flex; align-items: center; justify-content: center; padding: 20px; }
            .kx-moodboard-inner { background: var(--card-background, #1e1e2e); border: 1px solid var(--border-color, #444); border-radius: 14px; max-width: 980px; width: 100%; max-height: 82vh; overflow: auto; padding: 20px; }
            .kx-moodboard-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-top: 12px; }
            .kx-moodboard-card { border: 1px solid var(--border-color, #444); border-radius: 10px; overflow: hidden; }
            .kx-moodboard-card img { width: 100%; display: block; }
            .kx-moodboard-card .m { padding: 8px; font-size: 12px; color: var(--secondary-text-color, #aaa); }
            .kx-btn { padding: 6px 12px; border: 1px solid var(--border-color, #444); border-radius: 8px; background: var(--background-color, #151520); color: var(--text-color, #eee); font-size: 13px; cursor: pointer; }
            .kx-btn:hover { border-color: var(--accent-color, #7c6cff); }
            .kx-help { position: fixed; bottom: 16px; right: 16px; background: var(--card-background, #1e1e2e); border: 1px solid var(--border-color, #444); border-radius: 12px; padding: 12px 16px; font-size: 13px; z-index: 20010; }
        `;
        document.head.appendChild(style);
    }

    // ---- URL state ----
    function parseHash() {
        const out = {};
        const raw = window.location.hash.replace(/^#/, '');
        if (!raw) return out;
        raw.split('&').forEach(pair => {
            const [k, v] = pair.split('=');
            if (k && v) out[decodeURIComponent(k)] = decodeURIComponent(v);
        });
        return out;
    }

    function applyUrlState() {
        const state = parseHash();
        const g = G();
        if (!g) return;

        if (state.q) {
            const input = document.getElementById('search-input');
            if (input && input.value !== state.q) {
                input.value = state.q;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        if (state.min) {
            const sel = document.getElementById('star-filter-min');
            if (sel && sel.value !== state.min) {
                sel.value = state.min;
                if (g.starFilterMin !== undefined) g.starFilterMin = state.min;
            }
        }
        if (state.sort === 'random') {
            document.getElementById('sort-by-random')?.click();
        }
    }

    function updateUrlState() {
        const g = G();
        if (!g) return;
        const parts = [];
        if (g.searchTerm) parts.push('q=' + encodeURIComponent(g.searchTerm));
        if (g.starFilterMin && g.starFilterMin !== '0') parts.push('min=' + encodeURIComponent(g.starFilterMin));
        if (window.__kxRandom) parts.push('sort=random');
        else if (window.__kxSort) parts.push('sort=' + window.__kxSort);
        const hash = parts.join('&');
        if (window.location.hash !== (hash ? '#' + hash : '')) {
            history.replaceState(null, '', hash ? '#' + hash : window.location.pathname + window.location.search);
        }
    }

    // ---- Similar styles modal ----
    function openSimilarModal(id) {
        ensureDom();
        const g = G();
        const results = ST.similar(id, 12);
        const base = ST.getById(id);

        modalEl.innerHTML = '';
        modalEl.style.display = 'flex';

        const inner = document.createElement('div');
        inner.className = 'kx-modal-inner';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'kx-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => { modalEl.style.display = 'none'; });

        const title = document.createElement('h3');
        title.textContent = base ? `Similar to: ${base.prompt.slice(0, 60)}…` : 'Similar styles';

        inner.appendChild(closeBtn);
        inner.appendChild(title);

        if (results.length === 0) {
            const p = document.createElement('p');
            p.textContent = 'No close matches found.';
            p.style.color = 'var(--secondary-text-color)';
            inner.appendChild(p);
        } else {
            const grid = document.createElement('div');
            grid.className = 'kx-similar-grid';
            results.forEach(r => {
                const card = document.createElement('div');
                card.className = 'kx-similar-card';
                const img = document.createElement('img');
                img.src = ST.getImagePath(r.style.id, r.style.folder);
                img.alt = r.style.prompt.slice(0, 40);
                img.loading = 'lazy';
                const p = document.createElement('div');
                p.className = 'p';
                p.textContent = r.style.prompt.split(',').slice(0, 3).join(', ') + '…';
                card.appendChild(img);
                card.appendChild(p);
                card.addEventListener('click', () => {
                    ST.copyToClipboard('Style: ' + r.style.prompt, () => ST.showToast('Prompt copied!'));
                });
                grid.appendChild(card);
            });
            inner.appendChild(grid);
        }

        modalEl.appendChild(inner);

        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) modalEl.style.display = 'none';
        }, { once: true });
    }

    function openImageModal(card) {
        ensureDom();
        const img = card?.querySelector('.card__image');
        if (!img) return;
        const prompt = card?.dataset.artist || '';
        modalEl.innerHTML = '';
        modalEl.style.display = 'flex';
        const inner = document.createElement('div');
        inner.className = 'kx-modal-inner';
        inner.style.maxWidth = '480px';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'kx-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => { modalEl.style.display = 'none'; });
        const full = document.createElement('img');
        full.src = img.src;
        full.style.width = '100%';
        full.style.borderRadius = '8px';
        inner.appendChild(closeBtn);
        inner.appendChild(full);

        if (prompt) {
            const promptLabel = document.createElement('div');
            promptLabel.textContent = 'Prompt';
            promptLabel.style.fontSize = '11px';
            promptLabel.style.textTransform = 'uppercase';
            promptLabel.style.letterSpacing = '0.5px';
            promptLabel.style.color = 'var(--secondary-text-color, #aaa)';
            promptLabel.style.marginTop = '14px';
            promptLabel.style.marginBottom = '6px';
            inner.appendChild(promptLabel);

            const promptText = document.createElement('div');
            promptText.textContent = prompt;
            promptText.style.fontSize = '13px';
            promptText.style.lineHeight = '1.6';
            promptText.style.color = 'var(--text-color, #eee)';
            promptText.style.wordBreak = 'break-word';
            promptText.style.marginBottom = '12px';
            inner.appendChild(promptText);

            const copyBtn = document.createElement('button');
            copyBtn.className = 'kx-btn';
            copyBtn.textContent = '📋 Copy prompt';
            copyBtn.addEventListener('click', () => {
                ST.copyToClipboard('Style: ' + prompt, () => ST.showToast('Prompt copied!'));
            });
            inner.appendChild(copyBtn);
        }

        modalEl.appendChild(inner);
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) modalEl.style.display = 'none';
        }, { once: true });
    }

    // ---- Compare ----
    const compareIds = new Set();
    let compareDest = document.createElement('div');

    function addToCompare(id) {
        if (compareIds.has(id)) {
            ST.showToast('Already in compare.');
            return;
        }
        compareIds.add(id);
        updateCompareBar();
    }

    function updateCompareBar() {
        ensureDom();
        if (compareIds.size === 0) {
            compareBarEl.style.display = 'none';
            return;
        }
        compareBarEl.style.display = 'flex';
        compareBarEl.innerHTML = '';
        const label = document.createElement('span');
        label.textContent = `${compareIds.size} selected`;
        compareBarEl.appendChild(label);

        const btnCompare = document.createElement('button');
        btnCompare.className = 'kx-btn';
        btnCompare.textContent = '⚖ Compare';
        btnCompare.addEventListener('click', () => {
            openCompareModal();
        });
        compareBarEl.appendChild(btnCompare);

        const btnClear = document.createElement('button');
        btnClear.className = 'kx-btn';
        btnClear.textContent = '✕ Clear';
        btnClear.addEventListener('click', () => {
            compareIds.clear();
            updateCompareBar();
        });
        compareBarEl.appendChild(btnClear);
    }

    function openCompareModal() {
        ensureDom();
        if (compareIds.size < 2) {
            ST.showToast('Select at least 2 styles to compare.');
            return;
        }

        modalEl.innerHTML = '';
        modalEl.style.display = 'flex';

        const inner = document.createElement('div');
        inner.className = 'kx-modal-inner';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'kx-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => { modalEl.style.display = 'none'; });

        const title = document.createElement('h3');
        title.textContent = `Comparing ${compareIds.size} styles`;

        inner.appendChild(closeBtn);
        inner.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'kx-similar-grid';

        compareIds.forEach(id => {
            const style = ST.getById(id);
            if (!style) return;
            const card = document.createElement('div');
            card.className = 'kx-similar-card';
            const img = document.createElement('img');
            img.src = ST.getImagePath(style.id, style.folder);
            img.alt = style.prompt.slice(0, 40);
            img.loading = 'lazy';
            const p = document.createElement('div');
            p.className = 'p';
            p.textContent = style.prompt;
            card.appendChild(img);
            card.appendChild(p);
            grid.appendChild(card);
        });

        inner.appendChild(grid);
        modalEl.appendChild(inner);
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) modalEl.style.display = 'none';
        }, { once: true });
    }

    // ---- Moodboards ----
    function openMoodboards() {
        ensureDom();
        ST.loadMoodboards().then(list => {
            moodboardEl.innerHTML = '';
            moodboardEl.style.display = 'flex';

            const inner = document.createElement('div');
            inner.className = 'kx-moodboard-inner';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'kx-close';
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', () => { moodboardEl.style.display = 'none'; });

            const title = document.createElement('h3');
            title.textContent = 'Moodboards';

            inner.appendChild(closeBtn);
            inner.appendChild(title);

            if (!list.length) {
                const p = document.createElement('p');
                p.textContent = 'No moodboards found (krea_moodboards.json missing or empty).';
                p.style.color = 'var(--secondary-text-color)';
                inner.appendChild(p);
            } else {
                const grid = document.createElement('div');
                grid.className = 'kx-moodboard-grid';
                list.forEach(mb => {
                    const card = document.createElement('div');
                    card.className = 'kx-moodboard-card';
                    const name = document.createElement('div');
                    name.className = 'm';
                    name.textContent = mb.name || mb.title || mb.id || 'Moodboard';
                    card.appendChild(name);
                    if (mb.prompts && Array.isArray(mb.prompts)) {
                        mb.prompts.slice(0, 8).forEach(pr => {
                            const chip = document.createElement('button');
                            chip.className = 'kx-btn';
                            chip.textContent = (pr.name || pr.prompt || String(pr)).slice(0, 28);
                            chip.style.margin = '2px';
                            chip.title = pr.prompt || pr.name || '';
                            chip.addEventListener('click', () => {
                                const text = typeof pr === 'string' ? pr : (pr.prompt || pr.name || '');
                                if (text) ST.copyToClipboard(text, () => ST.showToast('Copied!'));
                            });
                            card.appendChild(chip);
                        });
                    }
                    grid.appendChild(card);
                });
                inner.appendChild(grid);
            }

            moodboardEl.appendChild(inner);
            moodboardEl.addEventListener('click', (e) => {
                if (e.target === moodboardEl) moodboardEl.style.display = 'none';
            }, { once: true });
        });
    }

    // ---- Batch + stats ----
    function showStats() {
        ensureDom();
        const g = G();
        if (!g) return;
        const favs = g.favorites || new Map();
        const counts = { '1★': 0, '2★': 0, '3★': 0, '4★': 0, '5★': 0 };
        favs.forEach(r => { if (counts[r + '★']) counts[r + '★']++; });

        statsEl.innerHTML = '';
        statsEl.style.display = 'block';

        const title = document.createElement('div');
        title.textContent = 'My Stats';
        title.style.fontWeight = '700';
        title.style.marginBottom = '8px';
        statsEl.appendChild(title);

        const table = document.createElement('table');
        [
            ['Total styles', String(ST.getAll().length)],
            ['My favorites', String(favs.size)],
            ['1★', String(counts['1★'])],
            ['2★', String(counts['2★'])],
            ['3★', String(counts['3★'])],
            ['4★', String(counts['4★'])],
            ['5★', String(counts['5★'])]
        ].forEach(([k, v]) => {
            const row = document.createElement('tr');
            const td1 = document.createElement('td');
            td1.textContent = k;
            const td2 = document.createElement('td');
            td2.textContent = v;
            row.appendChild(td1);
            row.appendChild(td2);
            table.appendChild(row);
        });
        statsEl.appendChild(table);

        const close = document.createElement('button');
        close.className = 'kx-btn';
        close.textContent = 'Close';
        close.style.marginTop = '10px';
        close.addEventListener('click', () => { statsEl.style.display = 'none'; });
        statsEl.appendChild(close);
    }

    // Track the currently hovered card for quick-rate (cards are not focusable)
    let hoveredCard = null;

    // ---- Keyboard shortcuts ----
    function handleKeydown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        const g = G();
        if (!g) return;

        // Don't hijack keys while swipe mode is open (it has its own bindings)
        const swipeOverlay = document.getElementById('swipe-mode-overlay');
        if (swipeOverlay && swipeOverlay.classList.contains('visible')) return;

        switch (e.key.toLowerCase()) {
            case 'f':
                if (e.shiftKey) return;
                document.getElementById('toggle-folders-btn')?.click();
                break;
            case 's':
                if (g.currentView === 'gallery') {
                    const card = hoveredCard || document.activeElement?.closest('.card');
                    if (card) {
                        const star = card.querySelector('.star[data-star="5"]');
                        if (star) star.click();
                    }
                }
                break;
            case 'c':
                e.preventDefault();
                if (compareIds.size > 0) openCompareModal();
                else ST.showToast('Right-click cards → "Add to compare" first.');
                break;
            case 'm':
                openMoodboards();
                break;
            case '?':
                showHelp();
                break;
            case 'v':
                showStats();
                break;
        }
    }

    function showHelp() {
        ensureDom();
        let help = document.querySelector('.kx-help');
        if (help) { help.remove(); return; }
        help = document.createElement('div');
        help.className = 'kx-help';
        help.textContent = [
            'F — toggle folders',
            'S — quick-rate 5★ (focused card)',
            'C — open compare',
            'M — moodboards',
            'V — my stats',
            '? — hide this help'
        ].join('\n');
        document.body.appendChild(help);
        setTimeout(() => help.remove(), 8000);
    }

    // ---- Init ----
    function init() {
        if (!ST || !G()) setTimeout(init, 200); // wait for app.js
        if (!ST || !G()) return;

        ensureDom();
        applyUrlState();

        const gallery = document.getElementById('gallery-container');
        if (gallery) {
            // Track hovered card for 'S' quick-rate
            gallery.addEventListener('mouseover', (e) => {
                hoveredCard = e.target.closest('.card') || null;
            });
            gallery.addEventListener('mouseout', (e) => {
                if (hoveredCard && !hoveredCard.contains(e.relatedTarget)) hoveredCard = null;
            });
        }

        // Keyboard
        document.addEventListener('keydown', handleKeydown);

        // URL state updates
        const searchInput = document.getElementById('search-input');
        searchInput?.addEventListener('input', updateUrlState);

        // Expose minimal API for other scripts
        window.kxEnhancements = {
            openImageModal,
            openSimilarModal,
            addToCompare,
            openCompareModal,
            openMoodboards,
            showStats,
            updateUrlState
        };

        if (window.location.hash) applyUrlState();

        // No startup toast — it would be noisy on every page load.
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();