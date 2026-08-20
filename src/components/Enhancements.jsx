import { useState, useEffect } from 'preact/hooks';
import {
  currentView, searchTerm, randomSort,
  allItems, showToast, buildCopyText
} from '../store/styleStore';
import { copyToClipboard, getImagePath } from '../lib/utils';
import './Enhancements.css';

function SimilarStylesModal({ id, onClose }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    const target = allItems.value.find(i => i.id === id);
    if (!target) { onClose(); return; }
    const targetTokens = new Set(target.prompt.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2));
    if (!targetTokens.size) { onClose(); return; }
    const scored = allItems.value
      .filter(s => s.id !== id)
      .map(style => {
        const tokens = new Set(style.prompt.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2));
        let shared = 0;
        tokens.forEach(t => { if (targetTokens.has(t)) shared++; });
        return { style, shared };
      })
      .filter(r => r.shared > 0)
      .sort((a, b) => b.shared - a.shared)
      .slice(0, 12);
    setResults(scored);
  }, [id]);

  return (
    <div class="kx-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="kx-modal-inner">
        <button class="kx-close" onClick={onClose}>×</button>
        <h3>Similar styles</h3>
        {results.length === 0 ? (
          <p style="color: var(--secondary-text-color)">No close matches found.</p>
        ) : (
          <div class="kx-similar-grid">
            {results.map(r => (
              <div key={r.style.id} class="kx-similar-card" onClick={() => {
                copyToClipboard('Style: ' + r.style.prompt).then(() => showToast('Prompt copied!'));
              }}>
                <img src={getImagePath(r.style.id, r.style.folder)} alt={r.style.prompt.slice(0, 40)} loading="lazy" />
                <div class="p">{r.style.prompt.split(',').slice(0, 3).join(', ')}...</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CompareModal({ ids, onClose }) {
  const items = ids.map(id => allItems.value.find(i => i.id === id)).filter(Boolean);
  return (
    <div class="kx-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="kx-modal-inner">
        <button class="kx-close" onClick={onClose}>×</button>
        <h3>Comparing {items.length} styles</h3>
        <div class="kx-similar-grid">
          {items.map(item => (
            <div key={item.id} class="kx-similar-card">
              <img src={getImagePath(item.id, item.folder)} alt={item.prompt.slice(0, 40)} loading="lazy" />
              <div class="p">{item.prompt}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MoodboardModal({ onClose }) {
  const [boards, setBoards] = useState([]);
  useEffect(() => {
    fetch('krea_moodboards.json')
      .then(r => r.json())
      .then(data => setBoards(Array.isArray(data) ? data : (data.moodboards || [])))
      .catch(() => setBoards([]));
  }, []);

  return (
    <div class="kx-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="kx-modal-inner">
        <button class="kx-close" onClick={onClose}>×</button>
        <h3>Moodboards</h3>
        {boards.length === 0 ? (
          <p style="color: var(--secondary-text-color)">No moodboards found.</p>
        ) : (
          <div class="kx-similar-grid">
            {boards.map((mb, i) => (
              <div key={i} class="kx-similar-card">
                <div class="p" style="font-weight: 600;">{mb.name || mb.title || 'Moodboard'}</div>
                {mb.prompts?.slice(0, 6).map((pr, j) => (
                  <button key={j} class="kx-btn" style="margin: 2px; font-size: 11px;" title={pr.prompt || pr.name || ''}
                    onClick={() => copyToClipboard(typeof pr === 'string' ? pr : (pr.prompt || pr.name || '')).then(() => showToast('Copied!'))}>
                    {(pr.name || pr.prompt || String(pr)).slice(0, 28)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HelpPanel({ onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div class="kx-help">
      S — quick-rate 5★{'\n'}
      M — moodboards{'\n'}
      V — my stats{'\n'}
      ? — hide this help
    </div>
  );
}

export default function Enhancements() {
  const [similarId, setSimilarId] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [showMoodboards, setShowMoodboards] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [compareBarVisible, setCompareBarVisible] = useState(false);

  useEffect(() => {
    const applyHash = () => {
      const raw = window.location.hash.replace(/^#/, '');
      if (!raw) return;
      const params = {};
      raw.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
      });
      if (params.q) searchTerm.value = params.q;
      if (params.sort === 'random') randomSort.value = true;
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  useEffect(() => {
    const parts = [];
    if (searchTerm.value) parts.push('q=' + encodeURIComponent(searchTerm.value));
    if (randomSort.value) parts.push('sort=random');
    const hash = parts.join('&');
    if (window.location.hash !== (hash ? '#' + hash : '')) {
      history.replaceState(null, '', hash ? '#' + hash : window.location.pathname);
    }
  }, [searchTerm.value, randomSort.value]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const viewerOpen = document.querySelector('.viewer-overlay');
      if (viewerOpen) return;

      switch (e.key.toLowerCase()) {
        case 's':
          if (currentView.value === 'gallery') {
            const card = document.activeElement?.closest('.card') || document.querySelector('.card:hover');
            if (card) card.querySelector('.star[data-star="5"]')?.click();
          }
          break;
        case 'm': setShowMoodboards(true); break;
        case '?': setShowHelp(h => !h); break;
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    window.kxEnhancements = {
      openSimilarModal: (id) => setSimilarId(id),
      addToCompare: (id) => {
        setCompareIds(prev => {
          if (prev.includes(id)) { showToast('Already in compare.'); return prev; }
          return [...prev, id];
        });
        setCompareBarVisible(true);
      },
      openCompareModal: () => setShowCompare(true),
      openMoodboards: () => setShowMoodboards(true),
    };
  }, []);

  return (
    <>
      {similarId && <SimilarStylesModal id={similarId} onClose={() => setSimilarId(null)} />}
      {showCompare && <CompareModal ids={compareIds} onClose={() => { setShowCompare(false); setCompareIds([]); setCompareBarVisible(false); }} />}
      {showMoodboards && <MoodboardModal onClose={() => setShowMoodboards(false)} />}
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
      {compareBarVisible && compareIds.length > 0 && (
        <div class="kx-compare-bar">
          <span>{compareIds.length} selected</span>
          <button class="kx-btn" onClick={() => setShowCompare(true)}>Compare</button>
          <button class="kx-btn" onClick={() => { setCompareIds([]); setCompareBarVisible(false); }}>Clear</button>
        </div>
      )}
    </>
  );
}
