import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
// WebpackPlugin import removed
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

// Webpack config imports removed

const config: ForgeConfig = {
  packagerConfig: {
    // asar: true,
    // The 'main' field in package.json will point to Vite's main process output.
    // Electron Forge will use that. HTML loading will be handled in src/main/main.ts
    // based on Vite's dev server or production build paths.
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({}), new MakerZIP({}, ['darwin']), new MakerRpm({}), new MakerDeb({})],
  plugins: [
    // new AutoUnpackNativesPlugin({}),
    // WebpackPlugin configuration removed.
    // Vite will handle the build process. Electron Forge will package the output.
    // The main process (src/main/main.ts) will be responsible for loading the
    // correct HTML files from Vite's output (dist/renderer/chat.html, etc.)
    // or from the Vite dev server.
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      // [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      // [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
