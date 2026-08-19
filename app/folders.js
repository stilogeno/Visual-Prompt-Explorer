document.addEventListener('DOMContentLoaded', () => {
    const FOLDERS_STORE_NAME = 'folders';
    const FOLDER_ARTISTS_STORE_NAME = 'folder_artists';

    const foldersPanelWrapper = document.getElementById('folders-panel-wrapper');
    const foldersListContainer = document.getElementById('folders-list');
    const addFolderBtn = document.getElementById('add-folder-btn');
    const galleryContainer = document.getElementById('gallery-container');

    let folders = [];
    let folderArtists = new Map();
    let allItemsMap = new Map();
    let activeFolderId = 'unsorted';
    let db;

    function initFolders() {
        db = window.appGlobals.db;
        if (!db) {
            console.error("Database not initialized in app.js");
            return;
        }

        if (window.appGlobals.allItems) {
            window.appGlobals.allItems.forEach(item => {
                allItemsMap.set(item.id, item);
            });
        }
        setupScrollListener();
        loadDataAndRender();
    }

    async function loadDataAndRender() {
        await loadFolders();
        await loadFolderArtists();
        renderFolders();
    }

    function loadFolders() {
        return new Promise(resolve => {
            const transaction = db.transaction(FOLDERS_STORE_NAME, 'readonly');
            const store = transaction.objectStore(FOLDERS_STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => {
                folders = request.result.sort((a, b) => a.name.localeCompare(b.name));
                resolve();
            };
        });
    }

    function loadFolderArtists() {
        return new Promise(resolve => {
            folderArtists.clear();
            const transaction = db.transaction(FOLDER_ARTISTS_STORE_NAME, 'readonly');
            const store = transaction.objectStore(FOLDER_ARTISTS_STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => {
                request.result.forEach(item => {
                    folderArtists.set(item.folderId, item.artistIds);
                });
                resolve();
            };
        });
    }

    function renderFolders() {
        if (!foldersListContainer) return;
        foldersListContainer.innerHTML = '';

        const unsortedFolderEl = createUnsortedFolderElement();
        foldersListContainer.appendChild(unsortedFolderEl);

        folders.forEach(folder => {
            const folderEl = createFolderElement(folder);
            if (folder.id === activeFolderId) folderEl.classList.add('active');
            foldersListContainer.appendChild(folderEl);
        });

        if (addFolderBtn) {
            foldersListContainer.appendChild(addFolderBtn);
        }

    }

    function setupScrollListener() {
        foldersListContainer.addEventListener('wheel', (e) => {
            const el = foldersListContainer;
            const { deltaY } = e;
            const { scrollTop, scrollHeight, clientHeight } = el;

            if (scrollHeight <= clientHeight) {

                return;
            }

            if (deltaY > 0) {

                if (scrollTop < scrollHeight - clientHeight) {
                    e.preventDefault();
                    el.scrollTop += deltaY;
                }
            } else {

                if (scrollTop > 0) {
                    e.preventDefault();
                    el.scrollTop += deltaY;
                }
            }
        }, { passive: false });
    }

    function getUnsortedArtistIds() {
        const favorites = window.appGlobals.favorites;
        if (!favorites) return new Set();

        const allCategorizedArtists = new Set();
        for (const artistIdArray of folderArtists.values()) {
            artistIdArray.forEach(item => allCategorizedArtists.add(item.id));
        }

        const favoriteArtistIds = Array.from(favorites.keys());
        return new Set(favoriteArtistIds.filter(id => !allCategorizedArtists.has(id)));
    }

    function createUnsortedFolderElement() {
        const favorites = window.appGlobals.favorites;
        const unsortedArtistIdsSet = getUnsortedArtistIds();
        const unsortedArtistIds = Array.from(unsortedArtistIdsSet);

        unsortedArtistIds.sort((a, b) => favorites.get(b) - favorites.get(a));

        const unsortedCount = unsortedArtistIds.length;
        let lastUnsortedArtistImage = null;

        if (unsortedArtistIds.length > 0) {
            const lastUnsortedArtistId = unsortedArtistIds[0];
            const artistData = allItemsMap.get(lastUnsortedArtistId);
            if (artistData) {
                lastUnsortedArtistImage = artistData.image;
            }
        }

        const item = document.createElement('div');
        item.className = 'folder-item folder-item--unsorted';
        item.dataset.folderId = 'unsorted';
        if (activeFolderId === 'unsorted') {
            item.classList.add('active');
        }

        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'folder-item-thumbnail-container';

        if (lastUnsortedArtistImage) {
            thumbnailContainer.style.backgroundImage = `url('${lastUnsortedArtistImage}')`;
            const thumbnailImg = document.createElement('img');
            thumbnailImg.src = lastUnsortedArtistImage;
            thumbnailImg.alt = 'Unsorted';
            thumbnailImg.className = 'folder-item-thumbnail';
            thumbnailImg.loading = 'lazy';
            thumbnailContainer.appendChild(thumbnailImg);
        }

        item.innerHTML = `
            <span class="folder-name">Unsorted</span>
            <span class="folder-count">${unsortedCount}</span>
        `;
        item.appendChild(thumbnailContainer);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'folder-delete-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Clear all unsorted favorites';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleClearUnsortedFolder();
        });
        item.insertBefore(deleteBtn, item.firstChild);

        item.addEventListener('click', () => {
            setActiveFolder('unsorted');
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            item.classList.add('drag-over');
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');

            window.appGlobals.showToast('This artist is already in Unsorted.');
        });

        return item;
    }

    function createFolderElement(folder) {
        const item = document.createElement('div');
        item.className = 'folder-item';
        item.dataset.folderId = folder.id;

        const artistCount = (folderArtists.get(folder.id) || []).length;

        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'folder-item-thumbnail-container';

        if (folder.lastArtistId) {
            const lastArtistData = allItemsMap.get(folder.lastArtistId);
            const lastArtistImage = lastArtistData?.image;

            thumbnailContainer.style.backgroundImage = `url('${lastArtistImage}')`;
            const thumbnailImg = document.createElement('img');
            thumbnailImg.src = lastArtistImage;
            thumbnailImg.alt = folder.name;
            thumbnailImg.className = 'folder-item-thumbnail';
            thumbnailImg.loading = 'lazy';
            thumbnailContainer.appendChild(thumbnailImg);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'folder-delete-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Delete folder';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteFolder(folder.id, folder.name, artistCount);
        });

        item.innerHTML = `
            <span class="folder-name"></span>
            <span class="folder-count">${artistCount}</span>
        `;
        const folderNameSpan = item.querySelector('.folder-name');
        folderNameSpan.textContent = folder.name;
        item.appendChild(thumbnailContainer);

        item.insertBefore(deleteBtn, item.firstChild);

        item.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') setActiveFolder(folder.id);
        });

        item.addEventListener('dblclick', (e) => {

            if (e.target.tagName === 'INPUT') return;

            item.classList.add('is-renaming');

            const folderNameEl = item.querySelector('.folder-name');
            const oldName = folder.name;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = oldName;
            input.className = 'search-input';

            input.style.position = 'absolute';
            input.style.bottom = '8px';
            input.style.left = '8px';
            input.style.right = '8px';
            input.style.width = 'calc(100% - 16px)';
            input.style.padding = '0';
            input.style.background = 'transparent';
            input.style.border = 'none';
            input.style.color = '#fff';
            input.style.zIndex = '3';
            item.appendChild(input);
            input.focus();

            const saveName = () => {
                const newName = input.value.trim();
                if (newName && newName !== oldName) {
                    folder.name = newName;
                    const transaction = db.transaction(FOLDERS_STORE_NAME, 'readwrite');
                    transaction.objectStore(FOLDERS_STORE_NAME).put(folder);                    
                    folderNameEl.textContent = newName;
                } else {
                    folderNameEl.textContent = oldName;
                }
                input.remove();

                item.classList.remove('is-renaming');
            };

            input.addEventListener('blur', saveName);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    input.blur();
                } else if (e.key === 'Escape') {
                    input.value = oldName;
                    input.blur();
                }
            });
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            item.classList.add('drag-over');
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over'); 
            const data = e.dataTransfer.getData('application/json');
            addArtistToFolder(folder.id, data);
        });

        return item;
    }

    function setActiveFolder(folderId, shouldRender = true) {
        if (activeFolderId === folderId && shouldRender) return;

        activeFolderId = folderId;

        const allFolderItems = foldersListContainer.querySelectorAll('.folder-item');
        allFolderItems.forEach(item => {
            item.classList.toggle('active', item.dataset.folderId === folderId);
        });

        if (shouldRender && window.appGlobals && window.appGlobals.renderView) {
            window.appGlobals.renderView();

        }
    }

    function handleDeleteFolder(folderId, folderName, artistCount) {
        let confirmationMessage = `Are you sure you want to delete the folder "${folderName}"?`;
        if (artistCount > 0) {
            confirmationMessage = `The folder "${folderName}" contains ${artistCount} card(s).\n\nIf you delete it, these cards will also be REMOVED FROM FAVORITES.\n\nAre you sure you want to proceed?`;
        } 

        if (window.confirm(confirmationMessage)) {
            deleteFolder(folderId);
        }
    }

    function handleClearUnsortedFolder() {
        const artistIdsToDelete = getUnsortedArtistIds();
        if (artistIdsToDelete.size === 0) {
            window.appGlobals.showToast("Unsorted folder is already empty.");
            return;
        }

        const confirmationMessage = `Are you sure you want to remove all ${artistIdsToDelete.size} unsorted card(s) from your favorites? This action cannot be undone.`;

        if (window.confirm(confirmationMessage)) {
            const tx = db.transaction(window.appGlobals.STORE_NAME, 'readwrite');
            const favoritesStore = tx.objectStore(window.appGlobals.STORE_NAME);

            artistIdsToDelete.forEach(artistId => favoritesStore.delete(artistId));

            tx.oncomplete = () => {
                artistIdsToDelete.forEach(artistId => window.appGlobals.favorites.delete(artistId));
                window.appGlobals.showToast(`${artistIdsToDelete.size} unsorted card(s) removed from favorites.`);

                renderFolders();
                window.appGlobals.renderView();
            };

            tx.onerror = (event) => {
                window.appGlobals.showToast('Error clearing unsorted favorites.');
                console.error("Error clearing unsorted favorites:", event.target.error);
            };
        }
    }

    function deleteFolder(folderId) {
        const artistIdsToDelete = (folderArtists.get(folderId) || []).map(item => item.id);
        const deletedFolderName = getFolderName(folderId);

        folders = folders.filter(f => f.id !== folderId);

        const tx = db.transaction([FOLDERS_STORE_NAME, FOLDER_ARTISTS_STORE_NAME, window.appGlobals.STORE_NAME], 'readwrite');
        const folderStore = tx.objectStore(FOLDERS_STORE_NAME);
        const folderArtistStore = tx.objectStore(FOLDER_ARTISTS_STORE_NAME);
        const favoritesStore = tx.objectStore(window.appGlobals.STORE_NAME);

        folderStore.delete(folderId);

        folderArtistStore.delete(folderId);

        artistIdsToDelete.forEach(artistId => {
            favoritesStore.delete(artistId);
        });

        tx.oncomplete = () => {

            folderArtists.delete(folderId);
            artistIdsToDelete.forEach(artistId => {
                window.appGlobals.favorites.delete(artistId);
            });

            window.appGlobals.showToast(`Folder "${deletedFolderName}" and ${artistIdsToDelete.length} card(s) deleted.`);

            if (activeFolderId === folderId) {
                setActiveFolder('unsorted');
            } else {
                renderFolders();
            }
        };
        tx.onerror = (event) => {
            window.appGlobals.showToast('Error deleting folder.');
            console.error("Error deleting folder transaction:", event.target.error);
        };
    }

    function createNewFolder() {
        const name = prompt("Enter new folder name:", "New Folder");
        if (name) {
            const newFolder = {
                id: `folder-${Date.now()}`,
                name: name.trim(),
                lastArtistId: null
            };
            folders.push(newFolder);
            folders.sort((a, b) => a.name.localeCompare(b.name));

            const transaction = db.transaction(FOLDERS_STORE_NAME, 'readwrite');
            transaction.objectStore(FOLDERS_STORE_NAME).add(newFolder);
            transaction.oncomplete = () => {
                renderFolders();
            };
        }
    }

    function removeArtistFromPreviousFolder(artistId) {
        let sourceFolderId = null;
        let sourceFolderData = null;

        for (const [folderId, artistIdArray] of folderArtists.entries()) {
            const artistIndex = artistIdArray.findIndex(item => item.id === artistId);
            if (artistIndex !== -1) {
                artistIdArray.splice(artistIndex, 1);
                sourceFolderId = folderId;

                const transaction = db.transaction(FOLDER_ARTISTS_STORE_NAME, 'readwrite');
                const store = transaction.objectStore(FOLDER_ARTISTS_STORE_NAME);
                if (artistIdArray.length > 0) {
                    store.put({ folderId, artistIds: artistIdArray });
                    transaction.oncomplete = () => {

                        renderFolders();
                    };
                } else {
                    store.delete(folderId);
                }

                sourceFolderData = folders.find(f => f.id === folderId);
                break;
            }
        }

        if (sourceFolderData) {

            const artistIdArrayForSource = folderArtists.get(sourceFolderData.id);
            if (artistIdArrayForSource) {
                if (artistIdArrayForSource.length > 0) {

                    const lastArtistId = artistIdArrayForSource.sort((a, b) => b.added - a.added)[0].id;
                    updateFolderThumbnail(sourceFolderData.id, lastArtistId);
                } else {

                    updateFolderThumbnail(sourceFolderData.id, null);
                }
            }
        }
        return sourceFolderId;
    }
    function addArtistToFolder(folderId, data) {
        let artistIds;
        try {

            const parsedData = JSON.parse(data);
            if (Array.isArray(parsedData)) {
                artistIds = parsedData;
            } else {

                artistIds = [String(data)];
            }
        } catch (e) {

            artistIds = [String(data)];
        }

        const artistsToMove = artistIds.filter(id => 
            !folderArtists.get(folderId)?.some(item => item.id === id)
        );

        if (artistsToMove.length === 0) {
            window.appGlobals.showToast('Artist(s) are already in this folder.');
            return;
        }

        const destinationFolderData = folders.find(f => f.id === folderId);
        const lastArtistId = artistsToMove[artistsToMove.length - 1];

        const tx = db.transaction([FOLDER_ARTISTS_STORE_NAME, FOLDERS_STORE_NAME], 'readwrite');
        const folderArtistsStore = tx.objectStore(FOLDER_ARTISTS_STORE_NAME);
        const foldersStore = tx.objectStore(FOLDERS_STORE_NAME);

        artistsToMove.forEach(id => removeArtistFromPreviousFolder(id));

        const targetFolderList = folderArtists.get(folderId) || [];
        artistsToMove.forEach(id => {
            targetFolderList.push({ id, added: Date.now() });
        });
        folderArtists.set(folderId, targetFolderList);
        folderArtistsStore.put({ folderId, artistIds: targetFolderList });

        if (destinationFolderData) {
            destinationFolderData.lastArtistId = lastArtistId;
            foldersStore.put(destinationFolderData);
        }

        tx.oncomplete = () => {

            renderFolders();

            artistsToMove.forEach(id => {
                const cardToRemove = galleryContainer.querySelector(`.card[data-id="${id}"]`);
                if (cardToRemove) {
                    cardToRemove.style.transition = 'opacity 0.3s ease, transform 0.3s ease, max-height 0.3s ease 0.1s, margin 0.3s ease 0.1s, padding 0.3s ease 0.1s';
                    cardToRemove.style.opacity = '0';
                    cardToRemove.style.transform = 'scale(0.9)';
                    cardToRemove.style.maxHeight = '0px';
                    cardToRemove.style.margin = '0';
                    cardToRemove.style.padding = '0';
                    cardToRemove.addEventListener('transitionend', () => cardToRemove.remove(), { once: true });
                }
            });

            if (destinationFolderData) {
                const message = artistsToMove.length > 1
                    ? `${artistsToMove.length} artists moved to "${destinationFolderData.name}"`
                    : `Moved to "${destinationFolderData.name}"`;
                window.appGlobals.showToast(message);
            }

            window.appGlobals.clearSelection();
        };
    }

    function updateFolderThumbnail(folderId, artistId, onCompleteCallback) {
        const transaction = db.transaction(FOLDERS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(FOLDERS_STORE_NAME);
        store.get(folderId).onsuccess = (event) => {
            const folderToUpdate = event.target.result;
            if (folderToUpdate) {
                folderToUpdate.lastArtistId = String(artistId);
                store.put(folderToUpdate);

                const localFolder = folders.find(f => f.id === folderId);
                if (localFolder) {
                    localFolder.lastArtistId = artistId;
                }
            }
        };
        if (onCompleteCallback) {
            transaction.oncomplete = onCompleteCallback;
        }
    }

    if (addFolderBtn) {
        addFolderBtn.addEventListener('click', createNewFolder);
    }

    galleryContainer.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.card');
        if (!card || window.appGlobals.currentView !== 'favorites') return;

        const selectedIds = window.appGlobals.selectedArtistIds;
        const draggedId = card.dataset.id;

        if (selectedIds.has(draggedId)) {
            e.dataTransfer.setData('application/json', JSON.stringify(Array.from(selectedIds)));
        } else {

            window.appGlobals.clearSelection();
            document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
            e.dataTransfer.setData('application/json', JSON.stringify([draggedId]));
        }

        e.dataTransfer.effectAllowed = 'move';
    });

    function getFolderName(folderId, { returnOldNameAfterDeletion = false } = {}) {
        if (folderId === 'unsorted') {
            return 'Unsorted';
        }
        const folder = folders.find(f => f.id === folderId);
        return folder ? folder.name : '';
    }

    function handleFavoriteRemoval(artistId) {
        removeArtistFromPreviousFolder(artistId);
        renderFolders();
    }

    window.appFolders = {
        init: initFolders,
        showPanel: () => { 
            if (foldersPanelWrapper && window.innerWidth > 992) {
                foldersPanelWrapper.style.display = 'block'; 
            }
        },
        hidePanel: () => { if(foldersPanelWrapper) foldersPanelWrapper.style.display = 'none'; },
        get activeFolderId() { return activeFolderId; },
        setActiveFolder: setActiveFolder,
        getArtistIdsInFolder: (folderId) => {
            const items = folderArtists.get(folderId) || [];
            return items.sort((a, b) => b.added - a.added).map(item => item.id);
        },
        getUnsortedArtistIds: getUnsortedArtistIds,
        getFolderName: (folderId, returnOldName) => getFolderName(folderId, { returnOldNameAfterDeletion: returnOldName }),
        handleFavoriteRemoval: handleFavoriteRemoval,
        get folders() { return folders; },
        get folderArtists() { return folderArtists; },
        loadData: loadDataAndRender
    };
});