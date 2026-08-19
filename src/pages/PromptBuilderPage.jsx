import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { showToast, adminSettings, builderPrefill } from '../store/styleStore';
import { copyToClipboard } from '../lib/utils';
import Header from '../components/Header';
import Toast from '../components/Toast';
import './PromptBuilderPage.css';

const DEFAULT_NEGATIVE = 'ugly, deformed, noisy, blurry, distorted, grainy, low contrast, text, watermark, signature, cut off, low resolution, poorly drawn, extra limbs, mutated hands, bad anatomy, wrong anatomy, extra limbs, extra fingers, fused fingers, too many fingers, long neck';
const SEED_PRESETS = [-1, 42, 137, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];

const STYLE_PRESET_KEYWORDS = {
  'cinematic': ['cinematic', 'dramatic lighting', 'film grain', 'depth of field', 'color graded', 'movie still', 'volumetric light'],
  'noir': ['noir', 'chiaroscuro', 'high contrast', 'monochrome', 'shadowy', 'mysterious', 'dramatic shadows'],
  'minimalist': ['minimalist', 'clean lines', 'negative space', 'simple composition', 'uncluttered', 'sparse'],
  'vintage': ['vintage', 'retro', 'film grain', 'warm tones', 'aged', 'nostalgic', 'sepia', 'analog'],
  'anime': ['anime', 'manga', 'cel shaded', 'stylized eyes', 'vibrant colors', 'japanese animation', '2d render'],
  'watercolor': ['watercolor', 'wet-on-wet', 'soft edges', 'color bleeding', 'paper texture', 'painterly', 'translucent'],
  'photorealistic': ['photorealistic', 'hyperrealistic', '8k', 'ultra detailed', 'sharp focus', 'natural lighting', 'dslr'],
  'surreal': ['surreal', 'dreamlike', 'surrealism', 'impossible geometry', 'lucid', 'otherworldly', 'metamorphosis'],
  'retro': ['retro', '80s', '80s aesthetic', 'synthwave', 'neon', 'vaporwave', 'arcade', 'pixel art'],
  'dark-moody': ['dark moody', 'moody lighting', 'low key', 'dramatic shadows', 'atmospheric', 'somber', 'brooding'],
  'warm-cozy': ['warm cozy', 'warm lighting', 'cozy', 'inviting', 'soft glow', 'firelight', 'comfortable'],
  'tech-futuristic': ['futuristic', 'sci-fi', 'cyberpunk', 'neon lights', 'high tech', 'digital', 'holographic', 'mecha'],
  'nature-organic': ['nature', 'organic', 'organic textures', 'earthy', 'natural light', 'flora', 'botanical', 'forest'],
  'abstract-geometric': ['geometric', 'abstract', 'geometric shapes', 'fractal', 'mathematical', 'patterns', 'tessellation'],
  'hand-drawn': ['hand drawn', 'sketch', 'pencil sketch', 'ink drawing', 'line art', 'illustration', 'doodle'],
  'graffiti-street': ['graffiti', 'street art', 'urban', 'spray paint', 'stencil', 'wall art', 'concrete']
};

const PRESETS = [
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'noir', label: 'Noir' },
  { id: 'minimalist', label: 'Minimalist' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'anime', label: 'Anime' },
  { id: 'watercolor', label: 'Watercolor' },
  { id: 'photorealistic', label: 'Photorealistic' },
  { id: 'surreal', label: 'Surreal' },
  { id: 'retro', label: 'Retro' },
  { id: 'dark-moody', label: 'Dark & Moody' },
  { id: 'warm-cozy', label: 'Warm & Cozy' },
  { id: 'tech-futuristic', label: 'Tech / Futuristic' },
  { id: 'nature-organic', label: 'Nature / Organic' },
  { id: 'abstract-geometric', label: 'Abstract / Geometric' },
  { id: 'hand-drawn', label: 'Hand-Drawn' },
  { id: 'graffiti-street', label: 'Graffiti / Street' },
];

