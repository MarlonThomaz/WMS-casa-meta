# 📦 Guia de Instalação Multiplataforma - WMS Casa Meta

Este guia explica como instalar e executar o WMS Casa Meta em **Windows**, **Android** e **iOS**.

## 🎯 Opções de Instalação

### Opção 1: PWA (Progressive Web App) - RECOMENDADO ✅
**Funciona em:** Windows, Android, iOS, qualquer dispositivo com navegador moderno
**Vantagens:** Instalação instantânea, sempre atualizado, não precisa de loja
**Desvantagens:** Requer navegador (Chrome, Edge, Safari)

### Opção 2: Aplicativo Nativo Mobile (Android/iOS)
**Funciona em:** Android (APK) e iOS (IPA)
**Vantagens:** Experiência nativa, funciona offline
**Desvantagens:** Requer build com Capacitor

### Opção 3: Aplicativo Desktop Windows (.exe)
**Funciona em:** Windows 10/11
**Vantagens:** Aplicativo standalone, não precisa de navegador
**Desvantagens:** Apenas Windows, requer build com Electron

---

## 🚀 Opção 1: Instalar como PWA (Recomendado)

### No Windows (Chrome/Edge)

1. **Abra o aplicativo no navegador:**
   - Acesse: `https://seu-dominio.com` (após deploy)
   - Ou localmente: `http://localhost:3000`

2. **Instale o PWA:**
   - **Chrome:** Clique no ícone de instalação na barra de endereço ou menu ⋮ → "Instalar WMS Casa Meta"
   - **Edge:** Clique no ícone de instalação ou menu ⋯ → "Aplicativos" → "Instalar este site como aplicativo"

3. **Confirme a instalação:**
   - Clique em "Instalar"
   - O app será instalado e aparecerá no Menu Iniciar

4. **Use o aplicativo:**
   - Abra pelo Menu Iniciar → "WMS Casa Meta"
   - Funciona como aplicativo nativo!

### No Android (Chrome)

1. **Abra o Chrome e acesse o app:**
   - URL: `https://seu-dominio.com`

2. **Toque no menu (⋮) → "Adicionar à tela inicial"**

3. **Confirme:**
   - Toque em "Adicionar"
   - O ícone aparecerá na tela inicial

4. **Abra o app:**
   - Toque no ícone "WMS Casa Meta"
   - Abre em tela cheia, como app nativo!

### No iOS (Safari)

1. **Abra o Safari e acesse o app:**
   - URL: `https://seu-dominio.com`
   - ⚠️ **Importante:** Use Safari, não Chrome!

2. **Toque no botão Compartilhar (quadrado com seta)**

3. **Role para baixo e toque em "Adicionar à Tela de Início"**

4. **Confirme:**
   - Toque em "Adicionar"
   - O ícone aparecerá na tela inicial

5. **Abra o app:**
   - Toque no ícone "WMS Casa Meta"
   - Abre em tela cheia!

---

## 📱 Opção 2: Build para Android/iOS (Capacitor)

### Pré-requisitos

- Node.js 18+ instalado
- Android Studio (para Android)
- Xcode (para iOS - apenas Mac)
- Conta de desenvolvedor Apple ($99/ano) para publicar na App Store

### Passo 1: Instalar dependências do Capacitor

```bash
npm install
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios
```

### Passo 2: Inicializar Capacitor

```bash
npx cap init "WMS Casa Meta" "com.casameta.wms" --web-dir=dist
```

### Passo 3: Build do projeto

```bash
npm run build
```

### Passo 4: Adicionar plataformas

```bash
# Para Android
npx cap add android

# Para iOS (apenas Mac)
npx cap add ios
```

### Passo 5: Copiar arquivos para as plataformas

```bash
npx cap sync
```

### Passo 6: Abrir no IDE

**Android:**
```bash
npx cap open android
```
- No Android Studio: Build → Generate Signed Bundle/APK
- Selecione "APK" e configure a assinatura
- APK será gerado em: `android/app/build/outputs/apk/release/`

**iOS (apenas Mac):**
```bash
npx cap open ios
```
- No Xcode: Configure a assinatura e provisioning profile
- Product → Archive → Distribute App

### Passo 7: Instalar no dispositivo

**Android:**
- Transfira o APK para o dispositivo
- Habilite "Instalar de fontes desconhecidas" nas configurações
- Toque no APK para instalar

**iOS:**
- Use TestFlight para distribuição interna
- Ou publique na App Store

---

## 💻 Opção 3: Build para Windows (.exe com Electron)

### Pré-requisitos

- Node.js 18+ instalado
- Windows 10/11

### Passo 1: Instalar Electron

```bash
npm install
npm install --save-dev electron electron-builder
```

### Passo 2: Criar arquivo main.js do Electron

