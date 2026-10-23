const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// Desabilitar aceleração de hardware se causar problemas
// app.disableHardwareAcceleration();

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '../public/icons/icon-512x512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    title: 'WMS Casa Meta',
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0f172a'
  });

  // Mostrar janela quando estiver pronta
  win.once('ready-to-show', () => {
    win.show();
  });

  // Carregar o build do React
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Abrir links externos no navegador padrão
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Remover menu em produção
  if (process.env.NODE_ENV === 'production') {
    Menu.setApplicationMenu(null);
  } else {
    // Menu simplificado para desenvolvimento
    const template = [
      {
        label: 'Arquivo',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'Editar',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' }
        ]
      },
      {
        label: 'Visualizar',
        submenu: [
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Ajuda',
        submenu: [
          {
            label: 'Documentação',
            click: async () => {
              await shell.openExternal('https://github.com/seu-usuario/wms-casa-meta');
            }
          }
        ]
      }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
}

// Aguardar app estar pronto
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Fechar app quando todas as janelas forem fechadas (exceto no macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Segurança: Prevenir criação de novas janelas
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', async (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Permitir apenas navegação para domínios confiáveis
    const allowedOrigins = ['localhost', '127.0.0.1', '*.supabase.co'];
    
    if (!allowedOrigins.some(origin => parsedUrl.hostname.endsWith(origin.replace('*.', '')))) {
      event.preventDefault();
      await shell.openExternal(navigationUrl);
    }
  });
});
