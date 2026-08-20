import { useState, useEffect } from 'preact/hooks';
import { adminSettings, showToast } from '../store/styleStore';
import Header from '../components/Header';
import Toast from '../components/Toast';
import './AdminPage.css';

const SETTINGS_KEY = 'krea_admin_settings';

const defaults = {
  itemsPerPage: 20,
  sortOrder: 'desc',
  scrollThreshold: 200,
  gridCols: 5,
  toastDuration: 2000,
  scrollTopThreshold: 300,
  supabaseSync: true,
  imageUrlExport: false,
  debugMode: false,
  supabaseUrl: '',
  supabaseKey: '',
  aiBaseUrl: '',
  aiChatModel: 'GLM-4.7-Flash-MLX-4bit',
  aiEmbedModel: 'Qwen3-Embedding-4B-4bit-DWQ',
  aiTimeout: 15000,
  aiEnabled: true,
  aiNsfw: false,
};

function Toggle({ checked, onChange, disabled = false }) {
  return (
    <label class="toggle-switch" title={checked ? 'Enabled' : 'Disabled'}>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        class="toggle-input"
      />
      <span class="toggle-track" aria-hidden="true">
        <span class="toggle-thumb"></span>
      </span>
      <span class="toggle-label" aria-hidden="true">
        {checked ? 'On' : 'Off'}
      </span>
    </label>
  );
}

function SettingRow({ title, hint, children }) {
  return (
    <div class="setting-row">
      <div class="setting-label">
        <div class="label-title">{title}</div>
        <div class="label-hint">{hint}</div>
      </div>
      <div class="setting-control">{children}</div>
    </div>
  );
}

