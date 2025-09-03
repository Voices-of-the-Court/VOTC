import React, { useState, useCallback } from 'react';
import Chat from './chat/Chat';
import ConfigPanel from './config/ConfigPanel';

function App() {
  const [showConfig, setShowConfig] = useState(false);

  const toggleConfig = useCallback(() => {
    setShowConfig(prev => !prev);
  }, []);

  return (
    <div className="App">
      <Chat onToggleConfig={toggleConfig} />
      {showConfig && (
        <ConfigPanel
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
};

export default App;
