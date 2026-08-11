import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.shuhai.reader',
  appName: '书海',
  webDir: 'dist',
  android: {
    backgroundColor: '#0d1117',
    allowMixedContent: false,
  },
}

export default config
