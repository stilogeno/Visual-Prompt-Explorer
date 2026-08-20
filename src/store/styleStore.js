import { signal, computed, batch } from '@preact/signals';
import { getImagePath, extractCategoriesFromPrompt, generateUniqueName } from '../lib/utils';
import { syncFavorite, fetchGlobalCounts, initSupabase, connectionStatus, getConnectionStatus, isConnected } from '../lib/supabase';
import * as db from './db';

// Re-export Supabase connection status and utils for UI components
export { connectionStatus, getConnectionStatus, isConnected };

// Signals
export const allItems = signal([]);
export const favorites = signal(new Map());
export const currentView = signal('gallery');
export const searchTerm = signal('');
export const selectedStarFilters = signal(new Set([5, 4, 3, 2, 1, 0]));
export const randomSort = signal(false);
export const activeBasePromptId = signal('');
export const gridCols = signal(5);
export const selectedArtistIds = signal(new Set());
export const categoryFilter = signal('');
export const sortOrder = signal('original');
export const showCardDetails = signal(true);
export const builderPrefill = signal(null);

// Style library signals
export const styleLibraryStyles = signal([]);
export const styleLibraryBasePrompts = signal([]);
export const styleLibraryManifestImages = signal({});
export const activeStyleBasePromptId = signal('');
export const sourceFilter = signal('all'); // 'all', 'gallery', 'style'

// Toast
export const toastMessage = signal('');
export const toastVisible = signal(false);
let toastTimer = null;

export function showToast(msg, duration = 2000) {
  toastMessage.value = msg;
  toastVisible.value = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastVisible.value = false; }, duration);
}

// Admin settings
const SETTINGS_KEY = 'krea_admin_settings';
export const adminSettings = signal(loadAdminSettings());

function loadAdminSettings() {
  const defaults = {
    itemsPerPage: 20, sortOrder: 'desc', scrollThreshold: 200,
    gridCols: 5, toastDuration: 2000,
    scrollTopThreshold: 300, supabaseSync: false, imageUrlExport: false,
    debugMode: false,
  };
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.gridCols === 'number' && parsed.gridCols >= 1 && parsed.gridCols <= 10) {
        return { ...defaults, ...parsed };
      }
      return { ...defaults, ...parsed };
    }
  } catch {}
  return defaults;
}

// Computed
export const communityStarsFor = (favs) => Math.min(5, Math.floor((favs || 0) / 4));

export const displayRatingFor = (item) => {
  const favs = favorites.value;
  return favs.get(item.id) || communityStarsFor(item.avg_favs);
};

const MAX_RATING = 5;

// Base prompts
export const BASE_PROMPTS = [
  { id: 'portrait', label: 'Portrait', color: '#ff6b8a', prompt: 'a brown-haired young woman with glasses, seated outside at the old town cafe, drinking orange juice, street in the background, side angle, looking at the viewer, ' },
  { id: 'portrait-v2', label: 'Portrait vol. 2', color: '#ff8fa3', prompt: 'a blonde young woman with glasses, green eyes, seated outside at coastal cafe, holding a small transparent cup of espresso, sea and cliff background, side angle, looking at the viewer,' },
  { id: 'plain-portrait', label: 'Plain Portrait', color: '#ffb3c3', prompt: 'portrait view of a young adult woman with long dark curly hair and brown eyes, wearing a green sweater and small silver earrings, turned slightly to one side while looking at the viewer, against a plain cream-colored background' },
  { id: 'full-figure', label: 'Full Figure', color: '#7c6cff', prompt: 'full-body view of an adult man in a mustard-yellow coat opening a blue umbrella on a rain-wet city street at night' },
  { id: 'architecture', label: 'Architecture', color: '#00c9a7', prompt: 'a narrow street runs between stone buildings toward a red clock tower, a bicycle rests beside a blue door, with several potted plants along the pavement' },
  { id: 'animal-landscape', label: 'Animal and Landscape', color: '#4ecdc4', prompt: 'a brown-and-white cow stands beside a shallow alpine river, with tall grass along the bank, a wooden fence nearby, and the Alps mountains in the distance' },
  { id: 'materials', label: 'Materials', color: '#ffd93d', prompt: 'a clear glass bottle, a metal teapot, a red apple, and a folded blue cloth arranged on a wooden table' },
  { id: 'panoramic-environment', label: 'Panoramic Environment', color: '#6bcb77', prompt: 'a passenger train crosses a stone bridge above a river valley, with a small village below and mountains in the distance' },
];

