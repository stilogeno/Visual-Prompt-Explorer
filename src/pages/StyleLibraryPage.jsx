import { useState, useEffect } from 'preact/hooks';
import { setRating, displayRatingFor } from '../store/styleStore';
import Header from '../components/Header';
import ViewerModal from '../components/ViewerModal';
import Toast from '../components/Toast';
import './StyleLibraryPage.css';

const STORAGE_KEYS = {
  basePrompt: 'krea2-style-library-base-prompt-v1',
  showBaseImage: 'krea2-style-library-show-base-image-v1',
  showCardDetails: 'krea2-style-library-card-details-v1',
  gridColumns: 'krea2-style-library-grid-columns-v1',
};

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

const StarSVG = ({ filled }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"
    fill={filled ? '#f5a623' : 'none'} stroke="#ffffff" strokeWidth="1.5"
    strokeLinejoin="round" strokeLinecap="round" role="img" aria-hidden="true">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);

export default function StyleLibraryPage() {
  const [styles, setStyles] = useState([]);
  const [basePrompts, setBasePrompts] = useState([]);
  const [manifestImages, setManifestImages] = useState({});
  const [activePromptId, setActivePromptId] = useState(() => localStorage.getItem(STORAGE_KEYS.basePrompt) || '');
  const [showBaseImage, setShowBaseImage] = useState(() => loadJson(STORAGE_KEYS.showBaseImage, false));
  const [showCardDetails, setShowCardDetails] = useState(() => loadJson(STORAGE_KEYS.showCardDetails, false));
  const [gridColumns, setGridColumns] = useState(() => loadJson(STORAGE_KEYS.gridColumns, 5));
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sort, setSort] = useState('original');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedStarFilters, setSelectedStarFilters] = useState(new Set([5, 4, 3, 2, 1, 0]));

  // ViewerModal state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStartId, setViewerStartId] = useState(null);

  // Base prompt dialog
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [catalog, promptConfig, manifest] = await Promise.all([
          fetch('/style-library/data/styles.json', { cache: 'no-store' }).then(r => r.json()),
          fetch('/style-library/data/base_prompts.json', { cache: 'no-store' }).then(r => r.json()),
          fetch('/style-library/data/generation_manifest.json', { cache: 'no-store' }).then(r => r.json()),
        ]);

        const styleList = Array.isArray(catalog.styles) ? catalog.styles : [];
        const prompts = Array.isArray(promptConfig.prompts)
          ? promptConfig.prompts.filter(p => p.enabled !== false)
          : [];
        const images = manifest.images && typeof manifest.images === 'object' ? manifest.images : {};

        setStyles(styleList);
        setBasePrompts(prompts);
        setManifestImages(images);

        // Set active prompt
        if (prompts.length > 0) {
          const saved = localStorage.getItem(STORAGE_KEYS.basePrompt) || '';
          const valid = prompts.some(p => p.id === saved) ? saved : prompts[0].id;
          setActivePromptId(valid);
        }

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Save activePromptId
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.basePrompt, activePromptId);
  }, [activePromptId]);

  // Save showBaseImage
  useEffect(() => {
    saveJson(STORAGE_KEYS.showBaseImage, showBaseImage);
  }, [showBaseImage]);

  // Save showCardDetails
  useEffect(() => {
    saveJson(STORAGE_KEYS.showCardDetails, showCardDetails);
  }, [showCardDetails]);

  // Save gridColumns
  useEffect(() => {
    saveJson(STORAGE_KEYS.gridColumns, gridColumns);
  }, [gridColumns]);

  const activePrompt = basePrompts.find(p => p.id === activePromptId) || null;

  const categories = [...new Set(styles.flatMap(s => s.categories || []))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const filtered = styles.filter(style => {
    const searchable = `${style.name}\n${style.descriptor}\n${(style.categories || []).join(' ')}`.toLocaleLowerCase();
    const matchesSearch = !search || searchable.includes(search.toLocaleLowerCase());
    const matchesCategory = !categoryFilter || (style.categories || []).includes(categoryFilter);
    const rating = displayRatingFor({ id: style.id, avg_favs: 0 });
    const matchesStars = selectedStarFilters.has(rating);
    return matchesSearch && matchesCategory && matchesStars;
  }).sort((a, b) => {
    if (sort === 'az') return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (sort === 'za') return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
    if (sort === 'rating') {
      const ra = displayRatingFor({ id: a.id, avg_favs: 0 });
      const rb = displayRatingFor({ id: b.id, avg_favs: 0 });
      return rb - ra;
    }
    return 0;
  });

  // Responsive column cap
  const [columnCap, setColumnCap] = useState(8);
  useEffect(() => {
    function updateCap() {
      const w = window.innerWidth;
      if (w <= 700) setColumnCap(2);
      else if (w <= 1050) setColumnCap(3);
      else if (w <= 1320) setColumnCap(4);
      else setColumnCap(8);
    }
    updateCap();
    window.addEventListener('resize', updateCap);
    return () => window.removeEventListener('resize', updateCap);
  }, []);

  const visibleColumns = Math.min(gridColumns, columnCap);

  const copyToClipboard = async (text) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // fallback
      }
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const toggleStarFilter = (star) => {
    setSelectedStarFilters(prev => {
      const next = new Set(prev);
      if (next.has(star)) next.delete(star);
      else next.add(star);
      if (next.size === 0) next.add(5);
      return next;
    });
  };

  const handleStyleRating = (styleId, newRating) => {
    const current = displayRatingFor({ id: styleId, avg_favs: 0 });
    setRating(styleId, newRating === current ? 0 : newRating);
  };

  const handleCopyStyle = async (style) => {
    const text = `${style.name}. ${style.descriptor}`;
    try {
      await copyToClipboard(text);
      showToast(`Copied ${style.name}.`);
    } catch {
      showToast('The style prompt could not be copied in this browser.');
    }
  };

  const handleExport = (filename, exportStyles) => {
    const content = JSON.stringify(exportStyles.map(s => ({
      name: s.name,
      descriptor: s.descriptor,
      categories: [...s.categories],
    })), null, 2) + '\n';
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Exported ${exportStyles.length} style${exportStyles.length === 1 ? '' : 's'}.`);
  };

  const getImageRecord = (styleId) => {
    if (!activePromptId) return null;
    const record = manifestImages[`${activePromptId}/${styleId}`];
    return record && record.status === 'complete' && record.path ? record : null;
  };

  // Build normalized items list for ViewerModal
  const viewerItems = styles.map(style => {
    const record = getImageRecord(style.id);
    return {
      id: style.id,
      image: record?.path || '',
      artist: style.descriptor,
      name: style.name,
      categories: style.categories || [],
    };
  }).filter(item => item.image);

  if (loading) {
    return (
      <div class="app-shell">
        <Header />
        <div class="sl-loading">Loading style library…</div>
        <Toast message={toast} />
      </div>
    );
  }

  if (error) {
    return (
      <div class="app-shell">
        <Header />
        <div class="sl-error">
          <p>The catalog could not be loaded.</p>
          <p class="sl-error-msg">{error}</p>
        </div>
        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div class="app-shell">
      <Header />

      <div class="sl-controls">
        <div class="sl-controls-inner">
          <div class="sl-header-options">
            <label class="sl-toggle">
              <input
                type="checkbox"
                checked={showBaseImage}
                onChange={(e) => setShowBaseImage(e.target.checked)}
              />
              Show base image
            </label>
            <label class="sl-toggle">
              <input
                type="checkbox"
                checked={showCardDetails}
                onChange={(e) => setShowCardDetails(e.target.checked)}
              />
              Show descriptors & categories
            </label>
            <label class="sl-range-control">
              <span>
                Images per row <output>{visibleColumns}</output>
              </span>
              <input
                type="range"
                min="1"
                max={String(columnCap)}
                value={String(visibleColumns)}
                onInput={(e) => setGridColumns(Number.parseInt(e.target.value, 10))}
              />
            </label>
            <button
              class="sl-action"
              disabled={styles.length === 0}
              onClick={() => handleExport('krea2-styles.json', styles)}
            >
              Export all styles as JSON
            </button>
          </div>

          <div class="sl-summary">
            <span>{styles.length} styles</span>
          </div>

          <button
            class="sl-mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            aria-expanded={mobileMenuOpen}
          >
            Filters & options
          </button>

          <div class={`sl-toolbar ${mobileMenuOpen ? 'sl-mobile-open' : ''}`}>
            <label class="sl-control-group sl-search-control">
              <span>Search</span>
              <input
                class="sl-control"
                type="search"
                placeholder="Names, descriptors, or categories…"
                value={search}
                onInput={(e) => setSearch(e.target.value)}
              />
            </label>
            <div class="sl-control-group sl-base-prompt-group">
              <label>Base prompt</label>
              <div class="sl-base-prompt-controls">
                <select
                  class="sl-control"
                  value={activePromptId}
                  onChange={(e) => setActivePromptId(e.target.value)}
                  disabled={basePrompts.length === 0}
                >
                  {basePrompts.length === 0 && <option value="">No base prompts configured</option>}
                  {basePrompts.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <button
                  class="sl-action sl-prompt-action"
                  disabled={!activePrompt}
                  onClick={() => setPromptDialogOpen(true)}
                >
                  View prompt
                </button>
              </div>
            </div>
            <label class="sl-control-group">
              <span>Category</span>
              <select
                class="sl-control"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label class="sl-control-group">
              <span>Sort</span>
              <select
                class="sl-control"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="original">Original order</option>
                <option value="rating">Rating</option>
                <option value="az">Name A–Z</option>
                <option value="za">Name Z–A</option>
              </select>
            </label>
            <div class="sl-control-group">
              <span>Stars</span>
              <div class="sl-star-filters">
                {[5, 4, 3, 2, 1, 0].map(s => (
                  <button
                    key={s}
                    class={`sl-star-filter-btn ${selectedStarFilters.has(s) ? 'active' : ''}`}
                    onClick={() => toggleStarFilter(s)}
                  >
                    {s}★
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main class="sl-shell">
        <div class="sl-catalog-status">
          <span>Showing {filtered.length} of {styles.length}</span>
        </div>
        <section
          class={`sl-catalog-grid ${!showCardDetails ? 'sl-details-hidden' : ''}`}
          style={`--columns: ${visibleColumns}`}
          aria-label="Krea 2 styles"
        >
          {showBaseImage && activePrompt && (
            <article class="sl-style-card sl-base-image-card">
              <div class="sl-card-heading">
                <h2 class="sl-style-name">Base image — no style</h2>
              </div>
              <div class="sl-image-wrap">
                {(() => {
                  const rec = getImageRecord('base');
                  if (!rec) {
                    return <div class="sl-image-placeholder">{activePromptId ? 'Preview unavailable' : 'Configure a base prompt to generate previews'}</div>;
                  }
                  return (
                    <img
                      src={rec.path}
                      alt={`Base image generated with ${activePrompt?.label || 'the selected base prompt'}`}
                      loading="lazy"
                      decoding="async"
                      width={rec.width || 1024}
                      height={rec.height || 1536}
                      onClick={() => {
                        const baseItem = viewerItems.find(i => i.id === 'base');
                        if (baseItem) {
                          setViewerStartId('base');
                          setViewerOpen(true);
                        }
                      }}
                    />
                  );
                })()}
              </div>
              <div class="sl-card-body">
                <p class="sl-descriptor">
                  {activePrompt
                    ? `Reference generated from "${activePrompt.label}" without a style descriptor.`
                    : 'Reference generated without a style descriptor.'}
                </p>
              </div>
            </article>
          )}

          {filtered.length === 0 && (
            <div class="sl-empty-state">No styles match the current filters.</div>
          )}

          {filtered.map((style) => {
            const record = getImageRecord(style.id);

            return (
              <article key={style.id} class="sl-style-card" data-style-id={style.id}>
                <div class="sl-card-heading">
                  <h2 class="sl-style-name">{style.name}</h2>
                  <div class="sl-star-rating" role="toolbar" aria-label="Rating controls">
                    {[1, 2, 3, 4, 5].map(i => {
                      const rating = displayRatingFor({ id: style.id, avg_favs: 0 });
                      return (
                        <span
                          key={i}
                          class="sl-star"
                          title={`${i} star${i > 1 ? 's' : ''}`}
                          role="button"
                          tabIndex="0"
                          aria-label={`Rate ${i} star${i > 1 ? 's' : ''}`}
                          aria-pressed={i <= rating}
                          onClick={(e) => { e.stopPropagation(); handleStyleRating(style.id, i); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleStyleRating(style.id, i); } }}
                        >
                          <StarSVG filled={i <= rating} />
                        </span>
                      );
                    })}
                  </div>
                  <button
                    class="sl-copy-style-button"
                    type="button"
                    aria-label={`Copy ${style.name} style prompt`}
                    title="Copy style name and descriptor"
                    onClick={() => handleCopyStyle(style)}
                  >
                    <CopyIcon />
                  </button>
                </div>
                <div class="sl-image-wrap">
                  {record ? (
                    <img
                      src={record.path}
                      alt={`${style.name} generated with ${activePrompt?.label || 'the selected base prompt'}`}
                      loading="lazy"
                      decoding="async"
                      width={record.width || 1024}
                      height={record.height || 1536}
                      onClick={() => {
                        setViewerStartId(style.id);
                        setViewerOpen(true);
                      }}
                    />
                  ) : (
                    <div class="sl-image-placeholder">
                      {activePromptId ? 'Preview unavailable' : 'Configure a base prompt to generate previews'}
                    </div>
                  )}
                </div>
                <div class="sl-card-body">
                  <p class="sl-descriptor">{style.descriptor}</p>
                  <div class="sl-categories">
                    {(style.categories || []).map(cat => (
                      <span key={cat}>{cat}</span>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </main>

      {/* Base Prompt Dialog */}
      {promptDialogOpen && (
        <dialog
          class="sl-prompt-dialog"
          open
          onClick={(e) => { if (e.target === e.currentTarget) setPromptDialogOpen(false); }}
        >
          <div class="sl-dialog-head">
            <div>
              <p class="sl-eyebrow">Selected base prompt</p>
              <h2>{activePrompt?.label || 'Base prompt'}</h2>
            </div>
            <button
              class="sl-dialog-close"
              type="button"
              aria-label="Close base prompt"
              onClick={() => setPromptDialogOpen(false)}
            >
              ×
            </button>
          </div>
          <pre class="sl-prompt-text">{activePrompt?.prompt || ''}</pre>
        </dialog>
      )}

      <Toast message={toast} />

      <ViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        startId={viewerStartId}
        items={viewerItems}
      />
    </div>
  );
}
