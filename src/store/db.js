const DB_NAME = 'StyleGalleryKrea';
const DB_VERSION = 5;
const FAVORITES_STORE = 'favorites';
const FOLDERS_STORE = 'folders';
const FOLDER_ARTISTS_STORE = 'folder_artists';

let db = null;

export function getDB() { return db; }

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[DB] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      // Handle unexpected database errors (e.g. version migration issues)
      db.onerror = (event) => {
        console.error('[DB] Database error:', event.target.error);
      };
      resolve(db);
    };

    request.onupgradeneeded = (e) => {
      const upgradeDb = e.target.result;
      const tx = e.target.transaction;

      if (!upgradeDb.objectStoreNames.contains(FAVORITES_STORE)) {
        const store = upgradeDb.createObjectStore(FAVORITES_STORE, { keyPath: 'id' });
        store.createIndex('rating', 'rating', { unique: false });
      } else {
        const store = tx.objectStore(FAVORITES_STORE);
        if (!store.indexNames.contains('rating')) {
          store.createIndex('rating', 'rating', { unique: false });
        }
        store.openCursor().onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (cursor) {
            const item = cursor.value;
            if (item && typeof item.rating === 'undefined') {
              cursor.update({ id: item.id, rating: 1 });
            }
            cursor.continue();
          }
        };
      }

      if (!upgradeDb.objectStoreNames.contains(FOLDERS_STORE)) {
        const fs = upgradeDb.createObjectStore(FOLDERS_STORE, { keyPath: 'id' });
        fs.createIndex('name', 'name', { unique: false });
      }

      if (!upgradeDb.objectStoreNames.contains(FOLDER_ARTISTS_STORE)) {
        upgradeDb.createObjectStore(FOLDER_ARTISTS_STORE, { keyPath: 'folderId' });
      }
    };
  });
}

export function loadFavorites() {
  return new Promise((resolve, reject) => {
    if (!db) { resolve(new Map()); return; }
    const tx = db.transaction(FAVORITES_STORE, 'readonly');
    const req = tx.objectStore(FAVORITES_STORE).getAll();
    req.onsuccess = () => resolve(new Map(req.result.map(i => [i.id, i.rating || 0])));
    req.onerror = () => {
      console.error('[DB] Error loading favorites:', req.error);
      resolve(new Map());
    };
    tx.onerror = () => {
      console.error('[DB] Transaction error loading favorites:', tx.error);
      resolve(new Map());
    };
  });
}

export function setRating(id, rating) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Database not initialized')); return; }
    const tx = db.transaction(FAVORITES_STORE, 'readwrite');
    const store = tx.objectStore(FAVORITES_STORE);
    if (rating === 0) {
      store.delete(id);
    } else {
      store.put({ id, rating });
    }
    tx.oncomplete = resolve;
    tx.onerror = () => {
      console.error('[DB] Error setting rating:', tx.error);
      reject(tx.error);
    };
    tx.onabort = () => {
      console.error('[DB] Transaction aborted setting rating:', tx.error);
      reject(tx.error);
    };
  });
}

export function loadFolders() {
  return new Promise((resolve, reject) => {
    if (!db) { resolve([]); return; }
    const tx = db.transaction(FOLDERS_STORE, 'readonly');
    const req = tx.objectStore(FOLDERS_STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.name.localeCompare(b.name)));
    req.onerror = () => {
      console.error('[DB] Error loading folders:', req.error);
      resolve([]);
    };
    tx.onerror = () => {
      console.error('[DB] Transaction error loading folders:', tx.error);
      resolve([]);
    };
  });
}

export function loadFolderArtists() {
  return new Promise((resolve, reject) => {
    if (!db) { resolve(new Map()); return; }
    const tx = db.transaction(FOLDER_ARTISTS_STORE, 'readonly');
    const req = tx.objectStore(FOLDER_ARTISTS_STORE).getAll();
    req.onsuccess = () => {
      const map = new Map();
      req.result.forEach(i => map.set(i.folderId, i.artistIds));
      resolve(map);
    };
    req.onerror = () => {
      console.error('[DB] Error loading folder artists:', req.error);
      resolve(new Map());
    };
    tx.onerror = () => {
      console.error('[DB] Transaction error loading folder artists:', tx.error);
      resolve(new Map());
    };
  });
}

export function saveFolder(folder) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Database not initialized')); return; }
    const tx = db.transaction(FOLDERS_STORE, 'readwrite');
    tx.objectStore(FOLDERS_STORE).put(folder);
    tx.oncomplete = resolve;
    tx.onerror = () => {
      console.error('[DB] Error saving folder:', tx.error);
      reject(tx.error);
    };
    tx.onabort = () => {
      console.error('[DB] Transaction aborted saving folder:', tx.error);
      reject(tx.error);
    };
  });
}

export function deleteFolder(folderId) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Database not initialized')); return; }
    const tx = db.transaction([FOLDERS_STORE, FOLDER_ARTISTS_STORE], 'readwrite');
    tx.objectStore(FOLDERS_STORE).delete(folderId);
    tx.objectStore(FOLDER_ARTISTS_STORE).delete(folderId);
    tx.oncomplete = resolve;
    tx.onerror = () => {
      console.error('[DB] Error deleting folder:', tx.error);
      reject(tx.error);
    };
    tx.onabort = () => {
      console.error('[DB] Transaction aborted deleting folder:', tx.error);
      reject(tx.error);
    };
  });
}

export function saveFolderArtists(folderId, artistIds) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Database not initialized')); return; }
    const tx = db.transaction(FOLDER_ARTISTS_STORE, 'readwrite');
    tx.objectStore(FOLDER_ARTISTS_STORE).put({ folderId, artistIds });
    tx.oncomplete = resolve;
    tx.onerror = () => {
      console.error('[DB] Error saving folder artists:', tx.error);
      reject(tx.error);
    };
    tx.onabort = () => {
      console.error('[DB] Transaction aborted saving folder artists:', tx.error);
      reject(tx.error);
    };
  });
}

export function removeFolderArtists(folderId) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Database not initialized')); return; }
    const tx = db.transaction(FOLDER_ARTISTS_STORE, 'readwrite');
    tx.objectStore(FOLDER_ARTISTS_STORE).delete(folderId);
    tx.oncomplete = resolve;
    tx.onerror = () => {
      console.error('[DB] Error removing folder artists:', tx.error);
      reject(tx.error);
    };
    tx.onabort = () => {
      console.error('[DB] Transaction aborted removing folder artists:', tx.error);
      reject(tx.error);
    };
  });
}

export function bulkDeleteFavorites(ids) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Database not initialized')); return; }
    const tx = db.transaction(FAVORITES_STORE, 'readwrite');
    const store = tx.objectStore(FAVORITES_STORE);
    ids.forEach(id => store.delete(id));
    tx.oncomplete = resolve;
    tx.onerror = () => {
      console.error('[DB] Error bulk deleting favorites:', tx.error);
      reject(tx.error);
    };
    tx.onabort = () => {
      console.error('[DB] Transaction aborted bulk deleting favorites:', tx.error);
      reject(tx.error);
    };
  });
}
