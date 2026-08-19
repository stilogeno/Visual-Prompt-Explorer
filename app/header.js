/**
 * app/header.js — Shared header for all pages.
 *
 * Renders a consistent header (app title + tab navigation) into a
 * <div id="shared-header"></div> placeholder on every page, so navigation
 * between pages feels stable instead of "jumpy".
 *
 * The active tab is highlighted based on the current page. The Gallery and
 * Favorites tabs are special: on index.html they are in-page tabs (handled by
 * app.js), so we render them as links to index.html#gallery / index.html#favorites
 * and let app.js switch views via the hash.
 */
(function () {
    'use strict';

    const PAGES = [
        { id: 'gallery', label: '⊞ Gallery', href: 'index.html#gallery' },
        { id: 'favorites', label: '⭑ Favorites', href: 'index.html#favorites' },
        { id: 'builder', label: '✦ Prompt Builder', href: 'prompt-builder.html' },
        { id: 'studio', label: '✦ Studio', href: 'studio.html' },
        { id: 'style-library', label: '◈ Style Library', href: 'style-library.html' },
        { id: 'admin', label: '⚙︎ Admin', href: 'admin.html' }
    ];

    function currentPage() {
        const path = window.location.pathname.split('/').pop() || 'index.html';
        if (path === 'index.html' || path === '') return 'gallery';
        if (path === 'prompt-builder.html') return 'builder';
        if (path === 'studio.html') return 'studio';
        if (path === 'admin.html') return 'admin';
        if (path === 'style-library.html') return 'style-library';
        return 'gallery';
    }

    function injectCss() {
        if (document.getElementById('shared-header-css')) return;
        const style = document.createElement('style');
        style.id = 'shared-header-css';
        style.textContent = `
            .shared-header {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 14px;
                margin-bottom: 20px;
                padding-bottom: 20px;
                border-bottom: 1px solid var(--border-color, #444);
            }
            .shared-header .shared-title {
                font-size: 24px;
                font-weight: 700;
                color: var(--text-color, #eee);
                text-decoration: none;
                text-align: center;
                line-height: 1.2;
            }
            .shared-header .shared-title:hover {
                color: var(--accent-color, #7c6cff);
            }
            .shared-header .shared-tabs {
                display: flex;
                background-color: var(--card-background, #1e1e2e);
                border-radius: var(--global-border-radius, 12px);
                max-width: 100%;
                flex-wrap: wrap;
                justify-content: center;
            }
            .shared-header .shared-tab {
                font-size: 14px;
                font-weight: 600;
                padding: 10px 18px;
                border: none;
                background-color: transparent;
                color: var(--secondary-text-color, #aaa);
                border-radius: calc(var(--global-border-radius, 12px) - 4px);
                cursor: pointer;
                transition: all 0.3s ease;
                text-align: center;
                text-decoration: none;
                white-space: nowrap;
            }
            .shared-header .shared-tab:hover {
                color: var(--text-color, #eee);
            }
            .shared-header .shared-tab.active {
                background-color: var(--border-color, #444);
                color: var(--text-color, #eee);
            }
            @media (max-width: 600px) {
                .shared-header .shared-tab {
                    padding: 8px 12px;
                    font-size: 13px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function render() {
        const placeholder = document.getElementById('shared-header');
        if (!placeholder) return;

        injectCss();

        const active = currentPage();

        const header = document.createElement('div');
        header.className = 'shared-header';

        const title = document.createElement('a');
        title.className = 'shared-title';
        title.href = 'index.html';
        title.textContent = 'Krea 2 Turbo — Style Explorer';
        header.appendChild(title);

        const tabs = document.createElement('nav');
        tabs.className = 'shared-tabs';
        tabs.setAttribute('aria-label', 'Main navigation');

        PAGES.forEach(page => {
            const tab = document.createElement('a');
            tab.className = 'shared-tab' + (page.id === active ? ' active' : '');
            tab.href = page.href;
            tab.textContent = page.label;
            tab.setAttribute('aria-current', page.id === active ? 'page' : 'false');
            tabs.appendChild(tab);
        });

        header.appendChild(tabs);
        placeholder.replaceWith(header);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
})();