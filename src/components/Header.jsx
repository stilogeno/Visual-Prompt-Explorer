import { connectionStatus } from '../store/styleStore';
import './Header.css';

const PAGES = [
  { id: 'gallery', label: 'Gallery', href: '/' },
  { id: 'builder', label: 'Prompt Builder', href: '/prompt-builder' },
  { id: 'admin', label: 'Admin', href: '/admin' },
];

function ConnectionIndicator() {
  const status = connectionStatus.value;
  
  if (!status) return null;
  
  const getConnectionDisplay = () => {
    switch (status) {
      case 'local':
        return { text: 'Connected (Local)', class: 'status-local' };
      case 'cloud':
        return { text: 'Connected (Cloud)', class: 'status-cloud' };
      case 'offline':
        return { text: 'Offline', class: 'status-offline' };
      default:
        return { text: '', class: '' };
    }
  };
  
  const display = getConnectionDisplay();
  if (!display.text) return null;
  
  return (
    <span class={`connection-status ${display.class}`} title="Supabase connection status">
      {status === 'offline' ? '⚪' : status === 'local' ? '🔷' : '☁️'}
      <span class="sr-only"> {display.text}</span>
    </span>
  );
}

export default function Header() {
  const matchId = PAGES.find(p => p.href === window.location.pathname)?.id || 'gallery';

  return (
    <div class="shared-header">
      <a href="/" class="shared-title">Visual Prompt Explorer</a>
      <nav class="shared-tabs" aria-label="Main navigation">
        {PAGES.map(page => (
          <a
            key={page.id}
            class={`shared-tab ${page.id === matchId ? 'active' : ''}`}
            href={page.href}
          >
            {page.label}
          </a>
        ))}
        <ConnectionIndicator />
      </nav>
    </div>
  );
}