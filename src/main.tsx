/**
 * @file main.tsx
 * @description React application entry point. Mounts the App component into
 *              the #root DOM element and imports global CSS.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
