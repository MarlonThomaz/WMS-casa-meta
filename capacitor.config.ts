import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.casameta.wms',
  appName: 'WMS Casa Meta',
  webDir: 'dist',
  bundledWebRuntime: false,
  
  // Configurações do servidor (para desenvolvimento)
  server: {
    androidScheme: 'https',
    allowNavigation: ['*.supabase.co']
  },
  
  // Plugins
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#2563eb',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#2563eb'
    }
  },
  
  // Configurações Android
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  
  // Configurações iOS
  ios: {
    scheme: 'WMS Casa Meta',
    allowsLinkPreview: false,
    statusBarOverlaysWebView: false
  }
};

export default config;
