// Polyfill protection against 'Cannot set property fetch of #<Window> which has only a getter'
(function() {
  try {
    if (typeof window !== 'undefined') {
      const origFetch = window.fetch ? window.fetch.bind(window) : undefined;
      let currentFetch = origFetch;
      try {
        Object.defineProperty(window, 'fetch', {
          get: () => currentFetch,
          set: (fn) => { currentFetch = fn; },
          configurable: true,
          enumerable: true
        });
      } catch {
        // Fallback for Window prototype
        try {
          if (typeof Window !== 'undefined' && Window.prototype) {
            Object.defineProperty(Window.prototype, 'fetch', {
              get: () => currentFetch,
              set: (fn) => { currentFetch = fn; },
              configurable: true,
              enumerable: true
            });
          }
        } catch {}
      }
    }
  } catch {}
})();

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
