# Architecture

The Visual Prompt Explorer is a **Preact/Vite single-page application**. All state is managed via Preact signals, persisted to IndexedDB, and optionally synced to Supabase.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| UI | Preact 10 + JSX | 3KB component framework |
| State | @preact/signals | Reactive signals + computed |
| Routing | preact-router | Client-side SPA routing |
| Build | Vite 8 | Dev server, bundling, HMR |
| PWA | vite-plugin-pwa | Service worker, offline cache |
| Persistence | IndexedDB (via idb) | Local favorites, settings |
| Cloud | Supabase JS | Community rating sync |

## Application Tree

```
main.jsx
  └── App.jsx (Router)
        ├── GalleryPage        path="/"
        ├── PromptBuilderPage  path="/prompt-builder"
        └── AdminPage          path="/admin"
```

`RedirectHandler` in App.jsx maps legacy HTML filenames to SPA routes.

## Component Tree

### GalleryPage

```
GalleryPage
  ├── Header              Nav tabs + connection status
  ├── Controls            Source filter, star filters, sort, grid slider
  ├── Card × N            Gallery items (infinite scroll)
  ├── ViewerModal         Full-size viewer with actions
  ├── Enhancements        Keyboard shortcuts (S, M, V, ?)
  └── Toast               Notification toasts
```

### PromptBuilderPage

```
PromptBuilderPage
  ├── Header
  ├── Quick Build mode    Blog context + style presets → prompt cards
  ├── Detailed mode       Subject + style selection → prompt cards
  └── Toast
```

### AdminPage

```
AdminPage
  ├── Header
  ├── Display settings    Grid cols, toast duration, scroll thresholds
  ├── AI/LLM config       Model, embeddings, timeout, NSFW toggle
  ├── Supabase settings   Connection URL, sync toggle
  └── Data management     Export/import favorites, reset settings
```

## Store: `styleStore.js`

All application state lives in Preact signals exported from `styleStore.js`.

### Primary Signals

| Signal | Type | Purpose |
|--------|------|---------|
| `allItems` | `signal<Item[]>` | All gallery + style library items |
| `favorites` | `signal<Map<id, rating>>` | Personal star ratings (1–5) |
| `currentView` | `signal<'gallery'\|'favorites'>` | Active view mode |
| `searchTerm` | `signal<string>` | Current search query |
| `selectedStarFilters` | `signal<Set<number>>` | Active star filter levels |
| `randomSort` | `signal<boolean>` | Randomize order |
| `activeBasePromptId` | `signal<string>` | Selected base prompt |
| `gridCols` | `signal<number>` | Grid columns (1–10) |
| `categoryFilter` | `signal<string>` | Active category filter |
| `sortOrder` | `signal<string>` | 'original', 'az', 'za' |
| `showCardDetails` | `signal<boolean>` | Show categories on cards |
| `sourceFilter` | `signal<string>` | 'all', 'gallery', 'style' |
| `activeStyleBasePromptId` | `signal<string>` | Style library base prompt |
| `builderPrefill` | `signal<object\|null>` | Prefill data for Prompt Builder |

### Computed Properties

| Computed | Returns | Purpose |
|----------|---------|---------|
| `filteredItems` | `Item[]` | Filtered + sorted items for gallery |
| `allCategories` | `string[]` | Unique categories across all items |
| `displayRatingFor(item)` | `number` | Personal rating or community default |

### Item Shape

```js
{
  id: 'gallery-abc123',        // Unique ID (source-prefixed)
  originalId: 'abc123',        // Original data ID
  source: 'gallery',           // 'gallery' or 'style'
  artist: 'cinematic, ...',    // Full prompt text
  image: '/images/1/abc123.webp', // Resolved image path
  name: 'Cinematic Drama',     // Auto-generated display name
  descriptor: 'cinematic, ...', // Short prompt for display
  categories: ['cinematic'],   // Extracted categories
  avg_favs: 12,                // Community likes
  avg_score: 0.92,             // Quality score
  uniqueness_score: 0.7,       // Uniqueness metric
}
```

## Data Flow

### Initialization

```
main.jsx → App.jsx → GalleryPage
  → initStore()
    → db.initDB()                         Open IndexedDB
    → db.loadFavorites()                  Load personal ratings
    → db.loadFolders()                    Load folder data
    → window.galleryData                  Load gallery items from <script>
    → fetch('/style-library/data/*.json') Load style library + manifests
    → initSupabase()                      Connect to cloud (if enabled)
    → fetchGlobalCounts()                 Sync community counts
```

### Filtering Pipeline (`filteredItems` computed)

```
allItems
  → Resolve style library images from manifest
  → Source filter (all / gallery / style)
  → Sort (rating / A–Z / Z–A / random)
  → Star filter
  → Category filter
  → Favorites view (if active)
  → Search filter
  → Base prompt keyword filter (gallery only)
  → Filter out items with no image
  = filteredItems
```

## Image Resolution

### Gallery Items

Static images at `images/{folder}/{id}.webp`. Path resolved at init via `getImagePath()`.

### Style Library Items

Dynamic images resolved from `generation_manifest.json` based on the active base prompt:

```
manifest["{basePromptId}/{styleId}"] → { status: 'complete', path: '...' }
```

The `filteredItems` computed re-resolves images whenever `activeStyleBasePromptId` changes.

## Manifest System

| File | Purpose |
|------|---------|
| `style-library/data/styles.json` | Style definitions (name, descriptor, categories) |
| `style-library/data/base_prompts.json` | Base prompt configs (id, label, prompt text) |
| `style-library/data/generation_manifest.json` | Per-base-prompt image paths |
| `style-library/data/gallery-manifest.json` | Gallery items mapped to manifest format |

The gallery manifest provides a synthetic `gallery-original` base prompt so gallery items can share the same manifest structure as style library items.

## IndexedDB Schema

- **DB name:** `StyleGalleryKrea`, version `5`
- **Stores:** `favorites` (ratings), `folders`, `folder_artists`

## Routing

| Path | Component | Notes |
|------|-----------|-------|
| `/` | GalleryPage | Main gallery |
| `/index.html` | GalleryPage | Alias for `/` |
| `/style-library` | GalleryPage | Redirects to unified gallery |
| `/prompt-builder` | PromptBuilderPage | Prompt generation tool |
| `/admin` | AdminPage | Settings & data management |

Legacy HTML filenames (`prompt-builder.html`, `admin.html`, etc.) are redirected to SPA routes via `RedirectHandler`.

## Service Worker

`sw.js` is auto-generated by `vite-plugin-pwa`. It precaches the app shell and runtime-caches same-origin assets (cache-first with network fallback). Registered when served over HTTP(S).
