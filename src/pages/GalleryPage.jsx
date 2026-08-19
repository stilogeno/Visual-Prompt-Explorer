import { useState, useEffect, useRef } from 'preact/hooks';
import {
  currentView, filteredItems, adminSettings,
  initStore, activeBasePromptId, BASE_PROMPTS
} from '../store/styleStore';
import Header from '../components/Header';
import Controls from '../components/Controls';
import Card from '../components/Card';
import ViewerModal from '../components/ViewerModal';
import Enhancements from '../components/Enhancements';
import Toast from '../components/Toast';
import './GalleryPage.css';

const ITEMS_PER_PAGE = 20;

export default function GalleryPage({ view = 'gallery' }) {
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStartId, setViewerStartId] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const galleryRef = useRef(null);

  const activePrompt = BASE_PROMPTS.find(p => p.id === activeBasePromptId.value) || null;

  const items = filteredItems.value;
  const displayedItems = items.slice(0, (page + 1) * ITEMS_PER_PAGE);
  const hasMore = displayedItems.length < items.length;

  useEffect(() => { currentView.value = view; }, [view]);

  useEffect(() => {
    const saved = parseInt(localStorage.getItem('gridColumnCount') || '5', 10);
    if (saved >= 1 && saved <= 10) {
      adminSettings.value = { ...adminSettings.value, gridCols: saved };
      document.documentElement.style.setProperty('--grid-columns', saved);
    }
  }, []);

  useEffect(() => { initStore().then(() => setInitialized(true)); }, []);

  useEffect(() => { setPage(0); }, [view, items.length]);

  // Listen for viewer-open events from Card clicks
  useEffect(() => {
    const handler = (e) => {
      setViewerStartId(e.detail.id);
      setViewerOpen(true);
    };
    window.addEventListener('viewer-open', handler);
    return () => window.removeEventListener('viewer-open', handler);
  }, []);

  // Infinite scroll + scroll-to-top
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > adminSettings.value.scrollTopThreshold);
      if (loading || !hasMore) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - adminSettings.value.scrollThreshold) {
        setLoading(true);
        setPage(p => p + 1);
        setLoading(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore]);

  // Keyboard: number keys for grid columns
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
      const key = parseInt(e.key, 10);
      if (key >= 1 && key <= 9) {
        adminSettings.value = { ...adminSettings.value, gridCols: key };
        document.documentElement.style.setProperty('--grid-columns', key);
        localStorage.setItem('gridColumnCount', key);
      } else if (key === 0) {
        adminSettings.value = { ...adminSettings.value, gridCols: 10 };
        document.documentElement.style.setProperty('--grid-columns', 10);
        localStorage.setItem('gridColumnCount', 10);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const counterText = `Prompt-based styles: ${items.length.toLocaleString('en-US')}`;
  const emptyText = 'No cards found.';

  if (!initialized) {
    return (
      <div class="app-shell">
        <Header />
        <div class="loader-container"><div class="loader"></div></div>
      </div>
    );
  }

  return (
    <div class="app-shell">
      <Header />
      <Controls onViewPrompt={() => setPromptDialogOpen(true)} />

      <main id="main-content" class="main-content">
        <div class="gallery-wrapper" ref={galleryRef}>
          <div class="gallery-grid">
            {displayedItems.map(item => (
              <Card key={item.id} item={item} />
            ))}
          </div>
          {displayedItems.length === 0 && (
            <p class="gallery-empty">{emptyText}</p>
          )}
        </div>
      </main>

      <div class="footer-container">
        <p class="page-subtitle" style="text-align:center; margin-bottom: 20px;">{counterText}</p>
      </div>

      {loading && (
        <div class="loader-container"><div class="loader"></div></div>
      )}

      {showScrollTop && (
        <button class="scroll-to-top-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>
      )}

      <ViewerModal isOpen={viewerOpen} onClose={() => setViewerOpen(false)} startId={viewerStartId} />
      <Enhancements />
      <Toast />

      {/* View Prompt Dialog */}
      {promptDialogOpen && (
        <div class="prompt-dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPromptDialogOpen(false); }}>
          <div class="prompt-dialog">
            <div class="prompt-dialog-head">
              <div>
                <p class="prompt-dialog-eyebrow">Selected base prompt</p>
                <h2>
                  {activePrompt?.color && (
                    <span class="prompt-dialog-color-dot" style={{ background: activePrompt.color }} />
                  )}
                  {activePrompt?.label || 'Base prompt'}
                </h2>
              </div>
              <button
                class="prompt-dialog-close"
                type="button"
                aria-label="Close base prompt"
                onClick={() => setPromptDialogOpen(false)}
              >
                ×
              </button>
            </div>
            <pre class="prompt-dialog-text">{activePrompt?.prompt || ''}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
