import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.aryansharma.cards',
  appName: 'cards',
  webDir: 'dist',
  backgroundColor: '#0b0806',
  android: {
    // Plain https://localhost origin: trusted by Neon Auth's localhost allowance.
    allowMixedContent: false,
  },
}

export default config
