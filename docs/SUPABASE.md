# Local Supabase Architecture

## Overview

This project uses a **local** Supabase implementation. No cloud dependencies. Everything runs on your local machine(s) on the same network.

## Infrastructure

### Components

| Component | Location | How It Runs |
|-----------|----------|-------------|
| **Supabase** | Your machine | `npx supabase start` |
| **Nginx** (optional) | Same machine or NAS | Serves static pages + proxies API |
| **Local LLM** (optional) | Same machine | OpenAI-compatible (Ollama, LM Studio, etc.) |

### Network Flow

```
Browser → Static pages (Nginx or dev server)
         → Supabase (npx supabase start)
         → Local LLM (optional, for AI features)
```

The browser loads pages, then connects to your local Supabase instance.

## Setup

### 1. Start Supabase

```bash
npx supabase start
```

This starts the local Supabase instance (default port: `54321`).

### 2. Configure the App

Either:
- **Admin page** (`/admin`): enter your Supabase URL and anon key
- **Environment variables**: copy `.env.example` to `.env` and fill in values

```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Optional: Nginx Proxy

If using Nginx, update `nginx/default.conf` with your Supabase host address.

## How It Works

1. **Boot**: Run `npx supabase start` to start the database
2. **App**: Loads and connects to your Supabase instance
3. **Sync**: Favorites and ratings sync to your local database
4. **Graceful degradation**: If Supabase is unreachable, the app works in local-only mode

## Supabase Ports

Default ports (configurable in `supabase/config.toml`):

| Service | Port |
|---------|------|
| API (PostgREST) | 54321 |
| Database | 54322 |
| Studio | 54323 |
| Auth | 9999 |

## Troubleshooting

### Supabase Not Reachable

If Supabase is not running, the app will show an offline indicator. To fix:
1. Run `npx supabase start`
2. Verify with `npx supabase status`
3. Check that the URL in Admin settings matches your Supabase instance

### Common Issues

- **Port conflict**: Check if another service is using port 54321
- **Network**: Ensure the browser can reach the Supabase host
- **Key format**: The anon key should be a valid JWT (3 dot-separated segments, 100+ chars)
