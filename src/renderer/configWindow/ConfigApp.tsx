import React from 'react';

function ConfigApp() {
  return (
    <div>
      <h1>Configuration Window</h1>
      <p>Settings will go here.</p>
      {/* Example setting */}
      <div>
        <label htmlFor="apiKey">API Key:</label>
        <input type="text" id="apiKey" name="apiKey" />
      </div>
      <button>Save Settings</button>
    </div>
  );
}

export default ConfigApp;