function loadAIConfig() {
  const defaults = {
    baseUrl: 'http://127.0.0.1:8000/v1',
    model: 'GLM-4.7-Flash-MLX-4bit',
    embedModel: 'Qwen3-Embedding-4B-4bit-DWQ',
    timeoutMs: 15000,
    enabled: true,
    nsfw: false,
  };
  try {
    const stored = localStorage.getItem('krea_admin_settings');
    if (stored) {
      const s = JSON.parse(stored);
      return {
        baseUrl: s.aiBaseUrl || defaults.baseUrl,
        model: s.aiChatModel || defaults.model,
        embedModel: s.aiEmbedModel || defaults.embedModel,
        timeoutMs: s.aiTimeout || defaults.timeoutMs,
        enabled: typeof s.aiEnabled === 'boolean' ? s.aiEnabled : defaults.enabled,
        nsfw: typeof s.aiNsfw === 'boolean' ? s.aiNsfw : defaults.nsfw,
      };
    }
  } catch {}
  return defaults;
}

function initAllStyles() {
  if (typeof window.galleryData === 'undefined') return [];
  return window.galleryData.map((item, idx) => ({
    id: item.id,
    prompt: item.prompt,
    folder: item.folder,
    index: idx,
  }));
}

function searchStyles(allStyles, keywords, limit) {
  if (!keywords || keywords.length === 0) return [];
  return allStyles.map(style => {
    const prompt = style.prompt.toLowerCase();
    let score = 0;
    keywords.forEach(kw => {
      const lower = kw.toLowerCase();
      if (prompt.includes(lower)) score += 3;
      lower.split(/\s+/).forEach(w => {
        if (w.length > 2 && prompt.includes(w)) score += 1.5;
      });
    });
    return { ...style, score };
  }).filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit || 50);
}

function getStylesForPreset(allStyles, preset) {
  return searchStyles(allStyles, STYLE_PRESET_KEYWORDS[preset] || [], 30);
}

function buildSubjectBlock(subject, environment, mood, details) {
  return [subject, environment, mood, details].filter(Boolean).join(', ');
}

