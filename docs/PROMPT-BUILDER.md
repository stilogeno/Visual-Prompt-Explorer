# Prompt Builder

The Prompt Builder (`/prompt-builder`) helps you assemble complete text-to-image prompts from a subject plus style presets. It has two modes: **Quick Build** and **Detailed**.

## Quick Build Mode

Designed for blog post or article cover images.

### Workflow

1. **Blog Post Context** — paste a topic/summary and choose an image type (Cover, Accompanying, or Both)
2. **Visual Style Direction** — pick style preset chips (Cinematic, Noir, Minimalist, etc.) and/or add custom style keywords
3. **Output Options** — styles per variant, seed variants per style, negative prompt toggle
4. **Sliders** — subject emphasis (1.0–1.5) and style emphasis (0.5–1.5)
5. **Generate** — produces prompt cards

The builder scores candidate styles by keyword match against the topic, then assembles the top matches into weighted prompts.

### Style Presets

| Preset | Keywords |
|--------|----------|
| Cinematic | cinematic, dramatic lighting, film grain, depth of field |
| Noir | noir, chiaroscuro, high contrast, monochrome |
| Minimalist | minimalist, clean lines, negative space |
| Vintage | vintage, retro, film grain, warm tones |
| Anime | anime, manga, cel shaded, stylized eyes |
| Watercolor | watercolor, wet-on-wet, soft edges |
| Photorealistic | photorealistic, 8k, ultra detailed |
| Surreal | surreal, dreamlike, impossible geometry |
| Retro | retro, 80s, synthwave, neon |
| Dark & Moody | dark moody, low key, dramatic shadows |
| Warm & Cozy | warm lighting, cozy, soft glow |
| Tech / Futuristic | futuristic, sci-fi, cyberpunk |
| Nature / Organic | nature, organic, botanical |
| Abstract / Geometric | geometric, abstract, fractal |
| Hand-Drawn | hand drawn, sketch, pencil sketch |
| Graffiti / Street | graffiti, street art, urban |

## Detailed Mode

A manual, gallery-driven flow:

1. **Subject & Context** — enter subject, environment, mood, and additional details
2. **Style Selection** — search the style library (debounced live search with match count) or browse the list; click to select one or more styles
3. **Output Options** — seed count, negative prompt toggle
4. **Sliders** — subject emphasis and style emphasis
5. **Generate** — produces one prompt card per selected style

### Builder Prefill

When you click **"Use as base"** in the Viewer Modal (from the gallery), the Prompt Builder:

1. Switches to Detailed mode
2. Fills the "Additional Details" field with the item's prompt
3. Pre-fills the style search with the item's first category

This lets you quickly iterate on a style you found in the gallery.

## Prompt Output

Each generated prompt card displays:

- **Positive Prompt** — the assembled prompt with weighted terms `(term:weight)`
- **Negative Prompt** — common artifact exclusions (if enabled)
- **Seed Variants** — reproducible variations from preset seeds
- **Style Source** — the original style prompt used

### Default Negative Prompt

```
ugly, deformed, noisy, blurry, distorted, grainy, low contrast, text, watermark,
signature, cut off, low resolution, poorly drawn, extra limbs, mutated hands,
bad anatomy, wrong anatomy, extra limbs, extra fingers, fused fingers,
too many fingers, long neck
```

## Seed Variants

Each prompt includes seed variants from: `-1, 42, 137, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536`

Seeds give you reproducible variations of the same prompt.

## Weighting

- **Subject emphasis** (1.0–1.5): how strongly the subject block is weighted
- **Style emphasis** (0.5–1.5): how strongly the style modifiers are weighted

Weighted terms render as `(term:weight)` in the prompt output.

## Copy & Export

| Action | What It Copies |
|--------|---------------|
| Copy Positive | Positive prompt + first seed |
| Copy Negative | Negative prompt + first seed |
| Copy Both | Positive + negative + seed |
| Copy All Prompts | Every generated prompt as a formatted block |
| Export as JSON | Downloads all prompts as a JSON file |

## AI Features (Local OMLX)

The builder can optionally use a local OpenAI-compatible LLM (configured in Admin settings) for:

- **AI Suggest** — semantic search over all 1,596 library prompts using precomputed vectors
- **AI Enhance** — LLM rewrites your topic into a vivid prompt
- **Generate New Style** — LLM invents a new style prompt

All fall back gracefully to lexical matching if OMLX is unreachable.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Close any open dialog |
