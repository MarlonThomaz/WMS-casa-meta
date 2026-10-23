# 🎯 Criando Executáveis - WMS Casa Meta

Este guia explica como criar executáveis para **Windows (.exe)**, **Android (APK)** e **iOS (IPA)**.

---

## 📋 Pré-requisitos

### Para Todos
- ✅ Node.js 18+ instalado
- ✅ Projeto configurado (execute `node scripts/quick-setup.js`)
- ✅ Build do React funcionando (`npm run build`)

### Para Windows (.exe)
- ✅ Windows 10/11
- ✅ Electron instalado (`npm install --save-dev electron electron-builder`)

### Para Android (APK)
- ✅ Android Studio instalado
- ✅ SDK Android configurado
- ✅ Variável de ambiente `ANDROID_HOME` configurada

### Para iOS (IPA)
- ✅ macOS
- ✅ Xcode instalado
- ✅ Conta de desenvolvedor Apple ($99/ano) para App Store

---

## 🚀 Método Rápido (Recomendado)

Use o script automatizado:

```bash
node scripts/build-all.js
```

Este script vai:
1. ✅ Verificar dependências
2. ✅ Fazer build do React
3. ✅ Configurar PWA
4. ✅ Gerar executável Windows
5. ✅ Configurar Android
6. ✅ Configurar iOS (apenas Mac)

### Build para plataforma específica:

```bash
# Apenas PWA
node scripts/build-all.js pwa

# Apenas Windows
node scripts/build-all.js windows

# Apenas Android
node scripts/build-all.js android

# Apenas iOS (apenas Mac)
node scripts/build-all.js ios
```

---

## 💻 Criando Executável Windows (.exe)

### Passo 1: Instalar Electron

```bash
npm install --save-dev electron electron-builder
```

### Passo 2: Verificar arquivo electron/main.js

O arquivo já foi criado em `electron/main.js`. Verifique se existe.

### Passo 3: Adicionar scripts ao package.json

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

### Passo 4: Gerar executável

**Instalador (.exe):**
```bash
npm run electron:build
```

**Versão portátil (sem instalação):**
```bash
npm run electron:build:portable
```

### Passo 5: Localizar executável

Os arquivos serão gerados em: `release/`

- `WMS Casa Meta Setup 1.0.0.exe` - Instalador
- `WMS Casa Meta 1.0.0.exe` - Versão portátil

### Passo 6: Testar

- **Instalador:** Execute e siga as instruções
- **Portátil:** Execute diretamente (pode rodar de pendrive)

---

## 📱 Criando APK Android

### Passo 1: Instalar Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### Passo 2: Inicializar Capacitor

```bash
npx cap init "WMS Casa Meta" "com.casameta.wms" --web-dir=dist
```

### Passo 3: Build do React

```bash
npm run build
```

### Passo 4: Adicionar plataforma Android

```bash
npx cap add android
```

### Passo 5: Sincronizar arquivos

```bash
npx cap sync android
```

### Passo 6: Abrir no Android Studio

```bash
npx cap open android
```

### Passo 7: Gerar APK no Android Studio

1. No Android Studio, aguarde o projeto carregar
2. Vá em: **Build → Generate Signed Bundle / APK**
3. Selecione **"APK"** e clique em **Next**
4. Crie uma nova keystore ou use uma existente:
   - **Key store path:** Escolha um local para salvar
   - **Password:** Crie uma senha forte
   - **Alias:** Crie um alias (ex: wms-casa-meta)
   - **Password:** Crie uma senha para o alias
5. Clique em **Next**
6. Selecione **"release"**
7. Marque **"V1 (Jar Signature)"**
8. Clique em **Finish**
9. Aguarde o build

### Passo 8: Localizar APK

O APK será gerado em:
```
android/app/build/outputs/apk/release/app-release.apk
```

### Passo 9: Instalar no dispositivo

1. Transfira o APK para o dispositivo Android
2. Habilite "Instalar de fontes desconhecidas" nas configurações
3. Toque no APK para instalar
4. Pronto!

---

## 🍎 Criando IPA iOS (apenas Mac)

### Passo 1: Instalar Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
```

### Passo 2: Inicializar Capacitor

```bash
npx cap init "WMS Casa Meta" "com.casameta.wms" --web-dir=dist
```

### Passo 3: Build do React

```bash
npm run build
```

### Passo 4: Adicionar plataforma iOS

```bash
npx cap add ios
```

### Passo 5: Sincronizar arquivos

```bash
npx cap sync ios
```

### Passo 6: Abrir no Xcode

```bash
npx cap open ios
```

### Passo 7: Configurar assinatura no Xcode

1. No Xcode, selecione o projeto na sidebar
2. Selecione o target "App"
3. Vá na aba **"Signing & Capabilities"**
4. Marque **"Automatically manage signing"**
5. Selecione sua **Team** (conta de desenvolvedor Apple)
6. Verifique se o **Bundle Identifier** está correto: `com.casameta.wms`

### Passo 8: Configurar Provisioning Profile

**Para teste em dispositivo:**
1. Conecte seu iPhone/iPad via USB
2. Selecione o dispositivo no Xcode
3. Xcode vai criar automaticamente o provisioning profile

**Para App Store:**
1. Acesse: https://developer.apple.com/account
2. Vá em: **Certificates, Identifiers & Profiles**
3. Crie um **App ID** com o Bundle Identifier
4. Crie um **Provisioning Profile** para distribuição
5. Baixe e instale o perfil

### Passo 9: Build para App Store

1. No Xcode, selecione **"Any iOS Device (arm64)"**
2. Vá em: **Product → Archive**
3. Aguarde o build (pode demorar alguns minutos)
4. Quando terminar, o **Organizer** vai abrir
5. Selecione o build e clique em **"Distribute App"**
6. Escolha o método de distribuição:
   - **App Store Connect:** Para publicar na App Store
   - **Ad Hoc:** Para distribuição limitada
   - **Enterprise:** Para distribuição empresarial
   - **Development:** Para teste em dispositivo

### Passo 10: Publicar na App Store (opcional)

1. Selecione **"App Store Connect"**
2. Faça login com sua conta Apple
3. Preencha as informações do app:
   - Nome
   - Descrição
   - Screenshots
   - Categoria
   - Preço
4. Clique em **"Upload"**
5. Aguarde o processamento (pode levar 10-30 minutos)
6. Envie para revisão

### Passo 11: Instalar via TestFlight (para teste)

1. No App Store Connect, vá em **TestFlight**
2. Adicione testers internos (até 100)
3. Envie o convite por email
4. Testers instalam o app TestFlight
5. Aceitam o convite e instalam o app

---

## 🌐 Publicando PWA

### Opção 1: Vercel (Grátis e Fácil)

```bash
# Instalar Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
npm run build
vercel --prod
```

### Opção 2: Netlify (Grátis)

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
npm run build
netlify deploy --prod --dir=dist
```

