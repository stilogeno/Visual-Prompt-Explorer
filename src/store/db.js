const DB_NAME = 'StyleGalleryKrea';
const DB_VERSION = 5;
const FAVORITES_STORE = 'favorites';

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