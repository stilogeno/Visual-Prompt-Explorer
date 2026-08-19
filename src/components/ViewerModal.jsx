import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { filteredItems, favorites, showToast, builderPrefill } from '../store/styleStore';
import { copyToClipboard } from '../lib/utils';
import { route } from 'preact-router';
import './ViewerModal.css';

const PRELOAD_WINDOW = 5;

function preloadImages(list, start, count) {
  const end = Math.min(start + count, list.length);
  for (let i = start; i < end; i++) {
    if (list[i]) {
      const img = new Image();
      img.src = list[i].image;
    }
  }
}

export default function ViewerModal({ isOpen, onClose, startId, items: itemsProp }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeList, setActiveList] = useState([]);
  const overlayRef = useRef(null);
  const touchGestureRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const items = itemsProp || filteredItems.value;
    if (items.length === 0) { onClose(); return; }
    setActiveList(items);
    const idx = startId ? Math.max(0, items.findIndex(i => i.id === startId)) : 0;
    setCurrentIndex(idx);
    preloadImages(items, idx, PRELOAD_WINDOW);
    preloadImages(items, Math.max(0, idx - PRELOAD_WINDOW), PRELOAD_WINDOW);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, startId, itemsProp]);

  useEffect(() => {
    if (!isOpen || activeList.length === 0) return;
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.code) {
        case 'ArrowLeft': navigate(-1); break;
        case 'ArrowRight': navigate(1); break;
        case 'Escape': onClose(); break;
        case 'KeyC': copyPrompt(); break;
        case 'KeyB': useAsBase(); break;
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, currentIndex, activeList]);

  useEffect(() => {
    if (activeList.length === 0) return;
    preloadImages(activeList, currentIndex + 1, PRELOAD_WINDOW);
    preloadImages(activeList, Math.max(0, currentIndex - PRELOAD_WINDOW), PRELOAD_WINDOW);
  }, [currentIndex, activeList]);

  const navigate = useCallback((dir) => {
    if (activeList.length === 0) return;
    setCurrentIndex(i => (i + dir + activeList.length) % activeList.length);
  }, [activeList.length]);

  const copyPrompt = useCallback(() => {
    if (currentIndex < 0 || currentIndex >= activeList.length) return;
    copyToClipboard('Style: ' + activeList[currentIndex].artist).then(() => showToast('Prompt copied!'));
  }, [currentIndex, activeList]);

  const useAsBase = useCallback(() => {
    if (currentIndex < 0 || currentIndex >= activeList.length) return;
    const item = activeList[currentIndex];
    builderPrefill.value = {
      prompt: item.artist,
      name: item.name,
      categories: item.categories || [],
    };
    onClose();
    route('/prompt-builder');
  }, [currentIndex, activeList, onClose]);

  // Touch gesture handlers
  const handleTouchStart = (e) => {
    if (e.pointerType !== 'touch') return;
    touchGestureRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
    };
  };

  const handleTouchEnd = (e) => {
    if (e.pointerType !== 'touch') return;
    if (!touchGestureRef.current || touchGestureRef.current.pointerId !== e.pointerId) return;
    const deltaX = e.clientX - touchGestureRef.current.startX;
    const deltaY = e.clientY - touchGestureRef.current.startY;
    touchGestureRef.current = null;
    // Swipe left/right if horizontal movement is significant
    if (Math.abs(deltaX) >= 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      navigate(deltaX < 0 ? 1 : -1);
    }
  };

  const handleTouchCancel = () => {
    touchGestureRef.current = null;
  };

  if (!isOpen || activeList.length === 0) return null;

  const current = activeList[currentIndex];

  return (
    <div
      ref={overlayRef}
      class="viewer-overlay"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div class="viewer-header">
        <div class="viewer-header-left">
          <span class="viewer-counter">{currentIndex + 1} / {activeList.length}</span>
          <span class="viewer-fav-count">♥ {favorites.value.size}</span>
        </div>
        <button class="viewer-close" onClick={onClose}>×</button>
      </div>

      <div
        class="viewer-body"
        onPointerDown={handleTouchStart}
        onPointerUp={handleTouchEnd}
        onPointerCancel={handleTouchCancel}
      >
        <button class="viewer-nav viewer-nav--prev" onClick={() => navigate(-1)} aria-label="Previous">‹</button>

        <div class="viewer-main">
          <img class="viewer-image" src={current.image} alt={current.artist} />

          <div class="viewer-details">
            <h2 class="viewer-name">{current.name}</h2>
            {(current.categories || []).length > 0 && (
              <div class="viewer-categories">
                {current.categories.map(cat => (
                  <span key={cat} class="viewer-category">{cat}</span>
                ))}
              </div>
            )}
            <p class="viewer-prompt">{current.artist}</p>
            <div class="viewer-actions">
              <button class="viewer-btn viewer-btn--copy" onClick={copyPrompt}>Copy prompt</button>
              <button class="viewer-btn viewer-btn--builder" onClick={useAsBase}>Use as base</button>
            </div>
          </div>
        </div>

        <button class="viewer-nav viewer-nav--next" onClick={() => navigate(1)} aria-label="Next">›</button>
      </div>

      <div class="viewer-hint">
        <kbd>←</kbd> <kbd>→</kbd> navigate &nbsp; <kbd>C</kbd> copy &nbsp; <kbd>B</kbd> use as base &nbsp; <kbd>Esc</kbd> close
      </div>
    </div>
  );
}
