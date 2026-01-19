# reVOTC - Reimagined Voices of the Court

A modern reimplementation of the Voices of the Court mod for Crusader Kings III, providing an enhanced AI-powered conversational experience with your characters.

## Features

- **AI-Powered Conversations**: Engage in dynamic conversations with characters using various LLM providers
- **Multiple LLM Support**: Compatible with OpenAI, OpenRouter, Ollama, and other OpenAI-compatible providers
- **Action System**: Characters can perform in-game actions based on conversation context
- **Rich Character Data**: Access detailed character information including traits, memories, relationships, and more
- **Custom Actions**: Extensible action system for modders to create custom character behaviors

## Installation

1. Download the latest release from the [Releases](https://github.com/MrAndroPC/reVOTC/releases) page
2. Run the installer (`re-voices-of-the-court-1.0.0-setup.exe` for Windows)
3. Launch the application and configure your LLM provider settings

## Configuration

### LLM Provider Setup

The application supports multiple LLM providers:

- **OpenAI**: Requires API key from OpenAI
- **OpenRouter**: Requires API key from OpenRouter
- **Ollama**: Local LLM server (no API key required)
- **Custom OpenAI-Compatible**: Any OpenAI-compatible API endpoint

Configure your provider in the Settings panel within the application.

## Development

### Prerequisites

- Node.js 18 or higher
- npm or pnpm

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

## Acknowledgments

Based on the original Voices of the Court mod for Crusader Kings III.