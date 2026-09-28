import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './tokens.css';
import './styles.css';
import './design-system.css';
import App from './App';
import { ContentContextMenu } from './features/shared/ContentContextMenu';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ContentContextMenu />
  </StrictMode>,
);