Crie `electron/main.js`:

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '../public/icons/icon-512x512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'WMS Casa Meta',
    autoHideMenuBar: true
  });

  // Carregar o build do React
  win.loadFile(path.join(__dirname, '../dist/index.html'));

  // Remover menu em produção
  if (process.env.NODE_ENV === 'production') {
    win.setMenuBarVisibility(false);
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

### Passo 3: Configurar package.json para Electron

Adicione ao `package.json`:

```json
{
  "main": "electron/main.js",
  "scripts": {
    "electron:dev": "npm run build && electron .",
    "electron:build": "npm run build && electron-builder build --win",
    "electron:build:portable": "npm run build && electron-builder build --win portable"
  },
  "build": {
    "appId": "com.casameta.wms",
    "productName": "WMS Casa Meta",
    "directories": {
      "output": "release"
    },
    "win": {
      "target": ["nsis", "portable"],
      "icon": "public/icons/icon-512x512.png"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

### Passo 4: Build do executável

**Instalador (.exe):**
```bash
npm run electron:build
```

**Versão portátil (sem instalação):**
```bash
npm run electron:build:portable
```

O executável será gerado em: `release/`

### Passo 5: Instalar no Windows

- **Instalador:** Execute `WMS Casa Meta Setup X.X.X.exe`
- **Portátil:** Execute `WMS Casa Meta X.X.X.exe` diretamente

---

## 🌐 Deploy para Produção (PWA)

### Opção A: Vercel (Grátis e Fácil)

1. **Instale Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   npm run build
   vercel --prod
   ```

3. **Configure o domínio:**
   - No painel da Vercel, adicione seu domínio
   - SSL é configurado automaticamente

### Opção B: Netlify (Grátis)

1. **Instale Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy:**
   ```bash
   npm run build
   netlify deploy --prod --dir=dist
   ```

### Opção C: Servidor Próprio (Nginx)

1. **Build do projeto:**
   ```bash
   npm run build
   ```

2. **Copie a pasta `dist/` para o servidor**

3. **Configure Nginx:**
   ```nginx
   server {
       listen 80;
       server_name seu-dominio.com;
       root /var/www/wms/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # Cache para assets estáticos
       location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
           expires 1y;
           add_header Cache-Control "public, immutable";
       }

       # Service Worker não deve ser cacheado
       location /sw.js {
           add_header Cache-Control "no-cache";
       }
   }
   ```

4. **Configure HTTPS (Let's Encrypt):**
   ```bash
   sudo certbot --nginx -d seu-dominio.com
   ```

---

## 🔧 Gerar Ícones em Múltiplos Tamanhos

### Script para gerar ícones

Crie `scripts/generate-icons.js`:

```javascript
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const sourceIcon = path.join(__dirname, '../public/icons/icon-source.png');
const outputDir = path.join(__dirname, '../public/icons');

async function generateIcons() {
  // Criar diretório se não existir
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const size of sizes) {
    await sharp(sourceIcon)
      .resize(size, size)
      .toFile(path.join(outputDir, `icon-${size}x${size}.png`));
    
    console.log(`✓ Gerado: icon-${size}x${size}.png`);
  }

  console.log('\n✅ Todos os ícones foram gerados com sucesso!');
}

generateIcons().catch(console.error);
```

### Executar o script

```bash
# Instale sharp
npm install --save-dev sharp

# Coloque sua imagem fonte em public/icons/icon-source.png
# Execute o script
node scripts/generate-icons.js
```

---

## 📋 Checklist de Instalação

### PWA (Todos os dispositivos)
- [ ] Build do projeto (`npm run build`)
- [ ] Deploy para servidor com HTTPS
- [ ] Testar instalação no Windows (Chrome/Edge)
- [ ] Testar instalação no Android (Chrome)
- [ ] Testar instalação no iOS (Safari)
- [ ] Verificar funcionamento offline

### Android Nativo
- [ ] Instalar Android Studio
- [ ] Configurar Capacitor (`npx cap add android`)
- [ ] Build do APK (`npx cap open android`)
- [ ] Testar em dispositivo físico
- [ ] Assinar APK para distribuição

### iOS Nativo (apenas Mac)
- [ ] Instalar Xcode
- [ ] Configurar Capacitor (`npx cap add ios`)
- [ ] Build do IPA (`npx cap open ios`)
- [ ] Configurar provisioning profile
- [ ] Testar em dispositivo físico
- [ ] Publicar na App Store (opcional)

### Windows Desktop
- [ ] Instalar Electron
- [ ] Configurar `electron/main.js`
- [ ] Build do executável (`npm run electron:build`)
- [ ] Testar instalador
- [ ] Testar versão portátil

---

## 🐛 Solução de Problemas

### PWA não instala
- **Solução:** Verifique se está usando HTTPS
- **Solução:** Limpe o cache do navegador
- **Solução:** Verifique se o `manifest.json` está acessível

### Scanner de código de barras não funciona no mobile
- **Solução:** Permita acesso à câmera no navegador
- **Solução:** Use HTTPS (obrigatório para câmera)
- **Solução:** No iOS, use Safari (Chrome não suporta câmera)

### App não funciona offline
- **Solução:** Verifique se o Service Worker está registrado
- **Solução:** Abra DevTools → Application → Service Workers
- **Solução:** Force update do Service Worker

### Build do Android falha
- **Solução:** Verifique se o Android Studio está instalado
- **Solução:** Configure as variáveis de ambiente (ANDROID_HOME)
- **Solução:** Aceite as licenças do SDK: `sdkmanager --licenses`

### Build do iOS falha (Mac)
- **Solução:** Verifique se o Xcode está instalado
- **Solução:** Configure o provisioning profile
- **Solução:** Aceite os termos do Xcode

### Build do Electron falha
- **Solução:** Verifique se o `electron/main.js` existe
- **Solução:** Execute `npm run build` antes do build do Electron
- **Solução:** Verifique permissões de escrita na pasta `release/`

---

## 📞 Suporte

- **Documentação:** Consulte os arquivos `ETAPA*.md`
- **Problemas técnicos:** Verifique o console do navegador (F12)
- **Deploy:** Consulte a documentação do Vercel/Netlify
- **Capacitor:** https://capacitorjs.com/docs
- **Electron:** https://www.electronjs.org/docs

---

## 🎉 Pronto!

Seu WMS Casa Meta está pronto para ser instalado em:
- ✅ **Windows** (PWA, Electron)
- ✅ **Android** (PWA, APK nativo)
- ✅ **iOS** (PWA, IPA nativo)

**Recomendação:** Comece com PWA (mais simples) e evolua para apps nativos conforme necessidade.
