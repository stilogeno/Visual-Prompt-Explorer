document.addEventListener('DOMContentLoaded', () => {
    // Load admin settings (merge with defaults)
    const ADMIN_SETTINGS_KEY = 'krea_admin_settings';
    function loadAdminSettings() {
        try {
            const stored = localStorage.getItem(ADMIN_SETTINGS_KEY);
            if (stored) return { ...{ itemsPerPage: 20, sortOrder: 'desc', scrollThreshold: 200, gridCols: 5, foldersVisible: true, toastDuration: 2000, scrollTopThreshold: 300, supabaseSync: false, imageUrlExport: false, debugMode: false }, ...JSON.parse(stored) };
        } catch(e) {}
        return { itemsPerPage: 20, sortOrder: 'desc', scrollThreshold: 200, gridCols: 5, foldersVisible: true, toastDuration: 2000, scrollTopThreshold: 300, supabaseSync: false, imageUrlExport: false, debugMode: false };
    }
    const adminSettings = loadAdminSettings();

    const DEBUG_MODE = adminSettings.debugMode;
    
    const ENABLE_IMAGE_URL_EXPORT = adminSettings.imageUrlExport;
    const galleryContainer = document.getElementById('gallery-container');
    const loader = document.getElementById('loader');
    const tabGallery = document.getElementById('tab-gallery');
    const tabFavorites = document.getElementById('tab-favorites');
    const searchInput = document.getElementById('search-input');
    const scrollToTopBtn = document.getElementById('scroll-to-top');
    const gridSlider = document.getElementById('grid-slider');
    const gridSliderValue = document.getElementById('grid-slider-value');
    const controlsContainer = document.getElementById('controls-container');
    const swipeLaunchControls = document.querySelector('.swipe-launch-controls');
    const favoritesControlsWrapper = document.getElementById('favorites-controls-wrapper');
    const styleCounter = document.getElementById('style-counter');
    const txtExportContainer = document.getElementById('txt-export-container');
    const toggleFoldersBtn = document.getElementById('toggle-folders-btn');
    const importFavoritesInput = document.getElementById('import-favorites-input');
    const sortControls = document.querySelector('.sort-controls');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    let allItems = [];
    const galleryTitle = document.getElementById('gallery-title');
    let selectedArtistIds = new Set();
    let favorites = new Map();
    let currentItems = [];
    let currentPage = 0;
    let startIndexOffset = 0;
    const itemsPerPage = adminSettings.itemsPerPage;
    let searchTerm = '';
    let currentView = 'gallery';
    let isLoading = false;
    const FOLDERS_PANEL_VISIBLE_KEY = 'foldersPanelVisible';
    let isFoldersPanelVisible = adminSettings.foldersVisible;
    let avgFavsSortMode = adminSettings.sortOrder;
    let randomSortActive = false;
    // Star multiselect filter (default: all star levels active). Filters by the merged display rating.
    let selectedStarFilters = new Set([5, 4, 3, 2, 1, 0]);
    // Community rating: every 4 likes = 1 star, capped at 5.
    function communityStarsFor(favs) {
        return Math.min(MAX_RATING, Math.floor((favs || 0) / 4));
    }
    // Display rating: the user's personal rating if set, otherwise the community likes-based rating as default.
    // Personal rating overrides the community default once the user has rated the item.
    function displayRatingFor(item) {
        return favorites.get(item.id) || communityStarsFor(item.avg_favs);
    }
    function filteredCount() {
        let items = allItems;
        if (selectedStarFilters.size > 0) {
            items = items.filter(item => selectedStarFilters.has(displayRatingFor(item)));
        }
        if (searchTerm) {
            items = items.filter(item => item.artist.toLowerCase().includes(searchTerm));
        }
        return items.length;
    }

    window.appGlobals = {
        get currentItems() { return currentItems; },
        get favorites() { return favorites; },
        get searchTerm() { return searchTerm; },
        get currentView() { return currentView; },
        get db() { return db; },
        get STORE_NAME() { return STORE_NAME; }, 
        get allItems() { return allItems; },
        set db(value) { db = value; },
        get selectedArtistIds() { return selectedArtistIds; },
        clearSelection: () => selectedArtistIds.clear(),
        toggleFavorite,
        showToast,
        renderView,
        updateVisibleFavorites,
        get adminSettings() { return adminSettings; }
    };

    // Images ship with the app in the local `images/` folder — no CDN indirection needed.
    function getImagePath(artistId, folderNumber) {
        const idStr = String(artistId);
        return `images/${folderNumber}/${idStr}.webp`;
    }

    let db;
    const DB_NAME = 'StyleGalleryKrea';
    const STORE_NAME = 'favorites';
    const MAX_RATING = 5;

    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 5);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject('Error opening DB');
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const upgradeDb = event.target.result;
                const upgradeTx = event.target.transaction;

                // Create the favorites store if it doesn't exist yet
                if (!upgradeDb.objectStoreNames.contains(STORE_NAME)) {
                    const favStore = upgradeDb.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    favStore.createIndex('rating', 'rating', { unique: false });
                } else {
                    // V5: Migrate from boolean favorites to star ratings (1-5)
                    // Use the upgrade transaction's store — nested transactions are invalid here
                    const store = upgradeTx.objectStore(STORE_NAME);
                    if (!store.indexNames.contains('rating')) {
                        store.createIndex('rating', 'rating', { unique: false });
                    }
                    store.openCursor().onsuccess = (e) => {
                        const cursor = e.target.result;
                        if (cursor) {
                            const item = cursor.value;
                            // Legacy entries (boolean favorites / timestamps) have no rating -> set to 1
                            if (item && typeof item.rating === 'undefined') {
                                cursor.update({ id: item.id, rating: 1 });
                            }
                            cursor.continue();
                        }
                    };
                }

                if (!upgradeDb.objectStoreNames.contains('folders')) {
                    const foldersStore = upgradeDb.createObjectStore('folders', { keyPath: 'id' });

                    foldersStore.createIndex('name', 'name', { unique: false });
                }

                if (!upgradeDb.objectStoreNames.contains('folder_artists')) {
                    upgradeDb.createObjectStore('folder_artists', { keyPath: 'folderId' });
                }
            };
        });
    }

    async function loadFavoritesFromDB() {
        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const objectStore = transaction.objectStore(STORE_NAME);
            const request = objectStore.getAll();
            request.onsuccess = () => {
                favorites = new Map(request.result.map(item => [item.id, item.rating || 0]));
                resolve();
            };
            request.onerror = () => {
                console.error('Error loading favorites:', request.error);
                favorites = new Map();
                resolve();
            };
            transaction.onerror = () => {
                console.error('Error loading favorites transaction:', transaction.error);
                favorites = new Map();
                resolve();
            };
        });
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    async function debug_checkImagePaths() {
        if (!DEBUG_MODE) return;

        console.log('%c[DEBUG] Starting image path verification...', 'color: orange; font-weight: bold;');

        const totalItems = allItems.length;
        let foundCount = 0;
        const notFoundArtists = [];

        const checkImage = (item) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    foundCount++;
                    resolve();
                };
                img.onerror = () => {
                    notFoundArtists.push({ artist: item.artist, id: item.id, path: item.image });
                    resolve();
                };
                img.src = item.image;
            });
        };

        await Promise.all(allItems.map(item => checkImage(item)));

        const notFoundCount = notFoundArtists.length;
        console.log('%c[DEBUG] Image path verification complete.', 'color: orange; font-weight: bold;');
        console.log(`- Total checked: ${totalItems}`);
        console.log(`- Found images: %c${foundCount}`, 'color: green;');
        console.log(`- Missing images: %c${notFoundCount}`, `color: ${notFoundCount > 0 ? 'red' : 'green'};`);

        if (notFoundCount > 0) {
            console.warn('[DEBUG] Artists with missing images:');
            console.table(notFoundArtists);
        }
    }

    function createCard(item) {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.artist = item.artist;

        card.draggable = currentView === 'favorites';
        card.dataset.id = item.id;

        const rating = displayRatingFor(item);

        const favs = item.avg_favs || 0;

        // Star rating button — clean 5-pointed star (viewBox 0 0 24 24)
        const starSVG = (filled) => {
            const fill = filled ? '#f5a623' : 'none';
            const stroke = '#ffffff';
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
        };

        let starHTML = '';
        for (let i = 1; i <= MAX_RATING; i++) {
            const filled = i <= rating;
            starHTML += `<span class="star" data-star="${i}" title="${i} star${i > 1 ? 's' : ''}" role="button" tabindex="0" aria-label="Rate ${i} star${i > 1 ? 's' : ''}" aria-pressed="${filled}" style="cursor:pointer; display:inline-block; transition: transform 0.15s;">${starSVG(filled)}</span>`;
        }

        let favButtonHTML;
        if (currentView === 'favorites') {
            favButtonHTML = `
                <button 
                    class="favorite-button remove-favorite" 
                    aria-label="Remove rating"
                    title="Remove rating"
                >
                    ×
                </button>
            `;
        } else {
            favButtonHTML = `
                <div class="star-rating-container">
                    ${starHTML}
                </div>
            `;
        }

        card.innerHTML = `
            <img class="card__image" src="${item.image}" alt="${item.artist}" loading="lazy" width="832" height="1216">
            <div class="card__info">
                <p class="card__artist">${item.artist}</p>
            </div>
            ${favButtonHTML}
            <div class="card-actions">
                <button class="card-action-btn" data-action="copy" title="Copy prompt">📋 Copy</button>
                <button class="card-action-btn" data-action="view" title="View image">🖼 View</button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            // Handle star clicks
            const starEl = e.target.closest('.star');
            if (starEl && currentView !== 'favorites') {
                e.stopPropagation();
                const newRating = parseInt(starEl.dataset.star);
                setRating(item, newRating, card);
                return;
            }

            // Handle remove button in favorites view
            if (e.target.classList.contains('favorite-button')) {
                return;
            }

            if (currentView === 'favorites' && e.ctrlKey) {
                e.preventDefault();
                if (selectedArtistIds.has(item.id)) {
                    selectedArtistIds.delete(item.id);
                    card.classList.remove('selected');
                } else {
                    selectedArtistIds.add(item.id);
                    card.classList.add('selected');
                }
            } else {
                const textToCopy = buildCopyText(item);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        const basePrompt = getActiveBasePrompt();
                        showToast(basePrompt ? `Copied with ${basePrompt.label} base` : 'Prompt copied!');
                    }).catch(() => {
                        fallbackCopyText(textToCopy);
                    });
                } else {
                    fallbackCopyText(textToCopy);
                }

                selectedArtistIds.clear();
                document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
            }
        });

        // Keyboard accessibility: Enter/Space activates a star rating
        card.querySelectorAll('.star').forEach(star => {
            star.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    const newRating = parseInt(star.dataset.star);
                    setRating(item, newRating, card);
                }
            });
        });

        const favButton = card.querySelector('.favorite-button');
        if (favButton) {
            favButton.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(item, favButton);
            });
        }

        // Hover action buttons: Copy prompt / View image
        card.querySelectorAll('.card-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (btn.dataset.action === 'copy') {
                    const textToCopy = buildCopyText(item);
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(textToCopy).then(() => {
                            const basePrompt = getActiveBasePrompt();
                            showToast(basePrompt ? `Copied with ${basePrompt.label} base` : 'Prompt copied!');
                        }).catch(() => {
                            fallbackCopyText(textToCopy);
                        });
                    } else {
                        fallbackCopyText(textToCopy);
                    }
                } else if (btn.dataset.action === 'view') {
                    if (window.kxEnhancements && window.kxEnhancements.openImageModal) {
                        window.kxEnhancements.openImageModal(card);
                    } else {
                        // Fallback: open the image in a new tab
                        window.open(item.image, '_blank');
                    }
                }
            });
        });

        return card;
    }

    async function loadInitialData() {
        try {

            if (typeof galleryData !== 'undefined' && allItems.length === 0) {

                allItems = galleryData.map(item => {
                    const artistIdStr = String(item.id);
                    const relativePath = getImagePath(artistIdStr, item.folder);
                    const prompt = item.prompt || '';
                    const words = prompt.split(/\s+/).filter(w => w.length > 0);
                    const name = words.length > 0 ? words[0] + (words.length > 1 ? ' Style' : '') : 'Style';
                    
                    return {
                        artist: prompt,
                        image: relativePath,
                        worksCount: item.post_count,
                        id: artistIdStr,
                        uniqueness_score: item.uniqueness_score,
                        // Fall back to the `stars` field when `avg_favs` is unavailable
                        avg_favs: item.avg_favs || item.stars || 0,
                        avg_score: item.avg_score,
                        // Merged fields from t2i-krea-2-style-library
                        name: name,
                        descriptor: prompt,
                        categories: item.categories || []
                    };
                });
                
            }

            await debug_checkImagePaths();

            await loadFavoritesFromDB();

            styleCounter.innerHTML = `Prompt-based styles: <span class="style-count-number">${filteredCount().toLocaleString('en-US')}</span>`;

            renderView();
            window.appFolders.init();

            // === SUPABASE INTEGRATION ===
            if (window.appSupabase) {
                window.appSupabase.setConfig(adminSettings.supabaseUrl, adminSettings.supabaseKey);
                window.appSupabase.setSyncEnabled(adminSettings.supabaseSync);
                window.appSupabase.init();
                if (adminSettings.supabaseSync && window.appSupabase.isConnected()) {
                    window.appSupabase.fetchGlobalCounts().then(globalCounts => {
                        if (globalCounts && globalCounts.size > 0) {
                            allItems.forEach(item => {
                                if (globalCounts.has(item.id)) {
                                    item.avg_favs = globalCounts.get(item.id);
                                }
                            });
                            renderView();
                        }
                    });
                }
            }

        } catch (error) {
            console.error('Failed to load gallery data:', error);
            galleryContainer.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">Failed to load data.</p>';
        }
    }

    function renderView() {
        currentPage = 0;
        galleryContainer.innerHTML = '';
        selectedArtistIds.clear();

        if (currentView === 'favorites') {
            if (isFoldersPanelVisible && window.innerWidth > 992) {
                window.appFolders.showPanel();
                galleryContainer.parentElement.style.flex = '1';

                const { activeFolderId, getFolderName } = window.appFolders;
                
                if (galleryTitle && activeFolderId && getFolderName) {
                    const folderName = getFolderName(activeFolderId);
                    galleryTitle.textContent = '';
                    const labelSpan = document.createElement('span');
                    labelSpan.className = 'gallery-title-label';
                    labelSpan.textContent = 'Folder: ';
                    galleryTitle.appendChild(labelSpan);
                    galleryTitle.appendChild(document.createTextNode(folderName));
                    galleryTitle.style.display = 'block';
                }
            } else {
                window.appFolders.hidePanel();
                galleryContainer.parentElement.style.flex = '';
                if (galleryTitle) {
                    galleryTitle.style.display = 'none';
                }
            }
        } else {
            window.appFolders.hidePanel();
            galleryContainer.parentElement.style.flex = '';
            if (galleryTitle) {
                galleryTitle.style.display = 'none';
            }
        }

        galleryContainer.classList.toggle('favorites-view', currentView === 'favorites');

        window.scrollTo(0, 0);

        let sortedItems = [...allItems];
        if (randomSortActive) {
            shuffleArray(sortedItems);
        } else {
            // Sort by display rating descending (highest stars first)
            sortedItems.sort((a, b) => displayRatingFor(b) - displayRatingFor(a));
        }

        // Apply the star multiselect filter (merged display rating) — only in the Gallery view
        if (currentView === 'gallery' && selectedStarFilters.size > 0) {
            sortedItems = sortedItems.filter(item => selectedStarFilters.has(displayRatingFor(item)));
        }

        if (currentView === 'favorites') {
            // Filter: only items with a rating >= minimum filter
            const minRating = parseInt(window.appGlobals?.starFilterMin) || 0;
            sortedItems = sortedItems.filter(item => {
                const r = favorites.get(item.id) || 0;
                return r >= minRating;
            });

            if (window.innerWidth > 992) {
                const { activeFolderId, getArtistIdsInFolder, getUnsortedArtistIds } = window.appFolders;

                if (activeFolderId && getArtistIdsInFolder && getUnsortedArtistIds) {
                    let artistIdsForFolder;

                    if (activeFolderId === 'unsorted') {
                        artistIdsForFolder = getUnsortedArtistIds();
                    } else {
                        artistIdsForFolder = getArtistIdsInFolder(activeFolderId);
                    }

                    if (artistIdsForFolder) {
                        const artistIdsToShow = new Set(artistIdsForFolder);
                        sortedItems = sortedItems.filter(item => artistIdsToShow.has(item.id));
                    }
                }
            }

            const { activeFolderId, getArtistIdsInFolder } = window.appFolders;
            if (window.innerWidth > 992 && activeFolderId && activeFolderId !== 'unsorted') {
                const orderedArtistIds = getArtistIdsInFolder(activeFolderId);
                const orderMap = new Map(orderedArtistIds.map((id, index) => [id, index]));
                sortedItems.sort((a, b) => {
                    return (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity);
                });
            } else {
                // Sort by rating descending
                sortedItems.sort((a, b) => {
                    const ratingA = favorites.get(a.id) || 0;
                    const ratingB = favorites.get(b.id) || 0;
                    return ratingB - ratingA;
                });
            }
        }

        let filteredItems;
        if (searchTerm) {
            filteredItems = sortedItems.filter(item => 
                item.artist.toLowerCase().includes(searchTerm)
            );
        } else {
            filteredItems = sortedItems;
        }

        // Filter by active base prompt (show only styles matching the selected subject)
        filteredItems = filterItemsByBasePrompt(filteredItems);

        currentItems = filteredItems.slice(startIndexOffset);

        if (filteredItems.length === 0) {
            const p = document.createElement('p');
            p.style.textAlign = 'center';
            p.style.gridColumn = '1 / -1';

            if (currentView === 'favorites') {
                if (favorites.size > 0 && searchTerm) {
                    p.innerText = `No cards found for "${searchTerm}" in your favorites.`;
                } else {

                    const { activeFolderId } = window.appFolders;
                    if (activeFolderId && activeFolderId !== 'unsorted') {
                        p.innerText = 'This folder is empty. Drag and drop cards here!';
                    } else {
                        p.innerText = 'You have no favorites yet.';
                    }
                }
            } else if (searchTerm) {
                p.innerText = `No cards found for "${searchTerm}".`;
            } else {

                p.innerText = 'No cards found.';
            }
            galleryContainer.appendChild(p);
            return;
        }
        
        loadMoreItems();
    }

    function loadMoreItems() {
        if (isLoading) return;
        isLoading = true;
        loader.style.display = 'block';

        setTimeout(() => {
            const start = currentPage * itemsPerPage;
            const end = start + itemsPerPage;
            const itemsToLoad = currentItems.slice(start, end);

            itemsToLoad.forEach(item => {
                const card = createCard(item);
                galleryContainer.appendChild(card);
            });

            currentPage++;
            isLoading = false;
            loader.style.display = 'none';

            if (currentPage * itemsPerPage >= currentItems.length) {
                loader.style.display = 'none';
            } else {

                checkAndLoadMoreIfContentDoesNotFillScreen();
            }

        }, 500);
    }

    function checkAndLoadMoreIfContentDoesNotFillScreen() {
        const hasScrollbar = document.body.scrollHeight > window.innerHeight;
        const hasMoreItems = currentPage * itemsPerPage < currentItems.length;
        if (!isLoading && !hasScrollbar && hasMoreItems) {
            loadMoreItems();
        }
    }

    function setRating(item, newRating, card) {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        if (newRating === 0) {
            // Remove rating
            store.delete(item.id);
            favorites.delete(item.id);
            showToast('Rating removed');
        } else {
            // Set rating
            const ratingItem = { id: item.id, rating: newRating };
            store.put(ratingItem);
            favorites.set(item.id, newRating);
            showToast(`${newRating} star${newRating > 1 ? 's' : ''}`);
        }

        // Update the card's star display
        updateCardStars(card, item.id);

        // Sync to Supabase before any view-specific re-render/removal
        if (window.appSupabase) {
            window.appSupabase.syncFavorite(item.id, newRating);
        }

        // In the Gallery view, re-render so the card re-sorts/re-filters to its rightful place
        if (currentView === 'gallery') {
            renderView();
            return;
        }

        // If in favorites view, handle removal
        if (currentView === 'favorites' && newRating === 0) {
            const favCard = card.closest('.card');
            if (favCard) {
                favCard.style.transition = 'opacity 0.15s ease, transform 0.15s ease, margin 0.15s ease, padding 0.15s ease, max-height 0.15s ease';
                favCard.style.transform = 'scale(0.8)';
                favCard.style.opacity = '0';
                favCard.style.margin = '0';
                favCard.style.padding = '0';
                favCard.style.maxHeight = '0px';

                favCard.addEventListener('transitionend', () => {
                    favCard.remove();
                    if (favorites.size === 0) {
                        galleryContainer.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">No rated styles yet.</p>';
                    }
                    styleCounter.innerHTML = `Rated Styles: <span class="style-count-number">${favorites.size.toLocaleString('en-US')}</span>`;
                }, { once: true });
            }
        }

        updateVisibleFavorites();
    }

    function toggleFavorite(item, favButton) {
        // Removes a rated style from favorites (used in the Favorites view)
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(item.id);
        favorites.delete(item.id);

        // Keep folder membership in sync
        if (window.appFolders && typeof window.appFolders.handleFavoriteRemoval === 'function') {
            window.appFolders.handleFavoriteRemoval(item.id);
        }

        // Animate out the card
        const favCard = favButton ? favButton.closest('.card') : null;
        if (favCard) {
            favCard.style.transition = 'opacity 0.15s ease, transform 0.15s ease, margin 0.15s ease, padding 0.15s ease, max-height 0.15s ease';
            favCard.style.transform = 'scale(0.8)';
            favCard.style.opacity = '0';
            favCard.style.margin = '0';
            favCard.style.padding = '0';
            favCard.style.maxHeight = '0px';

            favCard.addEventListener('transitionend', () => {
                favCard.remove();
                if (favorites.size === 0) {
                    galleryContainer.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">No rated styles yet.</p>';
                }
                styleCounter.innerHTML = `Rated Styles: <span class="style-count-number">${favorites.size.toLocaleString('en-US')}</span>`;
            }, { once: true });
        }

        showToast('Rating removed');
        updateVisibleFavorites();

        // Sync removal to Supabase
        if (window.appSupabase) {
            window.appSupabase.syncFavorite(item.id, 0);
        }
    }

    function updateCardStars(card, itemId) {
        const item = allItems.find(i => i.id === itemId);
        const rating = item ? displayRatingFor(item) : (favorites.get(itemId) || 0);
        const stars = card.querySelectorAll('.star');
        stars.forEach(star => {
            const starNum = parseInt(star.dataset.star);
            const svg = star.querySelector('svg');
            if (svg) {
                const fill = starNum <= rating ? '#f5a623' : 'none';
                svg.setAttribute('fill', fill);
            }
            star.setAttribute('aria-pressed', String(starNum <= rating));
        });
    }

    function updateVisibleFavorites() {
        if (currentView !== 'gallery') return;

        const cards = galleryContainer.querySelectorAll('.card');
        cards.forEach(card => {
            const cardId = card.dataset.id;
            const item = allItems.find(i => i.id === cardId);
            const rating = item ? displayRatingFor(item) : (favorites.get(cardId) || 0);
            const stars = card.querySelectorAll('.star');
            stars.forEach(star => {
                const starNum = parseInt(star.dataset.star);
                const svg = star.querySelector('svg');
                if (svg) {
                    const fill = starNum <= rating ? '#f5a623' : 'none';
                    svg.setAttribute('fill', fill);
                }
            });
        });
    }

    function showToast(message) {
        const toast = document.getElementById('toast-notification');
        const toastMsg = toast.querySelector('.toast-message');
        if (message && toastMsg) toastMsg.textContent = message;
        toast.classList.add('show');
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => {
            toast.classList.remove('show');
        }, adminSettings.toastDuration);
    }

    function fallbackCopyText(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast('Prompt copied to clipboard!');
        } catch (e) {
            console.warn('Copy failed:', e);
        }
        document.body.removeChild(textarea);
    }

    function setActiveTab(activeTab) {
        const tabs = [tabGallery, tabFavorites];
        tabs.forEach(tab => tab.classList.remove('active'));
        activeTab.classList.add('active');
    }

    function updateControlsState() {
        const isSearchingByName = searchInput.value.trim().length > 0;
        sortControls.classList.toggle('disabled', isSearchingByName);
        swipeLaunchControls.classList.toggle('disabled', isSearchingByName);
    }

    window.addEventListener('scroll', () => {

        if (window.scrollY > adminSettings.scrollTopThreshold) {
            scrollToTopBtn.classList.add('visible');
        } else {
            scrollToTopBtn.classList.remove('visible');
        }

        if (!isLoading && (window.innerHeight + window.scrollY) >= document.body.offsetHeight - adminSettings.scrollThreshold) {
            if (currentPage * itemsPerPage < currentItems.length) {
                loadMoreItems();
            }
        }
    });

    scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // View switching is driven by the shared header's hash links
    // (index.html#gallery / index.html#favorites). The old in-page tab
    // buttons were removed in favor of the shared header.
    function switchToGallery() {
        if (currentView === 'gallery') return;
        favoritesControlsWrapper.style.display = 'none';
        txtExportContainer.style.display = 'none';
        swipeLaunchControls.style.display = 'flex';
        sortControls.style.display = 'flex';
        currentView = 'gallery';

        styleCounter.innerHTML = `Prompt-based styles: <span class="style-count-number">${filteredCount().toLocaleString('en-US')}</span>`;

        renderView();

        if (searchInput.value) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function switchToFavorites() {
        if (currentView === 'favorites') return;
        favoritesControlsWrapper.style.display = 'flex';
        txtExportContainer.style.display = 'flex';
        swipeLaunchControls.style.display = 'none';
        sortControls.style.display = 'none';
        currentView = 'favorites';

        styleCounter.innerHTML = `Rated Styles: <span class="style-count-number">${favorites.size.toLocaleString('en-US')}</span>`;

        startIndexOffset = 0;

        if (window.innerWidth > 992) {
            if (window.appFolders && window.appFolders.setActiveFolder) {
                window.appFolders.setActiveFolder('unsorted', false);
            }
        }

        if (searchInput.value) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        renderView();
    }

    // Handle hash-based navigation from the shared header
    function handleHashNavigation() {
        const hash = window.location.hash.replace(/^#/, '');
        if (hash === 'favorites') {
            switchToFavorites();
        } else if (hash === 'gallery' || hash === '') {
            switchToGallery();
        }
    }

    window.addEventListener('hashchange', handleHashNavigation);

    // Keep the old in-page tab handlers working if the elements still exist
    // (e.g. a cached page before the shared header was introduced).
    if (tabGallery) {
        tabGallery.addEventListener('click', (e) => {
            e.preventDefault();
            switchToGallery();
        });
    }
    if (tabFavorites) {
        tabFavorites.addEventListener('click', (e) => {
            e.preventDefault();
            switchToFavorites();
        });
    }

    // Base prompts configuration (adapted from t2i-krea-2-style-library)
    const BASE_PROMPTS = [
        { id: 'portrait', label: 'Portrait', prompt: 'a brown-haired young woman with glasses, seated outside at the old town cafe, drinking orange juice, street in the background, side angle, looking at the viewer, ', seed: 123456789, width: 1024, height: 1536 },
        { id: 'portrait-v2', label: 'Portrait vol. 2', prompt: 'a blonde young woman with glasses, green eyes, seated outside at coastal cafe, holding a small transparent cup of espresso, sea and cliff background, side angle, looking at the viewer,', seed: 123456789, width: 1024, height: 1536 },
        { id: 'plain-portrait', label: 'Plain Portrait', prompt: 'portrait view of a young adult woman with long dark curly hair and brown eyes, wearing a green sweater and small silver earrings, turned slightly to one side while looking at the viewer, against a plain cream-colored background', seed: 123456789, width: 1024, height: 1536 },
        { id: 'full-figure', label: 'Full Figure', prompt: 'full-body view of an adult man in a mustard-yellow coat opening a blue umbrella on a rain-wet city street at night', seed: 123456789, width: 1024, height: 1536 },
        { id: 'architecture', label: 'Architecture', prompt: 'a narrow street runs between stone buildings toward a red clock tower, a bicycle rests beside a blue door, with several potted plants along the pavement', seed: 123456789, width: 1536, height: 1024 },
        { id: 'animal-landscape', label: 'Animal and Landscape', prompt: 'a brown-and-white cow stands beside a shallow alpine river, with tall grass along the bank, a wooden fence nearby, and the Alps mountains in the distance', seed: 123456789, width: 1536, height: 1024 },
        { id: 'materials', label: 'Materials', prompt: 'a clear glass bottle, a metal teapot, a red apple, and a folded blue cloth arranged on a wooden table', seed: 123456789, width: 1024, height: 1024 },
        { id: 'panoramic-environment', label: 'Panoramic Environment', prompt: 'a passenger train crosses a stone bridge above a river valley, with a small village below and mountains in the distance', seed: 123456789, width: 1536, height: 864 }
    ];

    let activeBasePromptId = '';

    function loadActiveBasePromptId() {
        try {
            return localStorage.getItem('k2tse-active-base-prompt') || '';
        } catch (_) {
            return '';
        }
    }

    function saveActiveBasePromptId(id) {
        try {
            localStorage.setItem('k2tse-active-base-prompt', id);
        } catch (_) {}
    }

    function getActiveBasePrompt() {
        return BASE_PROMPTS.find(p => p.id === activeBasePromptId) || null;
    }

    // Base prompt selector HTML (inserted into controls)
    function getBasePromptSelectorHTML() {
        const savedId = loadActiveBasePromptId();
        activeBasePromptId = savedId;
        const prompt = BASE_PROMPTS.find(p => p.id === savedId);
        const isSet = !!prompt;
        
        let options = BASE_PROMPTS.map((p, i) => {
            const selected = p.id === savedId ? ' selected' : '';
            return `<option value="${p.id}"${selected}>${p.label}</option>`;
        }).join('');

        return `
            <div class="base-prompt-selector">
                <label for="base-prompt-selector" class="base-prompt-label">Base prompt</label>
                <select id="base-prompt-selector" class="base-prompt-selector-input">${options}</select>
            </div>
        `;
    }

    // Render base prompt selector into the page
    function renderBasePromptSelector() {
        const placeholder = document.querySelector('.base-prompt-selector-placeholder');
        if (!placeholder) return;
        // Remove any existing selector
        const existing = document.querySelector('.base-prompt-selector');
        if (existing) existing.remove();
        const html = getBasePromptSelectorHTML();
        placeholder.innerHTML = html;
    }

    // Apply active base prompt filtering to gallery items
    function filterItemsByBasePrompt(items) {
        const activePrompt = getActiveBasePrompt();
        if (!activePrompt) return items;

        return items.filter(item => {
            // Simple matching: check if the style's prompt contains key tokens from the base prompt
            const baseTokens = activePrompt.prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const itemPrompt = item.descriptor ? item.descriptor.toLowerCase() : item.artist.toLowerCase();
            return baseTokens.some(token => itemPrompt.includes(token));
        });
    }

    // Build copy text: style descriptor + optional base prompt
    function buildCopyText(item) {
        const styleText = item.descriptor || item.artist || '';
        const basePrompt = getActiveBasePrompt();
        if (basePrompt) {
            return `${styleText}, ${basePrompt.prompt}`;
        }
        return styleText;
    }

    // Image viewer modal
    let viewerImages = [];
    let viewerIndex = -1;

    function openImageViewerImage(startIndex = 0) {
        const catalog = document.getElementById('gallery-container');
        if (!catalog) return;

        // Collect all style images from the gallery
        viewerImages = [];
        const allImgs = catalog.querySelectorAll('.card img.card__image');
        allImgs.forEach((img, i) => {
            const card = img.closest('.card');
            const itemId = card ? card.dataset.id : null;
            const item = allItems.find(i => i.id === itemId);
            if (item && item.image) {
                viewerImages.push({
                    src: item.image,
                    alt: item.artist || item.name || 'Style',
                    position: i,
                    styleName: item.name || item.artist
                });
            }
        });

        if (viewerImages.length === 0) return;

        viewerIndex = startIndex;
        if (viewerIndex < 0) viewerIndex = 0;
        if (viewerIndex >= viewerImages.length) viewerIndex = viewerImages.length - 1;

        const viewer = document.getElementById('swipe-mode-overlay');
        if (!viewer) {
            // Create modal
            const modal = document.createElement('div');
            modal.id = 'swipe-mode-overlay';
            modal.className = 'swipe-overlay';
            modal.innerHTML = `
                <div class="swipe-header">
                    <div class="swipe-header-left">
                        <div id="swipe-counter" class="swipe-counter"></div>
                        <div id="swipe-favorites-counter" class="swipe-favorites-counter" title="Total favorites">
                            <span class="swipe-favorites-icon">♥</span>
                            <span id="swipe-favorites-count">0</span>
                        </div>
                    </div>
                    <div id="swipe-artist-name" class="swipe-artist-name"></div>
                    <button id="swipe-close-btn" class="swipe-close-btn" title="Close (Esc)">&times;</button>
                </div>
                <div id="swipe-container" class="swipe-container">
                    <img id="swipe-prev-image" class="swipe-image swipe-image--prev" alt="Previous artist">
                    <img id="swipe-current-image" class="swipe-image swipe-image--current" alt="Current artist">
                    <div id="swipe-like-feedback" class="swipe-like-feedback">
                        <div class="heart"></div>
                    </div>
                    <img id="swipe-next-image" class="swipe-image swipe-image--next" alt="Next artist">
                </div>
                <div class="swipe-hint">Use <kbd>←</kbd> <kbd>→</kbd> to navigate, <kbd>C</kbd> to copy prompt, <kbd>↓</kbd> to favorite, <kbd>Esc</kbd> to close</div>
            `;
            document.body.appendChild(modal);
            // Attach event listeners after DOM is inserted
            attachImageViewerListeners();
        } else {
            viewer.style.display = 'block';
            attachImageViewerListeners();
        }

        updateImageViewer();
    }

    function attachImageViewerListeners() {
        const viewer = document.getElementById('swipe-mode-overlay');
        if (!viewer) return;

        // Close button
        const closeBtn = viewer.querySelector('.swipe-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeImageViewer);
        }

        // Navigate prev/next
        const prevBtn = viewer.querySelector('.swipe-image--prev');
        const nextBtn = viewer.querySelector('.swipe-image--next');
        if (prevBtn) prevBtn.addEventListener('click', () => navigateImageViewer(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => navigateImageViewer(1));

        // Keyboard navigation
        viewer.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                navigateImageViewer(-1);
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                navigateImageViewer(1);
            }
            if (e.key === 'Escape') {
                closeImageViewer();
            }
        });

        // Click to close
        viewer.addEventListener('click', (e) => {
            if (e.target === e.currentTarget || e.target.closest('.swipe-close-btn')) {
                closeImageViewer();
            }
        });

        // Swipe navigation
        let touchStartX = 0;
        let touchEndX = 0;
        viewer.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].clientX;
        });
        viewer.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].clientX;
            const deltaX = touchEndX - touchStartX;
            if (Math.abs(deltaX) > 50) {
                navigateImageViewer(deltaX < 0 ? 1 : -1);
            }
        });
    }

    function navigateImageViewer(offset) {
        if (viewerImages.length < 2) return;
        viewerIndex = (viewerIndex + offset + viewerImages.length) % viewerImages.length;
        updateImageViewer();
    }

    function updateImageViewer() {
        if (!viewerImages.length || viewerIndex < 0) return;

        const current = viewerImages[viewerIndex];
        const imgEl = document.getElementById('swipe-current-image');
        const counterEl = document.getElementById('swipe-counter');
        const favoritesEl = document.getElementById('swipe-favorites-count');
        const artistNameEl = document.getElementById('swipe-artist-name');
        const prevImg = document.getElementById('swipe-prev-image');
        const nextImg = document.getElementById('swipe-next-image');

        if (imgEl) {
            imgEl.src = current.src;
            imgEl.alt = current.alt;
        }
        if (counterEl) {
            counterEl.textContent = `${viewerIndex + 1} / ${viewerImages.length}`;
        }
        if (favoritesEl) {
            favoritesEl.textContent = viewerImages.filter(i => i.src.includes('images')).length || 0;
        }
        if (artistNameEl) {
            artistNameEl.textContent = current.styleName;
        }
        if (prevImg) prevImg.style.display = viewerImages.length > 1 ? 'block' : 'none';
        if (nextImg) nextImg.style.display = viewerImages.length > 1 ? 'block' : 'none';
    }

    function closeImageViewer() {
        const viewer = document.getElementById('swipe-mode-overlay');
        if (viewer) {
            viewer.style.display = 'none';
        }
        viewerImages = [];
        viewerIndex = -1;
    }

    function updateToggleFoldersButton() {
        toggleFoldersBtn.textContent = isFoldersPanelVisible ? 'Close Folders' : 'Open Folders';
    }

    toggleFoldersBtn.addEventListener('click', () => {
        isFoldersPanelVisible = !isFoldersPanelVisible;
        localStorage.setItem(FOLDERS_PANEL_VISIBLE_KEY, isFoldersPanelVisible);

        if (isFoldersPanelVisible) {
            window.appFolders.showPanel();
            toggleFoldersBtn.textContent = 'Close Folders';
            galleryContainer.parentElement.style.flex = '1';
            if (galleryTitle) {
                galleryTitle.style.display = 'block';
            }
        } else {
            window.appFolders.hidePanel();
            toggleFoldersBtn.textContent = 'Open Folders';
            galleryContainer.parentElement.style.flex = '';
            if (galleryTitle) {
                galleryTitle.style.display = 'none';
            }
        }
    });

    const sortByRandomBtn = document.getElementById('sort-by-random');

    // Star multiselect filter buttons (5★, 4★, 3★, 2★, 1★, 0★)
    document.querySelectorAll('.star-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            const stars = parseInt(btn.dataset.stars, 10);
            if (selectedStarFilters.has(stars)) {
                selectedStarFilters.delete(stars);
                btn.classList.remove('active');
            } else {
                selectedStarFilters.add(stars);
                btn.classList.add('active');
            }
            // If nothing selected, default back to 5★
            if (selectedStarFilters.size === 0) {
                selectedStarFilters.add(5);
                document.querySelector('.star-filter[data-stars="5"]').classList.add('active');
            }
            randomSortActive = false;
            if (sortByRandomBtn) sortByRandomBtn.classList.remove('active');
            renderView();

            // Keep the counter in sync with the star selection
            if (currentView === 'gallery') {
                styleCounter.innerHTML = `Prompt-based styles: <span class="style-count-number">${filteredCount().toLocaleString('en-US')}</span>`;
            }
        });
    });

    // Base prompt selector change handler
    const basePromptSelect = document.getElementById('base-prompt-selector');
    if (basePromptSelect) {
        basePromptSelect.addEventListener('change', (e) => {
            activeBasePromptId = e.target.value;
            saveActiveBasePromptId(activeBasePromptId);
            renderView();
            const prompt = getActiveBasePrompt();
            if (prompt) {
                showToast(`Base prompt: ${prompt.label}`);
            } else {
                showToast('Base prompt cleared');
            }
        });
    }


    if (sortByRandomBtn) sortByRandomBtn.addEventListener('click', () => {
        randomSortActive = true;
        sortByRandomBtn.classList.add('active');
        renderView();
    });

    const saveFavoritesBtn = document.getElementById('save-favorites-btn');
    const importFavoritesBtn = document.getElementById('import-favorites-btn');
    const exportTxtBtn = document.getElementById('export-txt-btn');

    importFavoritesBtn.addEventListener('click', () => {
        importFavoritesInput.click();
    });

    importFavoritesInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (!data.favorites || !Array.isArray(data.favorites)) {
                    throw new Error('Invalid file format');
                }

                let importedCount = 0;
                const favTransaction = db.transaction(STORE_NAME, 'readwrite');
                const favStore = favTransaction.objectStore(STORE_NAME);

                data.favorites.forEach(fav => {

                    if (fav.id && !favorites.has(String(fav.id))) {
                        // Support both the current (rating) and legacy (timestamp/boolean) formats
                        const rating = (typeof fav.rating === 'number' && fav.rating >= 1 && fav.rating <= MAX_RATING)
                            ? fav.rating
                            : 1;
                        favStore.put({ id: String(fav.id), rating });
                        importedCount++;
                    }
                });

                await new Promise(resolve => favTransaction.oncomplete = resolve);
                await loadFavoritesFromDB();

                if (data.folderData && Array.isArray(data.folderData.folders) && typeof data.folderData.folderArtists === 'object') {
                    const { folders, folderArtists } = data.folderData;
                    const folderTx = db.transaction(['folders', 'folder_artists'], 'readwrite');
                    const foldersStore = folderTx.objectStore('folders');
                    const folderArtistsStore = folderTx.objectStore('folder_artists');

                    foldersStore.clear();
                    folderArtistsStore.clear();

                    folders.forEach(folder => {

                        if (folder.id && folder.name) {
                            foldersStore.put(folder);
                        }
                    });

                    for (const [folderId, artistIds] of Object.entries(folderArtists)) {
                        if (folderId && Array.isArray(artistIds)) {

                            folderArtistsStore.put({ folderId, artistIds: artistIds });
                        }
                    }

                    await new Promise(resolve => folderTx.oncomplete = resolve);

                    if (window.appFolders && window.appFolders.loadData) {
                        await window.appFolders.loadData();
                    }
                }

                showToast(importedCount > 0 
                    ? `${importedCount} new favorites imported!`
                    : 'No new favorites to import.');
                renderView();

                if (currentView === 'favorites') {
                    styleCounter.innerHTML = `Rated Styles: <span class="style-count-number">${favorites.size.toLocaleString('en-US')}</span>`;
                }

            } catch (error) {
                console.error('Error importing favorites:', error);
                showToast('Error: Could not import favorites. Invalid file.');
            } finally {

                importFavoritesInput.value = '';
            }
        };
        reader.readAsText(file);
    });

    saveFavoritesBtn.addEventListener('click', () => {
        if (favorites.size === 0) {
            showToast('You have no favorites to save.');
            return;
        }

        // Build enhanced style objects with name, descriptor, categories
        const favoritesWithDetails = [];
        favorites.forEach((rating, id) => {
            const item = allItems.find(i => i.id === id);
            const style = item ? {
                id: id,
                name: item.name || 'Style',
                descriptor: item.descriptor || item.artist,
                categories: item.categories || [],
                rating: rating
            } : { id: id, name: 'Style', descriptor: '', categories: [], rating: rating };
            favoritesWithDetails.push(style);
        });

        const favoritesToSave = favoritesWithDetails
            .sort((a, b) => b.rating - a.rating);

        const exportData = {
            metadata: {
                appName: "Krea 2 Turbo - Style Explorer",
                exportDate: new Date().toISOString(),
                favoritesCount: favoritesToSave.length
            },
            favorites: favoritesToSave,

            folderData: null
        };

        if (window.appFolders) {
            const folders = window.appFolders.folders;
            const folderArtists = window.appFolders.folderArtists;

            if (folders && folderArtists) {

                const folderArtistsObj = Object.fromEntries(folderArtists.entries());
                exportData.folderData = {
                    folders: folders,
                    folderArtists: folderArtistsObj
                };
            }
        }

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `krea-style-favorites-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Favorites exported to JSON file!');
    });

    exportTxtBtn.addEventListener('click', () => {
        if (favorites.size === 0) {
            showToast('You have no favorites to save.');
            return;
        }

        let artistIdsToExport = [];
        let folderName = 'all';

        if (window.innerWidth > 992 && window.appFolders) {
            const { activeFolderId, getArtistIdsInFolder, getUnsortedArtistIds, getFolderName } = window.appFolders;
            if (activeFolderId === 'unsorted') {
                artistIdsToExport = Array.from(getUnsortedArtistIds());

                artistIdsToExport.sort((a, b) => (favorites.get(b) || 0) - (favorites.get(a) || 0));
            } else {

                artistIdsToExport = getArtistIdsInFolder(activeFolderId);
            }
            folderName = getFolderName(activeFolderId).replace(/\s+/g, '-').toLowerCase();
        } else {

            artistIdsToExport = Array.from(favorites.keys())
                .sort((a, b) => (favorites.get(b) || 0) - (favorites.get(a) || 0));
        }

        // Build export with style names and descriptors
        const exportLines = artistIdsToExport.map(id => {
            const item = allItems.find(i => i.id === id);
            const name = item ? (item.name || item.artist || 'Style') : 'Style';
            const descriptor = item ? (item.descriptor || item.artist) : '';
            return name + ': ' + descriptor;
        });

        const textContent = exportLines.join('\n');
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `krea-favorites-${folderName}-${date}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('TXT export complete!');
    });

    const exportImgUrlsBtn = document.getElementById('export-img-urls-btn');

    if (exportImgUrlsBtn) {
        if (!ENABLE_IMAGE_URL_EXPORT) {
            exportImgUrlsBtn.style.display = 'none';
        } else {
            exportImgUrlsBtn.addEventListener('click', () => {
                if (favorites.size === 0) {
                    showToast('You have no favorites to save.');
                    return;
                }

                let artistIdsToExport = [];
                let folderName = 'all';

                if (window.innerWidth > 992 && window.appFolders) {
                    const { activeFolderId, getArtistIdsInFolder, getUnsortedArtistIds, getFolderName } = window.appFolders;
                    if (activeFolderId === 'unsorted') {
                        artistIdsToExport = Array.from(getUnsortedArtistIds());
                        artistIdsToExport.sort((a, b) => (favorites.get(b) || 0) - (favorites.get(a) || 0));
                    } else {
                        artistIdsToExport = getArtistIdsInFolder(activeFolderId);
                    }
                    folderName = getFolderName(activeFolderId).replace(/\s+/g, '-').toLowerCase();
                } else {
                    artistIdsToExport = Array.from(favorites.keys())
                        .sort((a, b) => (favorites.get(b) || 0) - (favorites.get(a) || 0));
                }

                const imageUrls = artistIdsToExport.map(id => {
                    const artistData = allItems.find(item => item.id === id);
                    if (!artistData || !artistData.image) return null;

                    // Served over http(s): build an absolute URL from the current page location
                    if (window.location.protocol.startsWith('http')) {
                        return new URL(artistData.image, window.location.href).href;
                    }

                    // Local (file://): build an absolute file path (forward slashes for cross-platform use)
                    const basePath = decodeURIComponent(window.location.href.substring(0, window.location.href.lastIndexOf('/')));
                    return `${basePath}/${artistData.image}`.replace('file:///', '');
                }).filter(Boolean);

                const textContent = imageUrls.join('\n');
                const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                const date = new Date().toISOString().slice(0, 10);
                a.download = `krea-favorites-urls-${folderName}-${date}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }
    }

    searchInput.addEventListener('input', (e) => {
        const newSearchTerm = e.target.value.toLowerCase().trim();
        const isSearching = newSearchTerm.length > 0;
        clearSearchBtn.style.display = isSearching ? 'flex' : 'none';

        if (searchTerm.length > 0 && !isSearching) {
            startIndexOffset = 0;
        }

        searchTerm = newSearchTerm;
        updateControlsState();
        renderView();

        // Keep the counter in sync with the current selection + search
        if (currentView === 'gallery') {
            styleCounter.innerHTML = `Prompt-based styles: <span class="style-count-number">${filteredCount().toLocaleString('en-US')}</span>`;
        }
    });
    
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';

        const event = new Event('input', { bubbles: true });
        searchInput.dispatchEvent(event);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && window.innerWidth <= 992) {
            e.preventDefault();
            e.target.blur();
        }
    });

    function handleGridHotkeys(e) {

        if (e.target.tagName === 'INPUT') return;

        if (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) {
            return;
        }

        const key = parseInt(e.key, 10);

        if (key >= 4 && key <= 9) {
            gridSlider.value = key;
            updateGridColumns(key);
            triggerGridSave(key);
        }

        else if (key === 0) {
            gridSlider.value = 10;
            updateGridColumns(10);
            triggerGridSave(10);
        }
    }

    document.addEventListener('keydown', handleGridHotkeys);

    let gridUpdateTimeout;
    const GRID_COLUMN_KEY = 'gridColumnCount';

    function updateGridColumns(value) {
        document.documentElement.style.setProperty('--grid-columns', value);
        gridSliderValue.textContent = value;
    }

    function triggerGridSave(value) {

        clearTimeout(gridUpdateTimeout);
        gridUpdateTimeout = setTimeout(() => {
            localStorage.setItem(GRID_COLUMN_KEY, value);

            setTimeout(checkAndLoadMoreIfContentDoesNotFillScreen, 100);
        }, 500);
    }

    gridSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        updateGridColumns(value);
        triggerGridSave(value);
    });

    if (window.innerWidth > 992) {
        let savedColumnCount = parseInt(localStorage.getItem(GRID_COLUMN_KEY) || '5', 10);

        if (savedColumnCount < 4) {
            savedColumnCount = 4;
            localStorage.setItem(GRID_COLUMN_KEY, savedColumnCount);
        }
        gridSlider.value = savedColumnCount;
        updateGridColumns(savedColumnCount);
    }

    const savedFoldersVisible = localStorage.getItem(FOLDERS_PANEL_VISIBLE_KEY);
    if (savedFoldersVisible !== null) {
        isFoldersPanelVisible = savedFoldersVisible === 'true';
    }

    updateToggleFoldersButton();

    initDB()
        .then(() => {
            renderBasePromptSelector();
            loadInitialData();
            // Apply any hash-based view from the shared header on first load
            handleHashNavigation();
        })
        .catch(err => {
            console.error(err);
            galleryContainer.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">Failed to initialize database.</p>';
        });
});
