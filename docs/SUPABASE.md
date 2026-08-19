# Local Supabase Architecture

## Overview

This project uses a **fully local** Supabase implementation. No cloud dependencies. Everything runs on your laptop and NAS on the same local network.

## Infrastructure

### Components

| Component | Location | How It Runs |
|-----------|----------|-------------|
| **Supabase** | Laptop (`SaulUX.local`) | `npx supabase start` (macOS Login Item) |
| **Nginx** | NAS | Always running, serves static pages |
| **OMLX** | NAS | `http://127.0.0.1:8000/v1` |
| **Static Pages** | NAS | Served via Nginx |

### Network Flow

```
Browser → NAS (Nginx + static pages)
         → Laptop (Supabase: http://SaulUX.local:54321)
```

The browser loads pages from the NAS, then connects directly to the laptop's Supabase instance across the network.

## Setup

### 1. macOS Login Item (Automator Script)

Create a macOS Login Item to start Supabase on boot:

```bash
# Create the script
chmod +x scripts/start-local-supabase.sh

# Add to macOS Login Items
# System Settings → General → Login Items → + (add the script)
```

The script:
- Checks if Supabase is already running
- Starts Supabase if not running
- Retries on failure

### 2. Supabase Configuration

The `app/supabase-service.js` uses:
- **URL**: `http://SaulUX.local:54321` (laptop hostname)
- **No cloud Supabase** - everything is local

### 3. Browser Connection

The browser connects to the laptop's Supabase instance. The NAS serves static pages. Both machines are on the same local network.

## How It Works

1. **Boot**: Laptop starts, Automator script runs `npx supabase start`
2. **NAS**: Nginx serves static pages, always running
3. **Browser**: Loads pages from NAS, connects to `http://SaulUX.local:54321`
4. **Network**: Both machines discover each other on the local network

## Troubleshooting

### Supabase Not Reachable

If Supabase is not running, the banner will guide users to:
1. Check if Supabase is started
2. Restart via `npx supabase start`
3. Verify laptop is on the same network as NAS

### Common Issues

- **Laptop hostname**: Ensure `SaulUX.local` resolves correctly on the network
- **Network connectivity**: Verify both machines can reach each other
- **Supabase status**: Check with `npx supabase status`

## Migration from Cloud

This architecture replaces the cloud Supabase entirely. The previous cloud configuration has been removed. All data syncs happen locally on the laptop.