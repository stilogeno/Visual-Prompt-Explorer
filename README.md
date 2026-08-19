# Visual Prompt Explorer

An interactive visual database for browsing, rating, and extracting prompts from AI-generated visual styles.

<p align="center">
  <img src="images/Krea 2 Turbo - Style Explorer.webp" alt="Visual Prompt Explorer Interface Preview" width="800">
</p>

## Features

- **Unified Gallery** — Browse 1,500+ gallery styles and style library presets in a single view. Filter by source (Gallery, Style Library, or All).
- **Star Rating System** — Rate styles 1–5 stars. Community-based defaults become your personal rating the moment you vote. Gallery re-sorts instantly.
- **Prompt Builder** — Generate complete text-to-image prompts from subjects + style presets. Quick Build for blog covers, Detailed mode for fine control.
- **Style Base Prompt Selector** — Switch between base prompts to see how styles render with different subjects.
- **Viewer Modal** — Full-size image viewer with prompt copy, "Use as base" to Prefill the Prompt Builder, keyboard and touch navigation.
- **Search & Filter** — Keyword search, category filter, star filter, and sort (Rating, A–Z, Z–A).
- **Responsive Grid** — Adjustable columns (1–10) with keyboard shortcuts (keys 1–0).
- **Offline Support** — PWA with service worker for offline caching.
- **Supabase Sync** — Optional cloud sync for community ratings via local Supabase instance.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Production Build

```bash
npm run build
```

Output goes to `dist/`. Serve with any static HTTP server.

## Documentation

Detailed documentation lives in the [`docs/`](docs/) folder:

- **[Architecture](docs/ARCHITECTURE.md)** — Preact/Vite stack, components, store, data flow.
- **[Style Explorer Guide](docs/STYLE-EXPLORER.md)** — User guide: gallery, rating, filtering, viewer, export.
- [Development Guide](docs/DEVELOPMENT.md) — Contributor setup, project structure, adding styles.
- **[Prompt Builder](docs/PROMPT-BUILDER.md)** — Quick + Detailed modes, weighting, seeds, export.
- [Supabase Setup](docs/SUPABASE.md) — Local Supabase configuration and cloud sync.

## Tech Stack

- **Preact** (3KB) with signals for reactive state
- **Vite** for fast dev/build
- **preact-router** for SPA routing
- **IndexedDB** for local persistence (ratings, settings)
- **PWA** with workbox for offline support

## Acknowledgments

This project builds on the work of two open-source projects:

- **[t2i-krea-2-style-library](https://github.com/matplinta/t2i-krea-2-style-library)** by **matplinta** — the original style library dataset and prompt format for Krea 2 Turbo.
- **[Krea2-Style-Explorer](https://github.com/ThetaCursed/Krea2-Style-Explorer)** by **ThetaCursed** (repo since deleted) — the original gallery UI, style curation, and core exploration experience.

The gallery UI, style library, and prompt system from these projects form the foundation this codebase builds on.

Additional modifications — star-rating system, prompt builder, unified gallery, and Preact/Vite migration — are maintained by **saulux**.
