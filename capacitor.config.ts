import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'it.informatixrepair.app',
  appName: 'Informatix Repair',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
