import React from 'react';
import { createRoot } from 'react-dom/client';
import ConfigApp from './ConfigApp';
import './config.scss'; // Added import for SCSS

const container = document.getElementById('config-root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ConfigApp />
    </React.StrictMode>
  );
} else {
  console.error("Could not find config-root element to mount React app.");
}

console.log('⚙️ Config window renderer loaded.');
