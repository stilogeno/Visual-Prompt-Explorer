document.addEventListener('DOMContentLoaded', () => {

    const getGlobal = (name) => window.appGlobals?.[name];
    const adminSettings = getGlobal('adminSettings') || {};

    const PRELOAD_WINDOW = adminSettings.preloadWindow || 15;
    const PRELOAD_TRIGGER_OFFSET = adminSettings.preloadTrigger || 5;
    const LIKE_FEEDBACK_DURATION = adminSettings.likeFeedback || 600;

    const swipeOverlay = document.getElementById('swipe-mode-overlay');
    if (!swipeOverlay) return;

    const swipeContainer = document.getElementById('swipe-container');
    const prevImage = document.getElementById('swipe-prev-image');
    const currentImage = document.getElementById('swipe-current-image');
    const nextImage = document.getElementById('swipe-next-image');
    const counterElement = document.getElementById('swipe-counter');
    const artistNameElement = document.getElementById('swipe-artist-name');
    const closeSwipeBtn = document.getElementById('swipe-close-btn');
    const likeFeedbackElement = document.getElementById('swipe-like-feedback');
    const startSwipeBtn = document.getElementById('start-swipe-mode-btn');
    const favoritesCountElement = document.getElementById('swipe-favorites-count');

    let currentIndex = -1;
    let activeList = [];
    let likeAnimationTimeout;

    let preloadedAheadIndex = -1;
    let preloadedBehindIndex = -1;

    function preloadAhead() {
        if (!activeList.length) return;
        const start = preloadedAheadIndex + 1;
        const end = Math.min(start + PRELOAD_WINDOW, activeList.length);
        for (let i = start; i < end; i++) {
            const img = new Image();
            img.src = activeList[i].image;
        }
        preloadedAheadIndex = end - 1;
    }

    function preloadBehind() {
        if (!activeList.length) return;
        const start = preloadedBehindIndex - 1;
        const end = Math.max(start - PRELOAD_WINDOW, -1);

        for (let i = start; i > end; i--) {
            const img = new Image();
            img.src = activeList[i].image;
        }
        preloadedBehindIndex = end + 1;
    }

    function openSwipeMode(cardElement) {
        const currentView = getGlobal('currentView');

        if (currentView === 'favorites') {
            return;
        }

        const artistId = cardElement?.dataset.id;
        const allCurrentItems = getGlobal('currentItems');
        const favorites = getGlobal('favorites');
        const showToast = getGlobal('showToast');

        activeList = allCurrentItems.filter(item => !favorites.has(item.id));

        if (activeList.length <= 1) {
            if (showToast) {
                if (allCurrentItems.length > 1 && activeList.length === 0) {
                    showToast('All visible artists are already in favorites!');
                } else {
                    showToast('Not enough cards to start swipe mode.');
                }
            }
            return;
        }

        if (artistId) {
            const isClickedCardFavorite = favorites.has(artistId);
            if (isClickedCardFavorite) {

                const originalClickedIndex = allCurrentItems.findIndex(item => item.id === artistId);
                let nextAvailableItem = null;
                for (let i = originalClickedIndex + 1; i < allCurrentItems.length; i++) {
                    if (!favorites.has(allCurrentItems[i].id)) {
                        nextAvailableItem = allCurrentItems[i];
                        break;
                    }
                }

                currentIndex = nextAvailableItem ? activeList.findIndex(item => item.id === nextAvailableItem.id) : 0;
            } else {

                currentIndex = activeList.findIndex(item => item.id === artistId);
            }
        } else {

            currentIndex = 0;
        }

        if (favoritesCountElement) {
            favoritesCountElement.textContent = favorites ? favorites.size : 0;
        }
        document.body.style.overflow = 'hidden';
        swipeOverlay.classList.add('visible');
        updateSwipeView();

        preloadedAheadIndex = currentIndex - 1;
        preloadedBehindIndex = currentIndex + 1;
        preloadAhead();

        document.addEventListener('keydown', handleSwipeKeyPress);
    }

    function closeSwipeMode() {
        swipeOverlay.classList.remove('visible');
        document.body.style.overflow = '';
        const updateVisibleFavorites = getGlobal('updateVisibleFavorites');
        if (updateVisibleFavorites) {

            updateVisibleFavorites();
        }

        document.removeEventListener('keydown', handleSwipeKeyPress);
    }

    function updateSwipeView() {
        if (currentIndex < 0 || currentIndex >= activeList.length) return;

        const prevIndex = (currentIndex - 1 + activeList.length) % activeList.length;
        const nextIndex = (currentIndex + 1) % activeList.length;

        const currentItem = activeList[currentIndex];
        const prevItem = activeList[prevIndex];
        const nextItem = activeList[nextIndex];

        currentImage.src = currentItem.image;
        prevImage.src = prevItem.image;
        nextImage.src = nextItem.image;

        counterElement.textContent = `${currentIndex + 1} / ${activeList.length}`;
        artistNameElement.textContent = currentItem.artist.length > 50 
        ? currentItem.artist.slice(0, 50) + '...' 
        : currentItem.artist;

        swipeContainer.classList.remove('swipe-transition');
        void swipeContainer.offsetWidth;
        swipeContainer.classList.add('swipe-transition');
    }

    function navigate(direction) {
        if (!activeList.length) return;

        clearTimeout(likeAnimationTimeout);
        likeFeedbackElement.classList.remove('show');

        currentIndex = (currentIndex + direction + activeList.length) % activeList.length;
        updateSwipeView();

        if (direction > 0 && currentIndex + PRELOAD_TRIGGER_OFFSET >= preloadedAheadIndex) {
            preloadAhead();
        }

        if (direction < 0 && (currentIndex - PRELOAD_TRIGGER_OFFSET <= preloadedBehindIndex || currentIndex > preloadedBehindIndex)) {
             preloadBehind();
        }
    }

    function addToFavorites() {
        const db = getGlobal('db');
        const STORE_NAME = getGlobal('STORE_NAME');
        const favorites = getGlobal('favorites');
        const showToast = getGlobal('showToast');

        if (currentIndex === -1 || !db || !STORE_NAME || !favorites) return;

        const item = activeList[currentIndex];

        if (favorites.has(item.id)) {
            if (showToast) showToast('Already in favorites!');
            return;
        }

        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const favItem = { id: item.id, rating: 1 };
        store.put(favItem);

        transaction.oncomplete = () => {
            favorites.set(item.id, favItem.rating);
            if (showToast) showToast('Added to favorites');

            if (favoritesCountElement) {
                favoritesCountElement.textContent = favorites.size;
            }

            artistNameElement.classList.add('favorited-feedback');
            setTimeout(() => artistNameElement.classList.remove('favorited-feedback'), LIKE_FEEDBACK_DURATION);

            clearTimeout(likeAnimationTimeout);
            likeFeedbackElement.classList.add('show');
            likeAnimationTimeout = setTimeout(() => likeFeedbackElement.classList.remove('show'), LIKE_FEEDBACK_DURATION);
        };
    }

    function handleSwipeKeyPress(e) {

        switch (e.code) {
            case 'ArrowLeft':
                navigate(-1);
                break;
            case 'ArrowRight':
                navigate(1);
                break;
            case 'KeyC':
                const fullArtistName = activeList[currentIndex]?.artist;
                if (fullArtistName) {
                    const textToCopy = "Style: " + fullArtistName;
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(textToCopy).then(() => {
                            getGlobal('showToast')('Style copied to clipboard!');
                            artistNameElement.classList.add('copied-feedback');
                            setTimeout(() => {
                                artistNameElement.classList.remove('copied-feedback');
                            }, LIKE_FEEDBACK_DURATION);
                        }).catch(() => {
                            fallbackSwipeCopyText(textToCopy);
                        });
                    } else {
                        fallbackSwipeCopyText(textToCopy);
                    }
                }
                break;
            case 'ArrowDown':
                addToFavorites();
                break;
            case 'Escape':
                closeSwipeMode();
                break;
        }
    }

    document.getElementById('gallery-container').addEventListener('mousedown', (e) => {

        if (e.button === 1) {
            e.preventDefault(); 
            const card = e.target.closest('.card');
            if (!card) return;

            const currentView = getGlobal('currentView');
            const searchTerm = getGlobal('searchTerm');

            if (currentView === 'favorites') {

                document.getElementById('tab-gallery').click();
            } else if (currentView === 'gallery' && (!searchTerm || searchTerm.length === 0)) {

                if (card) {
                    openSwipeMode(card);
                }
            }
        }
    });

    if (startSwipeBtn) {
        startSwipeBtn.addEventListener('click', () => openSwipeMode(null));
    }

    closeSwipeBtn.addEventListener('click', closeSwipeMode);

    swipeOverlay.addEventListener('click', (e) => {
        if (e.target === swipeOverlay) {
            closeSwipeMode();
        }
    });

    function fallbackSwipeCopyText(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            getGlobal('showToast')('Style copied to clipboard!');
        } catch (e) {
            console.warn('Swipe copy failed:', e);
        }
        document.body.removeChild(textarea);
    }

    window.appSwipe = {
        open: openSwipeMode
    };
});