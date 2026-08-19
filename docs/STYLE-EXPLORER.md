# Style Explorer — User Guide

The gallery is the heart of the app. This guide covers everything you can do with it.

## Unified Gallery

The main page (`/`) displays a unified gallery combining:

- **Gallery items** — 1,500+ curated styles from the original dataset
- **Style library items** — Additional style presets with base-prompt-dependent images

All items appear in a single grid. Use the **source filter** to view All, Gallery only, or Style only.

## The Card

Each card shows:

- **Image** — the style preview
- **Star rating (top-right)** — rate the style from 1 to 5 stars
- **Name** — auto-generated display name
- **Categories** — extracted keyword tags (if `Show Details` is enabled)
- **"Style" badge** — teal badge on style library items
- **Hover actions (bottom):**
  - **📋 Copy** — copies the style prompt
  - **👁 View** — opens the full-size image viewer

Clicking the card (anywhere else) also copies the prompt.

## Star Rating System

- **Community default:** unrated styles show a rating derived from community likes (`likes ÷ 4`, capped at 5)
- **Personal override:** once you rate a style, it shows **your** rating instead
- **Dynamic re-sort:** the gallery re-sorts instantly when you vote — cards move to their rightful place or disappear if they no longer match the active star filter

Ratings are saved in your browser (IndexedDB) and optionally synced to Supabase.

## Sorting & Filtering

The toolbar provides:

- **Star filter buttons (5★ 4★ 3★ 2★ 1★ 0★)** — multiselect. Only styles matching selected levels are shown. All active by default.
- **Source filter** — All / Gallery / Style. Controls which items appear.
- **Category filter** — dropdown of all unique categories across the library.
- **Sort** — Rating (default), A–Z, Z–A, or Random.
- **Show Details** — toggle categories on cards.
- **Grid slider** — adjust columns (1–10). Keyboard: keys `1`–`9`, `0` for 10.

## Search

Type in the search box to filter styles by keyword (matches name, prompt, categories). The counter updates as you type.

## Base Prompt Selector

The gallery uses **base prompts** — pre-written subject descriptions that provide context for style prompts. Choose from presets like Portrait, Full Figure, Architecture, etc.

- Click **"View Prompt"** in the toolbar to see the active base prompt text.
- The base prompt is appended when copying a style prompt.

### Style Base Prompt (Style Library)

Style library items use a separate **style base prompt** selector. Changing this re-resolves the preview images for all style library items.

## Viewer Modal

Click the 👁 button (or click a card) to open the full-size viewer:

- **Navigate** — ← → arrows or swipe on touch
- **Copy prompt** — copies the full prompt text
- **"Use as base"** — sends the item to the Prompt Builder, prefilling the subject and style fields
- **Keyboard:** `←` `→` navigate, `C` copy, `B` use as base, `Esc` close

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `S` | Quick-rate 5★ on hovered card |
| `M` | Open moodboards |
| `V` | Show rating stats |
| `?` | Show help overlay |
| `1`–`9`, `0` | Set grid columns (1–10) |

## Export / Import

From the Admin page (`/admin`):

- **Export JSON** — downloads all favorites with ratings and folder data
- **Import JSON** — merges favorites from a JSON export
- **Export TXT** — downloads favorites as a plain text wildcard list (for ComfyUI, Diffusers, SGLang)

## Scroll Behavior

- **Infinite scroll** — more cards load automatically as you scroll down
- **Scroll to top** — a ↑ button appears when scrolled down; click to return to top

## Offline

When served over HTTP(S), the PWA service worker caches the app shell and images, so the gallery works offline after the first visit.