export default function AdminPage() {
  const [settings, setSettings] = useState({ ...defaults });
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [connectionTime, setConnectionTime] = useState('Never');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      setSettings(s => ({ ...s, ...parsed }));
    }
  }, []);

  const update = (key, value) => {
    setSettings(s => ({ ...s, [key]: value }));
  };

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    adminSettings.value = settings;
    showToast('Settings saved! Reloading...');
    setTimeout(() => { window.location.href = '/'; }, 1200);
  };

  const handleReset = async () => {
    setShowResetConfirm(false);
    try {
      const idb = indexedDB.open('StyleGalleryKrea', 5);
      idb.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(db.objectStoreNames, 'readwrite');
        for (const storeName of db.objectStoreNames) {
          tx.objectStore(storeName).clear();
        }
        tx.oncomplete = () => {
          localStorage.removeItem(SETTINGS_KEY);
          localStorage.removeItem('krea_user_uuid');
          localStorage.removeItem('gridColumnCount');
          showToast('All data cleared! Reloading...');
          setTimeout(() => { window.location.href = '/'; }, 1200);
        };
      };
    } catch (e) {
      showToast('Error clearing data: ' + e.message);
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus('Testing...');
    setConnectionTime('—');
    try {
      const res = await fetch(`${settings.supabaseUrl}/rest/v1/card_favorite_counts?select=count`, {
        headers: { 'apikey': settings.supabaseKey, 'preference': 'resolveFulfilled' }
      });
      if (res && res.status === 200) {
        setConnectionStatus('Connected');
        setConnectionTime(new Date().toLocaleTimeString());
        showToast('Connection successful!');
      } else {
        setConnectionStatus('Error');
        setConnectionTime('Failed');
        showToast('Connection failed');
      }
    } catch (e) {
      setConnectionStatus('Error');
      setConnectionTime(e.message);
      showToast('Connection failed: ' + e.message);
    }
  };

  const getUserId = () => {
    const id = localStorage.getItem('krea_user_uuid') || '(none)';
    return id.substring(0, 12) + '…';
  };

  return (
    <div class="admin-container">
      <Header />

      {/* Gallery Settings */}
      <div class="admin-section">
        <h2>Gallery</h2>
        <p class="section-desc">Items per page, grid columns, and default sort order.</p>

        <SettingRow title="Items Per Page" hint="How many cards load before hitting 'load more'">
          <input type="number" class="number-input" min="5" max="60"
            value={settings.itemsPerPage} onInput={(e) => update('itemsPerPage', parseInt(e.target.value) || 20)} />
        </SettingRow>

        <SettingRow title="Default Sort Order" hint="How items are sorted when gallery loads">
          <select class="select-input" value={settings.sortOrder}
            onChange={(e) => update('sortOrder', e.target.value)}>
            <option value="desc">Most Favorites (High → Low)</option>
            <option value="asc">Least Favorites (Low → High)</option>
          </select>
        </SettingRow>

        <SettingRow title="Auto-Scroll Threshold" hint="Load more items when within this many pixels of bottom">
          <input type="number" class="number-input" min="50" max="1000"
            value={settings.scrollThreshold} onInput={(e) => update('scrollThreshold', parseInt(e.target.value) || 200)} />
        </SettingRow>
      </div>

      {/* Display Settings */}
      <div class="admin-section">
        <h2>Display</h2>
        <p class="section-desc">Grid layout and toast notification behavior.</p>

        <SettingRow title="Columns (Default)" hint="Grid columns on desktop (saved per-session, but this sets the default)">
          <input type="number" class="number-input" min="4" max="10"
            value={settings.gridCols} onInput={(e) => update('gridCols', parseInt(e.target.value) || 5)} />
        </SettingRow>

        <SettingRow title="Toast Duration" hint="How long notification toasts stay visible (ms)">
          <input type="number" class="number-input" min="500" max="5000" step="100"
            value={settings.toastDuration} onInput={(e) => update('toastDuration', parseInt(e.target.value) || 2000)} />
        </SettingRow>

        <SettingRow title="Scroll-to-Top Threshold" hint='Show the "back to top" button after scrolling this many pixels'>
          <input type="number" class="number-input" min="50" max="1000"
            value={settings.scrollTopThreshold} onInput={(e) => update('scrollTopThreshold', parseInt(e.target.value) || 300)} />
        </SettingRow>
      </div>

      {/* Feature Flags */}
      <div class="admin-section">
        <h2>Feature Flags</h2>
        <p class="section-desc">Enable or disable specific features. Changes apply immediately.</p>

        <SettingRow title="Supabase Cloud Sync" hint="Sync favorites to Supabase database">
          <Toggle checked={settings.supabaseSync} onChange={(e) => update('supabaseSync', e.target.checked)} />
        </SettingRow>

        <SettingRow title="Image URL Export" hint="Show 'Export URLs' button in favorites toolbar">
          <Toggle checked={settings.imageUrlExport} onChange={(e) => update('imageUrlExport', e.target.checked)} />
        </SettingRow>

        <SettingRow title="Debug Mode" hint="Check all image paths on load (slow, for troubleshooting)">
          <Toggle checked={settings.debugMode} onChange={(e) => update('debugMode', e.target.checked)} />
        </SettingRow>
      </div>

      {/* Supabase Settings */}
      <div class="admin-section">
        <h2>Supabase Configuration</h2>
        <p class="section-desc">Database URL and anonymous key. Only change if you're using a different Supabase project.</p>

        <SettingRow title="Supabase URL" hint="Your Supabase project endpoint">
          <input type="text" class="text-input" placeholder="http://your-supabase-host:54321"
            value={settings.supabaseUrl} onInput={(e) => update('supabaseUrl', e.target.value)} />
        </SettingRow>

        <SettingRow title="Supabase Anon Key" hint="Project anonymous/public API key">
          <input type="text" class="text-input" placeholder="eyJhbG..."
            value={settings.supabaseKey} onInput={(e) => update('supabaseKey', e.target.value)} />
        </SettingRow>

        <div class="admin-actions">
          <button class="btn" onClick={handleTestConnection}>Test Connection</button>
        </div>
      </div>

      {/* Connection Status */}
      <div class="admin-section">
        <h2>Connection Status</h2>
        <p class="section-desc">Real-time status of your Supabase connection.</p>

        <SettingRow title="Status" hint="Current connection state">
          <span class={`connection-badge ${connectionStatus === 'Connected' ? 'connected' : connectionStatus === 'Testing...' ? 'testing' : 'error'}`}>
            {connectionStatus}
          </span>
        </SettingRow>

        <SettingRow title="Last Check" hint="When Supabase was last verified">
          <span class="connection-time">{connectionTime}</span>
        </SettingRow>
      </div>

      {/* AI / LLM Provider Settings */}
      <div class="admin-section">
        <h2>AI / LLM Provider</h2>
        <p class="section-desc">Configure the local OpenAI-compatible LLM used by the Prompt Builder.</p>

        <SettingRow title="Provider Base URL" hint="OpenAI-compatible endpoint (e.g. Ollama, LM Studio, vLLM)">
          <input type="text" class="text-input" placeholder="http://your-llm-host:8000/v1"
            value={settings.aiBaseUrl} onInput={(e) => update('aiBaseUrl', e.target.value)} />
        </SettingRow>

        <SettingRow title="Chat Model" hint="Model used for AI Enhance and Generate New Style">
          <input type="text" class="text-input" placeholder="GLM-4.7-Flash-MLX-4bit"
            value={settings.aiChatModel} onInput={(e) => update('aiChatModel', e.target.value)} />
        </SettingRow>

        <SettingRow title="Embedding Model" hint="Model used for semantic AI Suggest search">
          <input type="text" class="text-input" placeholder="Qwen3-Embedding-4B-4bit-DWQ"
            value={settings.aiEmbedModel} onInput={(e) => update('aiEmbedModel', e.target.value)} />
        </SettingRow>

        <SettingRow title="Request Timeout" hint="Max wait for LLM responses before falling back (ms)">
          <input type="number" class="number-input" min="3000" max="120000" step="1000"
            value={settings.aiTimeout} onInput={(e) => update('aiTimeout', parseInt(e.target.value) || 15000)} />
        </SettingRow>

        <SettingRow title="AI Features Enabled" hint="Show/hide AI buttons in the Prompt Builder">
          <Toggle checked={settings.aiEnabled} onChange={(e) => update('aiEnabled', e.target.checked)} />
        </SettingRow>

        <SettingRow title="Allow NSFW Outputs" hint="When off, the LLM is instructed to keep all output safe for work">
          <Toggle checked={settings.aiNsfw} onChange={(e) => update('aiNsfw', e.target.checked)} />
        </SettingRow>
      </div>

      {/* Data Management */}
      <div class="admin-section">
        <h2>Data Management</h2>
        <p class="section-desc">Manage your local IndexedDB storage (ratings, settings, user ID).</p>

        <div class="db-stats">
          <div class="db-stat-card">
            <div class="stat-value">{getUserId()}</div>
            <div class="stat-label">User ID</div>
          </div>
        </div>

        <div class="admin-actions">
          <button class="btn btn-danger" onClick={() => setShowResetConfirm(true)}>Reset All Data</button>
          <button class="btn btn-primary" onClick={handleSave}>Save Settings & Reload</button>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div class="confirm-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setShowResetConfirm(false); }}>
          <div class="confirm-dialog">
            <h3>Reset All Data?</h3>
            <p>This will permanently delete all ratings, folders, and settings. This cannot be undone. Your gallery styles and images are not affected.</p>
            <div class="confirm-actions">
              <button class="btn" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button class="btn btn-danger" onClick={handleReset}>Delete Everything</button>
            </div>
          </div>
        </div>
      )}

      <Toast />
    </div>
  );
}
