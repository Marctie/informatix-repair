import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'it.informatixrepair.app',
  appName: 'Informatix Repair',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // L'app carica il sito live invece dei file bundlati in dist/,
    // così resta sempre aggiornata senza dover ricompilare l'APK.
    url: 'https://marctie.github.io/informatix-repair/',
  },
};

export default config;
