export function getImagePath(id, folder) {
  return `images/${folder}/${String(id)}.webp`;
}

// Category extraction from prompt text
const CATEGORY_RULES = [
  // Art Movements
  { category: 'Impressionism', keywords: ['impressionism', 'impressionist', 'plein air', 'broken color', 'visible brushstroke'] },
  { category: 'Expressionism', keywords: ['expressionism', 'expressionist', 'emotional', 'distorted', 'psychological'] },
  { category: 'Surrealism', keywords: ['surreal', 'surrealism', 'dreamlike', 'dreamcore', 'liminal', 'fantasy', 'ethereal'] },
  { category: 'Minimalism', keywords: ['minimalist', 'minimalism', 'minimal', 'stark', 'simple composition', 'clean'] },
  { category: 'Pop Art', keywords: ['pop art', 'pop-art', 'andy warhol', 'bold graphic', 'saturated', 'vibrant'] },
  { category: 'Art Nouveau', keywords: ['art nouveau', 'organic', 'flowing lines', 'ornamental', 'decorative'] },
  { category: 'Cubism', keywords: ['cubism', 'cubist', 'geometric', 'fragmented', 'abstracted forms'] },
  { category: 'Pointillism', keywords: ['pointillism', 'stippling', 'dotwork', 'halftone', 'stippled', 'divisionism'] },
  { category: 'Photorealism', keywords: ['photorealistic', 'photorealism', 'hyperrealistic', 'realistic', 'detailed rendering'] },

  // Mediums & Techniques
  { category: 'Photography', keywords: ['photography', 'photo', '35mm', 'film grain', 'analog', 'camera', 'shutter', 'bokeh', 'lens'] },
  { category: 'Watercolor', keywords: ['watercolor', 'watercolour', 'wash', 'transparent', 'fluid'] },
  { category: 'Oil Painting', keywords: ['oil paint', 'oil painting', 'impasto', 'thick paint', 'brushwork'] },
  { category: 'Digital Art', keywords: ['digital', 'digital art', 'digital illustration', 'render'] },
  { category: 'Charcoal', keywords: ['charcoal', 'graphite', 'pencil', 'sketch', 'drawing'] },
  { category: 'Ink', keywords: ['ink', 'linework', 'linework', 'pen', 'ink wash'] },
  { category: 'Collage', keywords: ['collage', 'montage', 'cutout', 'mixed media', 'assemblage'] },
  { category: 'Engraving', keywords: ['engraving', 'etching', 'woodcut', 'linocut', 'printmaking'] },
  { category: 'Vector', keywords: ['vector', 'flat design', 'clean lines', 'graphic'] },

  // Subjects
  { category: 'Portrait', keywords: ['portrait', 'face', 'headshot', 'character', 'person', 'figure'] },
  { category: 'Landscape', keywords: ['landscape', 'scenery', 'mountain', 'forest', 'sky', 'horizon', 'nature'] },
  { category: 'Architecture', keywords: ['architecture', 'building', 'city', 'urban', 'street', 'interior'] },
  { category: 'Still Life', keywords: ['still life', 'object', 'arrangement', 'composition'] },
  { category: 'Abstract', keywords: ['abstract', 'non-representational', 'geometric', 'shapes', 'patterns'] },
  { category: 'Sci-Fi', keywords: ['sci-fi', 'science fiction', 'futuristic', 'cyberpunk', 'neon', 'spaceship'] },
  { category: 'Fantasy', keywords: ['fantasy', 'magical', 'mythical', 'enchanted', 'fairy tale'] },
  { category: 'Horror', keywords: ['horror', 'dark', 'gothic', 'macabre', 'creepy', 'eerie'] },

  // Mood & Atmosphere
  { category: 'Moody', keywords: ['moody', 'atmospheric', 'dramatic', 'chiaroscuro', 'high contrast'] },
  { category: 'Vibrant', keywords: ['vibrant', 'saturated', 'colorful', 'bold color', 'neon'] },
  { category: 'Muted', keywords: ['muted', 'desaturated', 'pastel', 'soft', 'subtle'] },
  { category: 'Retro', keywords: ['retro', 'vintage', 'nostalgic', '70s', '80s', '90s', 'throwback'] },
  { category: 'Noir', keywords: ['noir', 'film noir', 'black and white', 'monochrome', 'shadow'] },

  // Styles
  { category: 'Anime', keywords: ['anime', 'manga', 'cel-shaded', '2d', 'japanese animation'] },
  { category: 'Cartoon', keywords: ['cartoon', 'caricature', 'illustration', 'whimsical', 'playful'] },
  { category: 'Realism', keywords: ['realistic', 'realism', 'naturalistic', 'lifelike'] },
  { category: 'Stylized', keywords: ['stylized', 'stylised', 'interpretation', 'artistic'] },
];

