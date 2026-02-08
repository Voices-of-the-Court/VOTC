import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './app.scss'; // Import existing CSS
import './i18n'; // Import i18n configuration

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Could not find root element to mount React app.");
}

console.log('👋 React renderer loaded.');
