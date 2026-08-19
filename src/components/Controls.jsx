import { useState } from 'preact/hooks';
import {
  searchTerm, currentView, selectedStarFilters, randomSort,
  activeBasePromptId, BASE_PROMPTS, toggleStarFilter,
  showToast, filteredItems,
  adminSettings, categoryFilter, sortOrder, showCardDetails, allCategories,
  sourceFilter, styleLibraryBasePrompts, activeStyleBasePromptId
} from '../store/styleStore';
import './Controls.css';

export default function Controls({ onViewPrompt }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const view = currentView.value;
  const isGallery = view === 'gallery';
  const isSearching = searchTerm.value.length > 0;

  const handleSearch = (e) => {
    searchTerm.value = e.target.value.toLowerCase().trim();
  };

  const clearSearch = () => {
    searchTerm.value = '';
  };

  const handleRandomize = () => {
    randomSort.value = !randomSort.value;
  };

  const handleBasePrompt = (e) => {
    activeBasePromptId.value = e.target.value;
    const bp = BASE_PROMPTS.find(p => p.id === e.target.value);
    showToast(bp ? `Base prompt: ${bp.label}` : 'Base prompt cleared');
  };

  const handleGridChange = (e) => {
    const v = parseInt(e.target.value);
    adminSettings.value = { ...adminSettings.value, gridCols: v };
    document.documentElement.style.setProperty('--grid-columns', v);
    localStorage.setItem('gridColumnCount', v);
  };

  const handleCategoryChange = (e) => {
    categoryFilter.value = e.target.value;
  };

  const handleSortChange = (e) => {
    sortOrder.value = e.target.value;
    if (e.target.value !== 'original') {
      randomSort.value = false;
    }
  };

  const toggleCardDetails = () => {
    showCardDetails.value = !showCardDetails.value;
  };

  const handleSourceFilter = (e) => {
    sourceFilter.value = e.target.value;
  };

  const handleStyleBasePrompt = (e) => {
    activeStyleBasePromptId.value = e.target.value;
    localStorage.setItem('krea2-style-library-base-prompt-v1', e.target.value);
  };

  return (
    <div class="controls-container">
      <button
        class="mobile-menu-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-expanded={mobileMenuOpen}
      >
        Filters & options
      </button>

      <div class={`controls-inner ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div class="sort-jump-group">
          {isGallery && (
            <div class="sort-controls">
              <span class="sort-label">Stars:</span>
              {[5, 4, 3, 2, 1, 0].map(s => (
                <button
                  key={s}
                  class={`sort-button star-filter ${selectedStarFilters.value.has(s) ? 'active' : ''}`}
                  data-stars={s}
                  onClick={() => { toggleStarFilter(s); randomSort.value = false; }}
                >
                  {s}★
                </button>
              ))}
              <button
                class={`sort-button ${randomSort.value ? 'active' : ''}`}
                onClick={handleRandomize}
              >
                Randomize
              </button>
            </div>
          )}

          {isGallery && (
            <div class="base-prompt-selector-placeholder">
              <div class="base-prompt-selector">
                <label class="base-prompt-label">Base prompt</label>
                <div class="base-prompt-select-wrapper">
                  {activeBasePromptId.value && (
                    <span
                      class="base-prompt-color-dot"
                      style={{ background: BASE_PROMPTS.find(p => p.id === activeBasePromptId.value)?.color || '#888' }}
                    />
                  )}
                  <select
                    class="base-prompt-selector-input"
                    value={activeBasePromptId.value}
                    onChange={handleBasePrompt}
                  >
                    <option value="">None</option>
                    {BASE_PROMPTS.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  class="sort-button"
                  disabled={!activeBasePromptId.value}
                  onClick={onViewPrompt}
                >
                  View prompt
                </button>
              </div>
            </div>
          )}
        </div>

        <div class="search-and-import-wrapper">
          <div class="search-wrapper">
            <div class="search-input-container">
              <input
                type="search"
                id="search-input"
                class="search-input"
                placeholder="Search by keyword..."
                value={searchTerm.value}
                onInput={handleSearch}
              />
              {isSearching && (
                <button class="clear-input-btn" onClick={clearSearch}>×</button>
              )}
            </div>
          </div>
        </div>

        <div class="right-controls-group">
          {isGallery && (
            <>
              <div class="filter-group">
                <label class="filter-label">Source</label>
                <select
                  class="filter-select"
                  value={sourceFilter.value}
                  onChange={handleSourceFilter}
                >
                  <option value="all">All sources</option>
                  <option value="gallery">Gallery only</option>
                  <option value="style">Style library only</option>
                </select>
              </div>

              {sourceFilter.value !== 'gallery' && styleLibraryBasePrompts.value.length > 0 && (
                <div class="filter-group">
                  <label class="filter-label">Style base</label>
                  <select
                    class="filter-select"
                    value={activeStyleBasePromptId.value}
                    onChange={handleStyleBasePrompt}
                  >
                    {styleLibraryBasePrompts.value.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div class="filter-group">
                <label class="filter-label">Category</label>
                <select
                  class="filter-select"
                  value={categoryFilter.value}
                  onChange={handleCategoryChange}
                >
                  <option value="">All categories</option>
                  {allCategories.value.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div class="filter-group">
                <label class="filter-label">Sort</label>
                <select
                  class="filter-select"
                  value={sortOrder.value}
                  onChange={handleSortChange}
                >
                  <option value="original">Rating</option>
                  <option value="az">Name A–Z</option>
                  <option value="za">Name Z–A</option>
                </select>
              </div>

              <label class="toggle-label">
                <input
                  type="checkbox"
                  checked={showCardDetails.value}
                  onChange={toggleCardDetails}
                />
                Details
              </label>

              <div class="grid-controls">
                <div class="slider-wrapper">
                  <label class="grid-slider-label">
                    Columns: <span id="grid-slider-value">{adminSettings.value.gridCols}</span>
                  </label>
                  <input
                    id="grid-slider"
                    type="range"
                    min="1"
                    max="10"
                    value={adminSettings.value.gridCols}
                    onInput={handleGridChange}
                  />
                </div>
                <small class="hotkey-hint" title="Use number keys 1-9 and 0 (for 10) to change column count">[1-0] keys</small>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