/**
 * Extract categories from a prompt text based on keyword matching
 * @param {string} prompt - The style prompt text
 * @returns {string[]} Array of matching category names
 */
export function extractCategoriesFromPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return [];

  const lower = prompt.toLowerCase();
  const matched = new Set();

  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword)) {
        matched.add(rule.category);
        break;
      }
    }
  }

  // If no categories matched, try to extract from first few words
  if (matched.size === 0) {
    const words = prompt.split(/[\s,]+/).filter(w => w.length > 2);
    // Use the first meaningful word as a category
    if (words.length > 0) {
      const firstWord = words[0].charAt(0).toUpperCase() + words[0].slice(1);
      matched.add(firstWord);
    }
  }

  return [...matched].sort();
}

// Name generation from prompt text
const NAME_BLACKLIST = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'this',
  'that', 'these', 'those', 'it', 'its', 'very', 'such', 'much', 'more',
  'most', 'some', 'any', 'all', 'each', 'every', 'both', 'few', 'many',
  'several', 'own', 'same', 'than', 'then', 'also', 'just', 'about',
  'above', 'after', 'before', 'between', 'into', 'through', 'during',
]);

/**
 * Extract meaningful words from a prompt, filtered and normalized
 * @param {string} prompt - The style prompt text
 * @returns {string[]} Array of meaningful words (lowercase)
 */
function extractMeaningfulWords(prompt) {
  if (!prompt || typeof prompt !== 'string') return [];

  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except hyphens
    .split(/[\s,]+/) // Split on spaces and commas
    .map(w => w.replace(/^-+|-+$/g, '')) // Trim leading/trailing hyphens
    .filter(w => w.length > 2 && !NAME_BLACKLIST.has(w));

  // Deduplicate while preserving order
  const seen = new Set();
  return words.filter(w => {
    if (seen.has(w)) return false;
    seen.add(w);
    return true;
  });
}

/**
 * Generate a unique name for a gallery item based on its prompt
 * @param {string} prompt - The style prompt text
 * @param {Set<string>} existingNames - Set of already-used names to avoid duplicates
 * @param {number} maxAttributes - Maximum number of attributes in the name (default: 4)
 * @returns {string} Generated name (Title Case)
 */
export function generateUniqueName(prompt, existingNames = new Set(), maxAttributes = 4) {
  const words = extractMeaningfulWords(prompt);
  if (words.length === 0) return 'Style';

  // Try names with increasing number of attributes
  for (let attrCount = 1; attrCount <= Math.min(maxAttributes, words.length); attrCount++) {
    const candidateWords = words.slice(0, attrCount);
    const candidate = candidateWords
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    if (!existingNames.has(candidate)) {
      return candidate;
    }
  }

  // If all combinations up to maxAttributes are taken, append a number
  const baseWords = words.slice(0, maxAttributes);
  let base = baseWords
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  let counter = 2;
  while (existingNames.has(`${base} ${counter}`)) {
    counter++;
  }
  return `${base} ${counter}`;
}

export function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    resolve();
  });
}

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function loadAdminSettings() {
  const defaults = {
    itemsPerPage: 20,
    sortOrder: 'desc',
    scrollThreshold: 200,
    gridCols: 5,
    foldersVisible: true,
    toastDuration: 2000,
    scrollTopThreshold: 300,
    supabaseSync: false,
    imageUrlExport: false,
    debugMode: false,
  };
  try {
    const stored = localStorage.getItem('krea_admin_settings');
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {}
  return defaults;
}
