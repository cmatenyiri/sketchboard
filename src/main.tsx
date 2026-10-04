import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/jetbrains-mono';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadFonts } from './scene/text';
import { setState } from './store/store';

// Canvas text measurement needs the real fonts; re-render once they're in.
void loadFonts().then(() => setState((s) => ({ elements: [...s.elements] })));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
