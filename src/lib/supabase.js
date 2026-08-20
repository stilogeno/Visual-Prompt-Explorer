import { signal } from '@preact/signals';

// Environment configuration with VITE_ prefix for Vite
const ENV = {
  // Local Supabase (default)
  LOCAL_URL: import.meta.env.VITE_SUPABASE_URL || '',
  LOCAL_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  // Cloud fallback
  CLOUD_URL: import.meta.env.VITE_SUPABASE_CLOUD_URL || '',
  CLOUD_KEY: import.meta.env.VITE_SUPABASE_CLOUD_KEY || '',
  // Feature flags
  IMAGE_URL_EXPORT: import.meta.env.VITE_IMAGE_URL_EXPORT === 'true',
  DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE === 'true',
};

let client = null;
let connectionStatus = signal('offline');

export { connectionStatus };

/**
 * Validates a Supabase anon key format
 * A valid JWT key has 3 dot-separated base64 segments and is 100+ chars
 */
function isValidKey(key) {
  if (typeof key !== 'string') return false;
  if (key.length < 100) return false;
  if (!key.includes('.')) return false;
  // Check it's a valid JWT format (3 parts separated by dots)
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  // Reject obviously-invalid dev keys
  if (key.includes('local_key_for_development') || key.includes('your-')) return false;
  return true;
}

/**
 * Validates that a URL is a trusted Supabase endpoint
 * Allows: localhost, 127.0.0.1, .supabase.co domains, or user-configured local hosts
 */
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    
    // Allow localhost/127.0.0.1
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    
    // Allow Supabase cloud domains
    if (hostname.endsWith('.supabase.co')) return true;
    
    // Allow LAN hostnames (user-configured local instances)
    // These are typically .local, .lan, or user-defined hostnames
    if (hostname.endsWith('.local') || hostname.endsWith('.lan')) return true;
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Attempts to initialize Supabase client with the given config
 * Returns true on success, false on failure
 */
function createClient(url, key) {
  if (!window.supabase) {
    console.warn('[Supabase] SDK not loaded');
    return { success: false, reason: 'SDK_NOT_LOADED' };
  }
  
  if (!isValidKey(key)) {
    console.warn('[Supabase] Invalid or missing API key');
    return { success: false, reason: 'INVALID_KEY' };
  }
  
  if (!isValidUrl(url)) {
    console.warn('[Supabase] Invalid or untrusted URL:', url);
    return { success: false, reason: 'INVALID_URL' };
  }

  try {
    client = window.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return { success: true };
  } catch (e) {
    console.warn('[Supabase] Failed to create client:', e);
    return { success: false, reason: 'CREATE_ERROR' };
  }
}

/**
 * Test connection to Supabase by making a simple query
 * Returns true if connection succeeds
 */
async function testConnection(url, key) {
  if (!isValidUrl(url) || !isValidKey(key)) return false;
  if (!window.supabase) return false;
  
  try {
    const testClient = window.supabase.createClient(url, key);
    const { error } = await testClient.from('user_favorites').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Initialize Supabase with Local -> Cloud fallback strategy
 * 1. Try local Supabase first
 * 2. If local fails, try cloud fallback if configured
 * 3. Always update connectionStatus signal for UI feedback
 */
export async function initSupabase() {
  // First try local Supabase
  if (ENV.LOCAL_URL && isValidKey(ENV.LOCAL_KEY)) {
    const localTest = await testConnection(ENV.LOCAL_URL, ENV.LOCAL_KEY);
    if (localTest) {
      const result = createClient(ENV.LOCAL_URL, ENV.LOCAL_KEY);
      if (result.success) {
        connectionStatus.value = 'local';
        console.log('[Supabase] Connected to local instance:', ENV.LOCAL_URL);
        return true;
      }
    }
  }
  
  // Fallback to cloud if configured
  if (ENV.CLOUD_URL && isValidKey(ENV.CLOUD_KEY)) {
    const cloudTest = await testConnection(ENV.CLOUD_URL, ENV.CLOUD_KEY);
    if (cloudTest) {
      const result = createClient(ENV.CLOUD_URL, ENV.CLOUD_KEY);
      if (result.success) {
        connectionStatus.value = 'cloud';
        console.log('[Supabase] Connected to cloud fallback:', ENV.CLOUD_URL);
        return true;
      }
    }
  }
  
  // Offline mode - no working connection
  connectionStatus.value = 'offline';
  console.warn('[Supabase] No working connection (neither local nor cloud available)');
  return false;
}

export function isConnected() {
  return !!client;
}

export function getConnectionStatus() {
  return connectionStatus.value;
}

export function getUserId() {
  let id = localStorage.getItem('krea_user_uuid');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('krea_user_uuid', id);
  }
  return id;
}

export async function syncFavorite(cardId, rating) {
  if (!client) return;
  const userId = getUserId();
  
  try {
    if (!rating) {
      await client.from('user_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('card_id', String(cardId));
    } else {
      await client.from('user_favorites')
        .upsert({
          user_id: userId,
          card_id: String(cardId),
          rating: rating,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,card_id' });
    }
  } catch (e) {
    console.warn('[Supabase] Sync failed:', e.message);
  }
}

export async function fetchGlobalCounts() {
  if (!client) return new Map();
  
  try {
    const { data, error } = await client.from('card_favorite_counts')
      .select('card_id, total_favs');
    
    if (error) throw error;
    
    const map = new Map();
    (data || []).forEach(r => map.set(String(r.card_id), r.total_favs));
    return map;
  } catch (e) {
    console.warn('[Supabase] Fetch counts failed:', e.message);
    return new Map();
  }
}