// Initialize
export async function initStore() {
  await db.initDB();

  const favs = await db.loadFavorites();
  favorites.value = favs;

  // Load gallery data
  if (typeof window.galleryData !== 'undefined' && allItems.value.length === 0) {
    const usedNames = new Set();
    const items = window.galleryData.map(item => {
      const id = String(item.id);
      const prompt = item.prompt || '';
      // Generate unique name from prompt
      const name = generateUniqueName(prompt, usedNames);
      usedNames.add(name);
      // Extract categories from prompt text
      const categories = item.categories && item.categories.length > 0
        ? item.categories
        : extractCategoriesFromPrompt(prompt);
      return {
        artist: prompt,
        image: getImagePath(id, item.folder),
        worksCount: item.post_count,
        id: `gallery-${id}`,
        originalId: id,
        source: 'gallery',
        uniqueness_score: item.uniqueness_score,
        avg_favs: item.avg_favs || item.stars || 0,
        avg_score: item.avg_score,
        name,
        descriptor: prompt,
        categories,
      };
    });
    allItems.value = items;
  }

  // Load style library data
  if (styleLibraryStyles.value.length === 0) {
    try {
      const [catalog, promptConfig, manifest, galleryManifest] = await Promise.all([
        fetch('/style-library/data/styles.json', { cache: 'no-store' }).then(r => r.json()),
        fetch('/style-library/data/base_prompts.json', { cache: 'no-store' }).then(r => r.json()),
        fetch('/style-library/data/generation_manifest.json', { cache: 'no-store' }).then(r => r.json()),
        fetch('/style-library/data/gallery-manifest.json', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      ]);

      const styleList = Array.isArray(catalog.styles) ? catalog.styles : [];
      const prompts = Array.isArray(promptConfig.prompts)
        ? promptConfig.prompts.filter(p => p.enabled !== false)
        : [];
      const images = manifest.images && typeof manifest.images === 'object' ? manifest.images : {};
      
      // Merge gallery manifest images into the images object
      if (galleryManifest?.images) {
        Object.assign(images, galleryManifest.images);
      }

      styleLibraryStyles.value = styleList;
      styleLibraryBasePrompts.value = prompts;
      styleLibraryManifestImages.value = images;

      // Set active style base prompt
      if (prompts.length > 0) {
        const saved = localStorage.getItem('krea2-style-library-base-prompt-v1') || '';
        const valid = prompts.some(p => p.id === saved) ? saved : prompts[0].id;
        activeStyleBasePromptId.value = valid;
      }

      // Create unified style library items
      const usedNames = new Set(allItems.value.map(i => i.name));
      const styleItems = styleList.map(style => {
        const name = generateUniqueName(style.name, usedNames);
        usedNames.add(name);
        return {
          id: `style-${style.id}`,
          originalId: style.id,
          source: 'style',
          artist: style.descriptor,
          image: '',
          name,
          descriptor: style.descriptor,
          categories: style.categories || [],
          avg_favs: 0,
        };
      });

      allItems.value = [...allItems.value, ...styleItems];
    } catch (e) {
      console.warn('[StyleStore] Failed to load style library:', e);
    }
  }

  // Initialize Supabase connection (supports local -> cloud fallback)
  if (adminSettings.value.supabaseSync) {
    const success = await initSupabase();
    if (success) {
      // Sync community counts from Supabase
      try {
        const counts = await fetchGlobalCounts();
        if (counts.size > 0) {
          allItems.value = allItems.value.map(item => {
            if (counts.has(item.originalId)) {
              return { ...item, avg_favs: counts.get(item.originalId) };
            }
            return item;
          });
        }
      } catch (e) {
        console.warn('[StyleStore] Failed to sync counts:', e);
      }
    }
  }
}

// Actions
export function setRating(itemId, rating) {
  const newFavs = new Map(favorites.value);
  if (rating === 0) {
    newFavs.delete(itemId);
  } else {
    newFavs.set(itemId, rating);
  }
  favorites.value = newFavs;
  db.setRating(itemId, rating);
  syncFavorite(itemId, rating);
}

export function removeFavorite(itemId) {
  const newFavs = new Map(favorites.value);
  newFavs.delete(itemId);
  favorites.value = newFavs;
  db.setRating(itemId, 0);
  syncFavorite(itemId, 0);
}

export function toggleStarFilter(star) {
  const next = new Set(selectedStarFilters.value);
  if (next.has(star)) {
    next.delete(star);
  } else {
    next.add(star);
  }
  if (next.size === 0) {
    next.add(5);
  }
  selectedStarFilters.value = next;
}

// Computed: filtered items
export const filteredItems = computed(() => {
  let items = allItems.value;
  const favs = favorites.value;
  const starFilters = selectedStarFilters.value;
  const search = searchTerm.value;
  const view = currentView.value;
  const random = randomSort.value;
  const baseId = activeBasePromptId.value;
  const catFilter = categoryFilter.value;
  const sort = sortOrder.value;
  const srcFilter = sourceFilter.value;
  const styleBaseId = activeStyleBasePromptId.value;
  const manifest = styleLibraryManifestImages.value;

  // Resolve images for style library items
  items = items.map(item => {
    if (item.source === 'gallery') return item;
    
    // Style library item - resolve from manifest
    if (!styleBaseId || !manifest) return { ...item, image: '' };
    
    const record = manifest[`${styleBaseId}/${item.originalId}`];
    const image = record && record.status === 'complete' && record.path ? record.path : '';
    return { ...item, image };
  });

  // Source filter
  if (srcFilter && srcFilter !== 'all') {
    items = items.filter(item => item.source === srcFilter);
  }

  // Sort
  if (random) {
    items = [...items].sort(() => Math.random() - 0.5);
  } else if (sort === 'az') {
    items = [...items].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  } else if (sort === 'za') {
    items = [...items].sort((a, b) => (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' }));
  } else {
    items = [...items].sort((a, b) => displayRatingFor(b) - displayRatingFor(a));
  }

  // Star filter
  if (starFilters.size > 0) {
    items = items.filter(item => starFilters.has(displayRatingFor(item)));
  }

  // Category filter
  if (catFilter) {
    items = items.filter(item => (item.categories || []).includes(catFilter));
  }

  // Search filter
  if (search) {
    const lower = search.toLowerCase();
    items = items.filter(item => {
      const searchable = `${item.name || ''} ${item.artist || ''} ${(item.categories || []).join(' ')}`.toLowerCase();
      return searchable.includes(lower);
    });
  }

  // Base prompt filter (gallery only)
  if (baseId) {
    const bp = BASE_PROMPTS.find(p => p.id === baseId);
    if (bp) {
      const tokens = bp.prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      items = items.filter(item => {
        if (item.source !== 'gallery') return true;
        const p = (item.descriptor || item.artist).toLowerCase();
        return tokens.some(t => p.includes(t));
      });
    }
  }

  // Filter out style items with no image
  items = items.filter(item => item.image);

  return items;
});

// Computed: all unique categories (from both gallery and style library)
export const allCategories = computed(() => {
  const items = allItems.value;
  const cats = new Set();
  items.forEach(item => {
    (item.categories || []).forEach(cat => cats.add(cat));
  });
  // Also add categories from style library styles directly
  styleLibraryStyles.value.forEach(style => {
    (style.categories || []).forEach(cat => cats.add(cat));
  });
  return [...cats].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
});

export function buildCopyText(item) {
  const styleText = item.descriptor || item.artist || '';
  const bp = BASE_PROMPTS.find(p => p.id === activeBasePromptId.value);
  return bp ? `${styleText}, ${bp.prompt}` : styleText;
}

export function exportFavoritesJSON() {
  const favs = favorites.value;
  if (favs.size === 0) { showToast('No favorites to export.'); return; }

  const items = [];
  favs.forEach((rating, id) => {
    const item = allItems.value.find(i => i.id === id);
    items.push({
      id, name: item?.name || 'Style',
      descriptor: item?.descriptor || item?.artist || '',
      categories: item?.categories || [], rating,
    });
  });
  items.sort((a, b) => b.rating - a.rating);

  const exportData = {
    metadata: { appName: 'Visual Prompt Explorer', exportDate: new Date().toISOString(), favoritesCount: items.length },
    favorites: items,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `krea-style-favorites-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Favorites exported!');
}

export function exportFavoritesTXT() {
  const favs = favorites.value;
  if (favs.size === 0) { showToast('No favorites to export.'); return; }

  const ids = Array.from(favs.keys()).sort((a, b) => (favs.get(b) || 0) - (favs.get(a) || 0));

  const lines = ids.map(id => {
    const item = allItems.value.find(i => i.id === id);
    return `${item?.name || 'Style'}: ${item?.descriptor || item?.artist || ''}`;
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `krea-favorites-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('TXT export complete!');
}

export function importFavoritesJSON(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.favorites || !Array.isArray(data.favorites)) throw new Error('Invalid');

        let count = 0;
        const newFavs = new Map(favorites.value);
        for (const fav of data.favorites) {
          if (fav.id && !newFavs.has(String(fav.id))) {
            const rating = (typeof fav.rating === 'number' && fav.rating >= 1 && fav.rating <= 5) ? fav.rating : 1;
            newFavs.set(String(fav.id), rating);
            await db.setRating(String(fav.id), rating);
            count++;
          }
        }
        favorites.value = newFavs;
        showToast(count > 0 ? `${count} new favorites imported!` : 'No new favorites to import.');
        resolve(count);
      } catch {
        showToast('Error: Invalid file.');
        resolve(0);
      }
    };
    reader.readAsText(file);
  });
}