function buildWeightedDisplay(subjectBlock, subjectWeight, styleParts, styleWeight) {
  let html = '';
  subjectBlock.split(',').map(s => s.trim()).forEach((word, i) => {
    if (i > 0) html += ', ';
    html += `<span class="weighted">(${escapeHtml(word)}:${subjectWeight.toFixed(2)})</span>`;
  });
  styleParts.forEach((part) => {
    html += ', ';
    if (styleWeight !== 1.0) {
      html += `<span class="weighted">(${escapeHtml(part)}:${styleWeight.toFixed(2)})</span>`;
    } else {
      html += escapeHtml(part);
    }
  });
  return html;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function PromptCard({ prompt, onCopy }) {
  return (
    <div class="prompt-card">
      <div class="prompt-card-header">
        <span class="card-title">{prompt.label} — {prompt.style}</span>
        <span class="card-subtitle">{prompt.seeds.length} seeds</span>
      </div>
      <div class="prompt-card-body">
        <div class="prompt-block">
          <div class="prompt-block-label">Positive Prompt</div>
          <div class="prompt-text" dangerouslySetInnerHTML={{ __html: prompt.weightedHtml }} />
        </div>
        {prompt.negative && (
          <div class="prompt-block">
            <div class="prompt-block-label negative">Negative Prompt</div>
            <div class="prompt-text">{prompt.negative}</div>
          </div>
        )}
        <div class="style-preview">Style source: {prompt.stylePrompt}</div>
      </div>
      <div class="seed-variants">
        {prompt.seeds.map((seed, i) => (
          <div key={i} class="seed-variant">
            <div class="seed-variant-header">
              <span class="seed-label">Variant {i + 1}</span>
              <span class="seed-value">seed: {seed}</span>
            </div>
            <div class="seed-prompt" dangerouslySetInnerHTML={{ __html: prompt.weightedHtml }} />
            {prompt.negative && (
              <div class="seed-prompt" style="color: #ff6b6b; margin-top: 6px; font-size: 11px;">[{prompt.negative}]</div>
            )}
          </div>
        ))}
      </div>
      <div class="prompt-actions">
        <button class="btn btn-sm" onClick={() => onCopy(prompt.positive + ` [seed: ${prompt.seeds[0]}]`)}>Copy Positive</button>
        {prompt.negative && (
          <button class="btn btn-sm" onClick={() => onCopy(prompt.negative + ` [seed: ${prompt.seeds[0]}]`)}>Copy Negative</button>
        )}
        <button class="btn btn-sm btn-success" onClick={() => onCopy(`Positive: ${prompt.positive}\nNegative: ${prompt.negative || DEFAULT_NEGATIVE}\nSeed: ${prompt.seeds[0]}`)}>Copy Both</button>
      </div>
    </div>
  );
}

export default function PromptBuilderPage() {
  const [mode, setMode] = useState('quick');
  const [selectedPresets, setSelectedPresets] = useState(new Set());
  const [customStyles, setCustomStyles] = useState([]);
  const [customInput, setCustomInput] = useState('');
  const [generatedPrompts, setGeneratedPrompts] = useState([]);
  const [allStyles] = useState(() => initAllStyles());
  const [aiConfig] = useState(() => loadAIConfig());

  // Quick mode state
  const [topic, setTopic] = useState('');
  const [imageType, setImageType] = useState('cover');
  const [stylesPerVariant, setStylesPerVariant] = useState(2);
  const [seedCount, setSeedCount] = useState(3);
  const [includeNegative, setIncludeNegative] = useState(true);
  const [subjectWeight, setSubjectWeight] = useState(1.2);
  const [styleWeight, setStyleWeight] = useState(1.0);

  // Detailed mode state
  const [detailSubject, setDetailSubject] = useState('');
  const [detailEnvironment, setDetailEnvironment] = useState('');
  const [detailMood, setDetailMood] = useState('');
  const [detailDetails, setDetailDetails] = useState('');
  const [detailStyleSearch, setDetailStyleSearch] = useState('');
  const [detailSelectedStyles, setDetailSelectedStyles] = useState(new Set());
  const [detailSeedCount, setDetailSeedCount] = useState(3);
  const [detailIncludeNegative, setDetailIncludeNegative] = useState(true);
  const [detailSubjectWeight, setDetailSubjectWeight] = useState(1.2);
  const [detailStyleWeight, setDetailStyleWeight] = useState(1.0);
  const [detailStyles, setDetailStyles] = useState(() => allStyles.slice(0, 100));

  const outputRef = useRef(null);

  // Consume builder prefill from ViewerModal
  useEffect(() => {
    const prefill = builderPrefill.value;
    if (!prefill) return;
    builderPrefill.value = null;
    setMode('detailed');
    setDetailDetails(prefill.prompt);
    setDetailStyleSearch(prefill.categories?.[0] || '');
  }, []);

  const handleCopy = useCallback((text) => {
    copyToClipboard(text).then(() => showToast('Copied to clipboard!'));
  }, []);

  const togglePreset = (id) => {
    setSelectedPresets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCustomStyles = () => {
    const tags = customInput.split(',').map(s => s.trim()).filter(Boolean);
    if (tags.length === 0) return;
    setCustomStyles(prev => [...new Set([...prev, ...tags])]);
    setCustomInput('');
    showToast(`Added: ${tags.join(', ')}`);
  };

  const removeCustomStyle = (idx) => {
    setCustomStyles(prev => prev.filter((_, i) => i !== idx));
  };

  // Detail mode style search
  useEffect(() => {
    const q = detailStyleSearch.toLowerCase().trim();
    if (!q) {
      setDetailStyles(allStyles.slice(0, 100));
      return;
    }
    const timer = setTimeout(() => {
      const results = searchStyles(allStyles, q.split(/\s+/).filter(w => w.length > 2), 100);
      setDetailStyles(results);
    }, 150);
    return () => clearTimeout(timer);
  }, [detailStyleSearch, allStyles]);

  const toggleDetailStyle = (id) => {
    setDetailSelectedStyles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const autoSuggestDetail = () => {
    const keywords = [detailSubject, detailEnvironment, detailMood].filter(Boolean)
      .join(' ').split(/[\s,]+/).filter(w => w.length > 2);
    if (keywords.length === 0) {
      showToast('Fill in at least Subject or Environment.');
      return;
    }
    const results = searchStyles(allStyles, keywords, 30);
    setDetailStyles(results);
    const top5 = new Set(results.slice(0, 5).map(s => s.id));
    setDetailSelectedStyles(top5);
    showToast(`Found ${results.length} styles — top 5 auto-selected.`);
  };

  // Generate prompts (Quick mode)
  const generateQuick = () => {
    if (!topic) { showToast('Please enter a blog post topic.'); return; }
    if (selectedPresets.size === 0 && customStyles.length === 0) {
      showToast('Please select at least one style preset or add custom styles.'); return;
    }

    const topicKeywords = topic.toLowerCase().split(/[\s,.\n]+/).filter(w => w.length > 2);
    let candidateStyles = [];
    const styleSources = {};

    selectedPresets.forEach(preset => {
      getStylesForPreset(allStyles, preset).forEach(s => {
        if (!styleSources[s.id]) {
          styleSources[s.id] = { style: s, preset };
          candidateStyles.push(s);
        }
      });
    });

    customStyles.forEach(custom => {
      searchStyles(allStyles, [custom], 20).forEach(s => {
        if (!styleSources[s.id]) {
          styleSources[s.id] = { style: s, preset: 'custom: ' + custom };
          candidateStyles.push(s);
        }
      });
    });

    const scored = candidateStyles.map(s => {
      let score = s.score || 0;
      topicKeywords.forEach(kw => { if (s.prompt.toLowerCase().includes(kw)) score += 2; });
      return { ...s, score, source: styleSources[s.id] };
    }).sort((a, b) => b.score - a.score);

    const totalVariants = imageType === 'both' ? 2 : 1;
    const stylesPerImage = Math.min(stylesPerVariant, Math.floor(scored.length / totalVariants));
    const selected = scored.slice(0, stylesPerImage * totalVariants);

    if (selected.length === 0) { showToast('No matching styles found.'); return; }

    const prompts = [];
    let variantNum = 0;

    for (let imgIdx = 0; imgIdx < totalVariants; imgIdx++) {
      const imgLabel = totalVariants > 1 ? (imgIdx === 0 ? 'Cover' : 'Accompanying') : 'Single';
      const imageStyles = selected.slice(imgIdx * stylesPerImage, (imgIdx + 1) * stylesPerImage);

      imageStyles.forEach(style => {
        variantNum++;
        const styleParts = style.prompt.split(',').map(s => s.trim()).filter(Boolean);
        const positivePrompt = [topic, ...styleParts].join(', ');
        const weightedHtml = buildWeightedDisplay(topic, subjectWeight, styleParts, styleWeight);
        const seeds = SEED_PRESETS.slice(0, seedCount);

        prompts.push({
          variant: variantNum,
          label: imgLabel,
          style: style.source.preset,
          stylePrompt: style.prompt,
          positive: positivePrompt,
          negative: includeNegative ? DEFAULT_NEGATIVE : null,
          seeds,
          subjectWeight,
          styleWeight,
          weightedHtml,
        });
      });
    }

    setGeneratedPrompts(prompts);
    setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    showToast(`${prompts.length} prompts generated.`);
  };

  // Generate prompts (Detailed mode)
  const generateDetailed = () => {
    if (!detailSubject && !detailEnvironment) {
      showToast('Please fill in at least Subject and Environment.'); return;
    }
    if (detailSelectedStyles.size === 0) {
      showToast('Please select at least one style.'); return;
    }

    const subjectBlock = buildSubjectBlock(detailSubject, detailEnvironment, detailMood, detailDetails);
    const prompts = [];
    let variantNum = 0;

    detailSelectedStyles.forEach(styleId => {
      const style = allStyles.find(s => s.id === styleId);
      if (!style) return;
      variantNum++;

      const styleParts = style.prompt.split(',').map(s => s.trim()).filter(Boolean);
      const positivePrompt = [subjectBlock, ...styleParts].join(', ');
      const weightedHtml = buildWeightedDisplay(subjectBlock, detailSubjectWeight, styleParts, detailStyleWeight);
      const seeds = SEED_PRESETS.slice(0, detailSeedCount);

      prompts.push({
        variant: variantNum,
        label: 'Detailed',
        style: `Folder ${style.folder}`,
        stylePrompt: style.prompt,
        positive: positivePrompt,
        negative: detailIncludeNegative ? DEFAULT_NEGATIVE : null,
        seeds,
        subjectWeight: detailSubjectWeight,
        styleWeight: detailStyleWeight,
        weightedHtml,
      });
    });

    setGeneratedPrompts(prompts);
    setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    showToast(`${prompts.length} prompts generated.`);
  };

  const clearQuick = () => {
    setTopic('');
    setImageType('cover');
    setSelectedPresets(new Set());
    setCustomStyles([]);
    setGeneratedPrompts([]);
  };

  const clearDetailed = () => {
    setDetailSubject('');
    setDetailEnvironment('');
    setDetailMood('');
    setDetailDetails('');
    setDetailStyleSearch('');
    setDetailSelectedStyles(new Set());
    setGeneratedPrompts([]);
  };

  const exportAll = () => {
    if (generatedPrompts.length === 0) return;
    let text = '=== AI Prompt Builder Export ===\n\n';
    generatedPrompts.forEach((p, i) => {
      text += `--- Prompt ${i + 1} (${p.label} — ${p.style}) ---\n`;
      text += `Positive: ${p.positive}\n`;
      if (p.negative) text += `Negative: ${p.negative}\n`;
      text += `Seeds: [${p.seeds.join(', ')}]\n\n`;
    });
    copyToClipboard(text).then(() => showToast(`Exported ${generatedPrompts.length} prompts.`));
  };

  const exportJSON = () => {
    if (generatedPrompts.length === 0) return;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), prompts: generatedPrompts }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `krea-prompts-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('JSON downloaded.');
  };

  const aiVisible = aiConfig.enabled;

  return (
    <div class="builder-container">
      <Header />

      <div class="mode-tabs">
        <button class={`mode-tab ${mode === 'quick' ? 'active' : ''}`} onClick={() => setMode('quick')}>Quick Build</button>
        <button class={`mode-tab ${mode === 'detailed' ? 'active' : ''}`} onClick={() => setMode('detailed')}>Detailed</button>
      </div>

      {/* Quick Build Mode */}
      {mode === 'quick' && (
        <>
          <div class="builder-input-section">
            <h2>1. Blog Post Context</h2>
            <p class="section-desc">Describe the blog post or topic. I'll extract the mood, themes, and visual direction.</p>

            <div class="input-group" style="margin-bottom: 16px;">
              <label>Blog Post Topic / Summary</label>
              <textarea class="studio-input studio-textarea" placeholder="e.g., A personal reflection on local AI hosting..."
                value={topic} onInput={(e) => setTopic(e.target.value)} />
            </div>

            <div class="input-group" style="margin-bottom: 16px;">
              <label>Image Type</label>
              <select class="studio-input" value={imageType} onChange={(e) => setImageType(e.target.value)}>
                <option value="cover">Cover Image</option>
                <option value="accompanying">Accompanying Image</option>
                <option value="both">Both (Cover + Accompanying)</option>
              </select>
            </div>
          </div>

          <div class="builder-input-section">
            <h2>2. Visual Style Direction</h2>
            <p class="section-desc">Choose style presets that match the mood of your post.</p>

            <div class="style-presets">
              {PRESETS.map(p => (
                <span key={p.id}
                  class={`preset-chip ${selectedPresets.has(p.id) ? 'selected' : ''}`}
                  onClick={() => togglePreset(p.id)}>
                  {p.label}
                </span>
              ))}
            </div>

            <div class="custom-style-section">
              <p class="section-desc" style="margin-bottom: 8px;">Or add custom style keywords (comma-separated):</p>
              <div class="custom-style-row">
                <input type="text" class="custom-style-input" placeholder="e.g., oil painting, cyberpunk"
                  value={customInput} onInput={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCustomStyles(); }} />
                <button class="btn btn-sm" onClick={addCustomStyles}>Add</button>
              </div>
              <div class="custom-style-list">
                {customStyles.map((tag, i) => (
                  <span key={i} class="custom-style-tag">
                    {tag} <span class="remove-style" onClick={() => removeCustomStyle(i)}>×</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div class="builder-input-section">
            <h2>3. Output Options</h2>
            <p class="section-desc">Configure variants and weighting.</p>

            <div class="options-row">
              <div class="option-group">
                <label>Styles per variant:</label>
                <select value={stylesPerVariant} onChange={(e) => setStylesPerVariant(parseInt(e.target.value))}>
                  <option value="1">1 style (focused)</option>
                  <option value="2">2 styles (mixed)</option>
                  <option value="3">3 styles (layered)</option>
                </select>
              </div>
              <div class="option-group">
                <label>Seed variants:</label>
                <select value={seedCount} onChange={(e) => setSeedCount(parseInt(e.target.value))}>
                  <option value="1">1 seed</option>
                  <option value="3">3 seeds</option>
                  <option value="5">5 seeds</option>
                </select>
              </div>
              <div class="option-group">
                <input type="checkbox" checked={includeNegative} onChange={(e) => setIncludeNegative(e.target.checked)} />
                <label>Negative prompts</label>
              </div>
            </div>

            <div class="weight-control" style="margin-top: 16px;">
              <label>Subject emphasis</label>
              <input type="range" class="weight-slider" min="1.0" max="1.5" step="0.05"
                value={subjectWeight} onInput={(e) => setSubjectWeight(parseFloat(e.target.value))} />
              <span class="weight-value">{subjectWeight.toFixed(2)}</span>
            </div>

            <div class="weight-control" style="margin-top: 8px;">
              <label>Style emphasis</label>
              <input type="range" class="weight-slider" min="0.5" max="1.5" step="0.05"
                value={styleWeight} onInput={(e) => setStyleWeight(parseFloat(e.target.value))} />
              <span class="weight-value">{styleWeight.toFixed(2)}</span>
            </div>
          </div>

          <div class="generate-section">
            <button class="btn btn-primary" onClick={generateQuick}>Generate Prompts</button>
            <button class="btn" onClick={clearQuick}>Clear All</button>
          </div>
        </>
      )}

      {/* Detailed Mode */}
      {mode === 'detailed' && (
        <>
          <div class="builder-input-section">
            <h2>1. Subject & Context</h2>
            <p class="section-desc">Describe exactly what you want in the image.</p>

            <div class="input-row">
              <div class="input-group">
                <label>Subject / Character</label>
                <input type="text" class="studio-input" placeholder="e.g., elf warrior, cyberpunk detective"
                  value={detailSubject} onInput={(e) => setDetailSubject(e.target.value)} />
              </div>
              <div class="input-group">
                <label>Environment / Setting</label>
                <input type="text" class="studio-input" placeholder="e.g., ancient forest, neon-lit alley"
                  value={detailEnvironment} onInput={(e) => setDetailEnvironment(e.target.value)} />
              </div>
            </div>

            <div class="input-group" style="margin-bottom: 16px;">
              <label>Mood / Atmosphere</label>
              <input type="text" class="studio-input" placeholder="e.g., melancholic, hopeful, tense"
                value={detailMood} onInput={(e) => setDetailMood(e.target.value)} />
            </div>

            <div class="input-group" style="margin-bottom: 16px;">
              <label>Additional Details</label>
              <textarea class="studio-input studio-textarea" placeholder="e.g., dramatic lighting, shallow depth of field"
                value={detailDetails} onInput={(e) => setDetailDetails(e.target.value)} />
            </div>

            <div class="weight-control">
              <label>Subject emphasis</label>
              <input type="range" class="weight-slider" min="1.0" max="1.5" step="0.05"
                value={detailSubjectWeight} onInput={(e) => setDetailSubjectWeight(parseFloat(e.target.value))} />
              <span class="weight-value">{detailSubjectWeight.toFixed(2)}</span>
            </div>
          </div>

          <div class="builder-input-section">
            <h2>2. Style Selection</h2>
            <p class="section-desc">Search the style library or use auto-suggest.</p>

            <div class="custom-style-row" style="margin-bottom: 12px;">
              <input type="text" class="custom-style-input" placeholder="Search styles... (e.g., 'noir', 'anime')"
                value={detailStyleSearch} onInput={(e) => setDetailStyleSearch(e.target.value)} />
              <button class="btn btn-primary btn-sm" onClick={autoSuggestDetail}>Auto-Suggest</button>
            </div>

            <div style="font-size: 12px; color: var(--secondary-text-color); padding: 8px 0;">
              {detailStyles.length} matching styles
            </div>

            <div class="detail-style-cards">
              {detailStyles.length === 0 && (
                <div style="grid-column: 1/-1; text-align: center; color: var(--secondary-text-color); padding: 40px 0;">
                  No matching styles found.
                </div>
              )}
              {detailStyles.map(style => (
                <div key={style.id}
                  class={`style-card ${detailSelectedStyles.has(style.id) ? 'selected' : ''}`}
                  onClick={() => toggleDetailStyle(style.id)}>
                  <div class="check-mark">✓</div>
                  <div class="card-style">{style.prompt.split(',').slice(0, 4).join(', ')}{style.prompt.split(',').length > 4 ? '...' : ''}</div>
                  <div class="card-meta"><span>Folder {style.folder}</span></div>
                </div>
              ))}
            </div>

            <div class="weight-control" style="margin-top: 16px;">
              <label>Style emphasis</label>
              <input type="range" class="weight-slider" min="0.5" max="1.5" step="0.05"
                value={detailStyleWeight} onInput={(e) => setDetailStyleWeight(parseFloat(e.target.value))} />
              <span class="weight-value">{detailStyleWeight.toFixed(2)}</span>
            </div>
          </div>

          <div class="builder-input-section">
            <h2>3. Output Options</h2>
            <div class="options-row">
              <div class="option-group">
                <label>Seed variants:</label>
                <select value={detailSeedCount} onChange={(e) => setDetailSeedCount(parseInt(e.target.value))}>
                  <option value="1">1 seed</option>
                  <option value="3">3 seeds</option>
                  <option value="5">5 seeds</option>
                </select>
              </div>
              <div class="option-group">
                <input type="checkbox" checked={detailIncludeNegative} onChange={(e) => setDetailIncludeNegative(e.target.checked)} />
                <label>Negative prompts</label>
              </div>
            </div>
          </div>

          <div class="generate-section">
            <button class="btn btn-primary" onClick={generateDetailed}>Generate Prompts</button>
            <button class="btn" onClick={clearDetailed}>Clear All</button>
          </div>
        </>
      )}

      {/* Output */}
      {generatedPrompts.length > 0 && (
        <div class="output-section" ref={outputRef}>
          <div class="export-section">
            <h3>Generated Prompts</h3>
            {generatedPrompts.map((p, i) => (
              <PromptCard key={i} prompt={p} onCopy={handleCopy} />
            ))}
            <div style="margin-top: 20px;">
              <button class="btn" onClick={exportAll}>Copy All Prompts</button>
              <button class="btn" onClick={exportJSON}>Export as JSON</button>
            </div>
          </div>
        </div>
      )}

      <Toast />
    </div>
  );
}
