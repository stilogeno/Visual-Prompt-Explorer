# Documentation

Welcome to the documentation for the **Visual Prompt Explorer**.

A self-contained Preact/Vite web application for browsing, rating, organizing, and exporting prompt-based visual styles. Built with Preact signals for reactive state, IndexedDB for local persistence, and optional Supabase cloud sync.

## Contents

| Document | Purpose |
|----------|---------|
| [Architecture](ARCHITECTURE.md) | Preact/Vite stack, component tree, store, data flow, manifest system. |
| [Style Explorer Guide](STYLE-EXPLORER.md) | User guide: unified gallery, star rating, filtering, viewer modal, export. |
| [Development Guide](DEVELOPMENT.md) | Contributor setup, project structure, dev/build workflow, adding styles. |
| [Prompt Builder](PROMPT-BUILDER.md) | Quick + Detailed modes, weighting, seeds, builder prefill, export. |
| [Supabase Setup](SUPABASE.md) | Local Supabase configuration and cloud sync. |

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Project Structure (at a glance)

```
.
├── index.html              # Vite entry HTML
├── vite.config.js          # Vite config + PWA plugin
├── package.json            # Preact + Vite dependencies
├── src/
│   ├── main.jsx            # Preact mount point
│   ├── App.jsx             # Router (/, /prompt-builder, /admin)
│   ├── store/
│   │   ├── styleStore.js   # Signals, computed, actions
│   │   └── db.js           # IndexedDB CRUD
│   ├── lib/
│   │   ├── supabase.js     # Supabase client + sync
│   │   └── utils.js        # Image paths, clipboard, categories
│   ├── components/
│   │   ├── Header.jsx      # Nav tabs + connection indicator
│   │   ├── Card.jsx        # Gallery card with star rating
│   │   ├── Controls.jsx    # Toolbar: filters, sort, grid, source
│   │   ├── ViewerModal.jsx # Full-size image viewer + actions
│   │   ├── Enhancements.jsx# Keyboard shortcuts
│   │   └── Toast.jsx       # Toast notifications
│   └── pages/
│       ├── GalleryPage.jsx     # Unified gallery (main page)
│       ├── PromptBuilderPage.jsx# Prompt generation tool
│       └── AdminPage.jsx       # Settings & data management
├── public/
│   └── style-library/data/ # Style library JSON files
├── images/                 # Gallery images (521MB)
├── style-library/          # Style library source data
│   └── data/
│       ├── styles.json
│       ├── base_prompts.json
│       ├── generation_manifest.json
│       └── gallery-manifest.json
└── app/                    # Original vanilla JS (reference only)
```
