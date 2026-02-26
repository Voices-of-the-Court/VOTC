# Voices of the Court 2.0

A modern reimplementation of the Voices of the Court mod for Crusader Kings III, providing an enhanced AI-powered conversational experience with your characters.

## Features

- **AI-Powered Conversations**: Engage in dynamic conversations with characters using various LLM providers
- **Multiple LLM Support**: Compatible with OpenAI, OpenRouter, Ollama, and other OpenAI-compatible providers
- **Action System**: Characters can perform in-game actions based on conversation context
- **Rich Character Data**: Access detailed character information including traits, memories, relationships, and more
- **Custom Actions**: Extensible action system for modders to create custom character behaviors

## Installation

1. Download the latest release from the [Releases](https://github.com/Voices-of-the-Court/VOTC/releases) page
2. Run the installer
3. Launch the application (please, wait for some time for initialization)
4. Press `Ctrl+Shift+H` or click right mouse button on tray icon to open configuration menu.

## Configuration

### LLM Provider Setup

The application supports these LLM providers:
- **OpenAI**: Requires API key from OpenAI (use via Custom OpenAI-Compatible provider)
- **OpenRouter**: Requires API key from OpenRouter
- **Player2**: Requires installation of local app
- **Deepseek**: Requires API key from Deepseek
- **Ollama**: Local LLM server (untested for long time, might now work, report)
- **Custom OpenAI-Compatible**: Any OpenAI-compatible API endpoint, requires base URL and API key

Configure your provider in the Settings panel within the application.

## Development

### Prerequisites

- Node.js 18 or higher
- npm

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Create distributable package
npm run build:win
```

### Project Structure

- `src/main/` - Electron main process code
  - `actions/` - Action system and definitions
  - `conversation/` - Conversation management
  - `gameData/` - CK3 game data parsing
  - `llmProviders/` - LLM provider implementations
- `src/renderer/` - React-based UI
- `src/preload/` - Electron preload scripts

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
