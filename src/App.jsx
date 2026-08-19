import { useEffect } from 'preact/hooks';
import Router, { route } from 'preact-router';
import GalleryPage from './pages/GalleryPage';
import PromptBuilderPage from './pages/PromptBuilderPage';
import AdminPage from './pages/AdminPage';

function RedirectHandler() {
  useEffect(() => {
    const path = window.location.pathname;

    // Handle old HTML page names and style-library redirect
    const pageMap = {
      'prompt-builder.html': '/prompt-builder',
      'style-library.html': '/',
      'admin.html': '/admin',
      'studio.html': '/prompt-builder',
      'prompt-studio.html': '/prompt-builder',
    };

    const filename = path.split('/').pop();
    if (pageMap[filename]) {
      route(pageMap[filename], true);
    }
  }, []);

  return null;
}

export default function App() {
  return (
    <>
      <RedirectHandler />
      <Router>
        <GalleryPage path="/" view="gallery" />
        <GalleryPage path="/index.html" view="gallery" />
        <GalleryPage path="/style-library" view="gallery" />
        <PromptBuilderPage path="/prompt-builder" />
        <AdminPage path="/admin" />
      </Router>
    </>
  );
}