### Opção 3: Servidor Próprio

1. Build do projeto: `npm run build`
2. Copie a pasta `dist/` para o servidor
3. Configure Nginx/Apache para servir arquivos estáticos
4. Configure HTTPS (obrigatório para PWA)

---

## 📦 Distribuindo os Apps

### Windows (.exe)

**Opções de distribuição:**
- **Site próprio:** Hospede o instalador no seu site
- **GitHub Releases:** Publique no GitHub
- **Email/USB:** Envie diretamente para usuários

**Assinatura digital (recomendado):**
- Evita avisos de segurança do Windows
- Requer certificado de código (custo anual)
- Use: `signtool` ou serviços como DigiCert

### Android (APK)

**Opções de distribuição:**
- **Google Play Store:** Recomenda
  - Custo: $25 (uma vez)
  - Alcance: Milhões de usuários
  - Requer: Conta de desenvolvedor Google
  
- **Site próprio:** Hospede o APK
  - Usuários precisam habilitar "fontes desconhecidas"
  - Menos seguro, mas mais simples

- **Email/USB:** Envie diretamente
  - Bom para testes internos
  - Limitado

### iOS (IPA)

**Opções de distribuição:**
- **App Store:** Recomenda
  - Custo: $99/ano
  - Alcance: Milhões de usuários
  - Requer: Revisão da Apple (1-7 dias)
  
- **TestFlight:** Para testes
  - Até 10.000 testers externos
  - Válido por 90 dias
  - Gratuito com conta de desenvolvedor

- **Enterprise:** Para empresas
  - Custo: $299/ano
  - Distribuição interna apenas
  - Sem revisão da Apple

---

## 🔧 Atualizações

### PWA
- Atualizações automáticas (Service Worker)
- Usuários recebem nova versão ao recarregar
- Não precisa republicar

### Windows (.exe)
- Usuários precisam baixar nova versão
- Considere implementar auto-update (electron-updater)
- Publique nova versão no site/GitHub

### Android (APK)
- **Google Play:** Usuários recebem atualização automática
- **Site próprio:** Usuários precisam baixar novo APK
- Considere implementar auto-update (capacitor-updater)

### iOS (IPA)
- **App Store:** Usuários recebem atualização automática
- **TestFlight:** Testers recebem atualização
- Submeta nova versão para revisão

---

## 🐛 Solução de Problemas

### Windows: "Aplicativo não pode ser executado"
- **Causa:** Executável não assinado
- **Solução:** Assine com certificado digital ou instrua usuários a clicar em "Mais informações" → "Executar mesmo assim"

### Android: "Instalação bloqueada"
- **Causa:** APK não assinado ou fonte desconhecida
- **Solução:** Habilite "Instalar de fontes desconhecidas" ou publique na Google Play

### iOS: "App não pode ser instalado"
- **Causa:** Provisioning profile inválido
- **Solução:** Verifique certificado e provisioning profile no Xcode

### PWA: "Não instala"
- **Causa:** Falta HTTPS ou manifest.json
- **Solução:** Configure HTTPS e verifique manifest.json

---

## 📞 Suporte

- **Documentação:** Consulte `INSTALL_GUIDE.md`
- **Electron:** https://www.electronjs.org/docs
- **Capacitor:** https://capacitorjs.com/docs
- **PWA:** https://web.dev/progressive-web-apps/

---

## ✅ Checklist Final

### Antes de Distribuir

- [ ] Testar em múltiplos dispositivos
- [ ] Verificar funcionamento offline (PWA)
- [ ] Testar scanner de código de barras
- [ ] Verificar performance
- [ ] Assinar executáveis (Windows)
- [ ] Assinar APK (Android)
- [ ] Assinar IPA (iOS)
- [ ] Criar documentação para usuários
- [ ] Configurar suporte técnico
- [ ] Planejar estratégia de atualização

### Após Publicar

- [ ] Monitorar erros e crashes
- [ ] Coletar feedback dos usuários
- [ ] Planejar próximas atualizações
- [ ] Manter documentação atualizada
- [ ] Responder a perguntas e problemas

---

## 🎉 Pronto!

Seu WMS Casa Meta está pronto para ser distribuído em:
- ✅ **Windows** (.exe)
- ✅ **Android** (APK)
- ✅ **iOS** (IPA)
- ✅ **Web** (PWA)

**Boa sorte!** 🚀
