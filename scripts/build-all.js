#!/usr/bin/env node

/**
 * Script de Build Multiplataforma - WMS Casa Meta
 * 
 * Este script automatiza o build para:
 * - PWA (Progressive Web App)
 * - Windows Desktop (Electron)
 * - Android (Capacitor)
 * - iOS (Capacitor - apenas Mac)
 * 
 * Uso: node scripts/build-all.js [plataforma]
 * 
 * Plataformas:
 * - all: Build para todas as plataformas (padrão)
 * - pwa: Apenas PWA
 * - windows: Apenas Windows (Electron)
 * - android: Apenas Android (Capacitor)
 * - ios: Apenas iOS (Capacitor - apenas Mac)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PLATFORM = process.argv[2] || 'all';

// Cores para output no terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${'='.repeat(60)}`, colors.cyan);
  log(`PASSO ${step}: ${message}`, colors.cyan);
  log('='.repeat(60), colors.cyan);
}

function exec(command, options = {}) {
  try {
    log(`\nExecutando: ${command}`, colors.yellow);
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    log(`Erro ao executar: ${command}`, colors.red);
    return false;
  }
}

function checkDependencies() {
  logStep(0, 'Verificando dependências');
  
  // Verificar Node.js
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    log(`✅ Node.js ${nodeVersion}`, colors.green);
  } catch {
    log('❌ Node.js não encontrado. Instale em: https://nodejs.org', colors.red);
    process.exit(1);
  }

  // Verificar npm
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    log(`✅ npm ${npmVersion}`, colors.green);
  } catch {
    log('❌ npm não encontrado.', colors.red);
    process.exit(1);
  }

  // Verificar dependências do projeto
  if (!fs.existsSync('node_modules')) {
    log('\n📦 Instalando dependências...', colors.yellow);
    exec('npm install');
  } else {
    log('✅ Dependências já instaladas', colors.green);
  }
}

function buildWeb() {
  logStep(1, 'Build do React (Web)');
  
  log('🔨 Compilando aplicação React...', colors.yellow);
  if (!exec('npm run build')) {
    log('❌ Falha no build do React', colors.red);
    process.exit(1);
  }
  
  log('✅ Build do React concluído', colors.green);
  log('📂 Output: dist/', colors.blue);
}

function buildPWA() {
  logStep(2, 'Build PWA (Progressive Web App)');
  
  // Verificar se manifest.json existe
  if (!fs.existsSync('public/manifest.json')) {
    log('❌ manifest.json não encontrado em public/', colors.red);
    return false;
  }

  // Verificar se service worker existe
  if (!fs.existsSync('public/sw.js')) {
    log('❌ sw.js não encontrado em public/', colors.red);
    return false;
  }

  // Verificar ícones
  const iconsDir = 'public/icons';
  if (!fs.existsSync(iconsDir)) {
    log('⚠️  Diretório de ícones não encontrado. Gerando ícones...', colors.yellow);
    exec('node scripts/generate-icons.js');
  }

  log('✅ PWA configurado corretamente', colors.green);
  log('📱 Para instalar:', colors.blue);
  log('   - Windows: Chrome/Edge → Clique em "Instalar"', colors.blue);
  log('   - Android: Chrome → Menu → "Adicionar à tela inicial"', colors.blue);
  log('   - iOS: Safari → Compartilhar → "Adicionar à Tela de Início"', colors.blue);
  
  return true;
}

function buildWindows() {
  logStep(3, 'Build Windows Desktop (Electron)');
  
  // Verificar se electron/main.js existe
  if (!fs.existsSync('electron/main.js')) {
    log('❌ electron/main.js não encontrado', colors.red);
    return false;
  }

  // Verificar se Electron está instalado
  try {
    execSync('npx electron --version', { stdio: 'ignore' });
  } catch {
    log('📦 Instalando Electron...', colors.yellow);
    exec('npm install --save-dev electron electron-builder');
  }

  // Build do instalador
  log('🔨 Gerando executável Windows...', colors.yellow);
  
  // Criar versão instalável
  if (!exec('npm run electron:build')) {
    log('⚠️  Falha ao gerar instalador. Tentando versão portátil...', colors.yellow);
    if (!exec('npm run electron:build:portable')) {
      log('❌ Falha no build do Electron', colors.red);
      return false;
    }
  }

  log('✅ Build Windows concluído', colors.green);
  log('📂 Output: release/', colors.blue);
  
  return true;
}

function buildAndroid() {
  logStep(4, 'Build Android (Capacitor)');
  
  // Verificar se Capacitor está instalado
  try {
    execSync('npx cap --version', { stdio: 'ignore' });
  } catch {
    log('📦 Instalando Capacitor...', colors.yellow);
    exec('npm install @capacitor/core @capacitor/cli @capacitor/android');
  }

  // Verificar se plataforma Android existe
  if (!fs.existsSync('android')) {
    log('📦 Adicionando plataforma Android...', colors.yellow);
    exec('npx cap add android');
  }

  // Sincronizar arquivos
  log('🔄 Sincronizando arquivos...', colors.yellow);
  exec('npx cap sync android');

  log('✅ Build Android concluído', colors.green);
  log('📱 Para gerar APK:', colors.blue);
  log('   1. Execute: npx cap open android', colors.blue);
  log('   2. No Android Studio: Build → Generate Signed Bundle/APK', colors.blue);
  log('   3. Selecione "APK" e configure a assinatura', colors.blue);
  
  return true;
}

function buildIOS() {
  logStep(5, 'Build iOS (Capacitor)');
  
  // Verificar se está no Mac
  if (process.platform !== 'darwin') {
    log('⚠️  Build iOS só pode ser feito no macOS', colors.yellow);
    return false;
  }

  // Verificar se Capacitor está instalado
  try {
    execSync('npx cap --version', { stdio: 'ignore' });
  } catch {
    log('📦 Instalando Capacitor...', colors.yellow);
    exec('npm install @capacitor/core @capacitor/cli @capacitor/ios');
  }

  // Verificar se plataforma iOS existe
  if (!fs.existsSync('ios')) {
    log('📦 Adicionando plataforma iOS...', colors.yellow);
    exec('npx cap add ios');
  }

  // Sincronizar arquivos
  log('🔄 Sincronizando arquivos...', colors.yellow);
  exec('npx cap sync ios');

  log('✅ Build iOS concluído', colors.green);
  log('📱 Para gerar IPA:', colors.blue);
  log('   1. Execute: npx cap open ios', colors.blue);
  log('   2. No Xcode: Configure a assinatura e provisioning profile', colors.blue);
  log('   3. Product → Archive → Distribute App', colors.blue);
  
  return true;
}

function showSummary(results) {
  log('\n' + '='.repeat(60), colors.cyan);
  log('RESUMO DO BUILD', colors.cyan);
  log('='.repeat(60), colors.cyan);
  
  Object.entries(results).forEach(([platform, success]) => {
    const icon = success ? '✅' : '❌';
    const status = success ? 'Sucesso' : 'Falha';
    log(`${icon} ${platform}: ${status}`, success ? colors.green : colors.red);
  });
  
  log('\n' + '='.repeat(60), colors.cyan);
  
  const allSuccess = Object.values(results).every(r => r);
  if (allSuccess) {
    log('\n🎉 Todos os builds foram concluídos com sucesso!', colors.green);
    log('\n📦 Próximos passos:', colors.blue);
    log('   1. Teste cada versão antes de distribuir', colors.blue);
    log('   2. Configure HTTPS para PWA (obrigatório)', colors.blue);
    log('   3. Assine os APKs/IPAs para distribuição', colors.blue);
    log('   4. Consulte INSTALL_GUIDE.md para mais detalhes', colors.blue);
  } else {
    log('\n⚠️  Alguns builds falharam. Verifique os logs acima.', colors.yellow);
  }
}

// Execução principal
async function main() {
  log('\n🚀 WMS Casa Meta - Build Multiplataforma', colors.cyan);
  log(`Plataforma alvo: ${PLATFORM}`, colors.cyan);
  
  const results = {};
  
  checkDependencies();
  buildWeb();
  
  if (PLATFORM === 'all' || PLATFORM === 'pwa') {
    results['PWA'] = buildPWA();
  }
  
  if (PLATFORM === 'all' || PLATFORM === 'windows') {
    results['Windows'] = buildWindows();
  }
  
  if (PLATFORM === 'all' || PLATFORM === 'android') {
    results['Android'] = buildAndroid();
  }
  
  if (PLATFORM === 'all' || PLATFORM === 'ios') {
    results['iOS'] = buildIOS();
  }
  
  showSummary(results);
}

main().catch((error) => {
  log(`\n❌ Erro fatal: ${error.message}`, colors.red);
  process.exit(1);
});
