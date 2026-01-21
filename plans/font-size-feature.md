# Font Size Feature Implementation Plan

## Overview
Add a feature to allow users to change the font size of messages in the chat window through a slider in the Settings panel.

## Implementation Steps

### 1. Update Type Definitions
- Add `messageFontSize?: number` property to the `AppSettings` interface in `src/main/llmProviders/types.ts`
- Set a default value (e.g., 1.1rem which is the current font size)

### 2. Backend Implementation
- Update `SettingsRepository.ts` to handle the new `messageFontSize` setting
- Add methods to save and retrieve the font size setting
- Ensure the setting persists across application restarts

### 3. Frontend Store Updates
- Add `messageFontSize` to the app settings state in `useConfigStore.ts`
- Create a new action `updateMessageFontSize` in the store to update the font size
- Add API call to save the font size setting to the backend

### 4. Settings UI Component
- Add a slider control in `SettingsView.tsx` for adjusting the font size
- Set a reasonable min/max range (e.g., 0.8rem to 2.0rem)
- Add a label showing the current font size value
- Connect the slider to the store action

### 5. Apply Font Size to Messages
- Update the CSS in `app.scss` to use a CSS variable for message font size
- Modify the `MessageItem.tsx` component to apply the font size from settings
- Ensure the font size is applied to all message content

### 6. Preload API Updates
- Add the necessary API methods in `preload.ts` to communicate between renderer and main process
- Expose the font size save/load methods to the renderer process

## Technical Details

### CSS Changes
- Replace the fixed `font-size: 1.1rem` in `.message` class with a CSS variable
- Define the CSS variable at the root level that can be updated dynamically

### State Management
- Use the existing Zustand store pattern for managing the font size setting
- Follow the same pattern as other settings like `globalStreamEnabled`

### Default Values
- Current font size: 1.1rem
- Minimum: 0.8rem
- Maximum: 2.0rem
- Default: 1.1rem

## Files to Modify

1. `src/main/llmProviders/types.ts` - Add font size to AppSettings
2. `src/main/SettingsRepository.ts` - Add font size persistence
3. `src/preload/preload.ts` - Add API methods
4. `src/renderer/config/store/useConfigStore.ts` - Add font size state and actions
5. `src/renderer/config/SettingsView.tsx` - Add slider control
6. `src/renderer/app.scss` - Update CSS to use variable
7. `src/renderer/chat/components/MessageItem.tsx` - Apply font size

## Testing Checklist

- [ ] Font size slider appears in Settings panel
- [ ] Font size changes when moving the slider
- [ ] Font size persists after application restart
- [ ] All message content respects the font size setting
- [ ] Font size is applied to both user and AI messages
- [ ] Minimum and maximum font size limits work correctly
- [ ] Default font size is set correctly on first launch