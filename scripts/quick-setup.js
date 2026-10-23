#!/usr/bin/env node

/**
 * Script de Instalação Rápida - WMS Casa Meta
 * 
 * Este script automatiza a configuração inicial do projeto:
 * - Instala dependências
 * - Configura variáveis de ambiente
 * - Gera ícones
 * - Configura PWA
 * - Instala Capacitor e Electron
 * 
 * Uso: node scripts/quick-setup.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

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

async function main() {
  log('\n🚀 WMS Casa Meta - Instalação Rápida\n', colors.cyan);
  
  // 1. Instalar dependências
  log('📦 Passo 1/6: Instalando dependências...', colors.yellow);
  execSync('npm install', { stdio: 'inherit' });
  log('✅ Dependências instaladas\n', colors.green);

  // 2. Configurar variáveis de ambiente
  log('🔧 Passo 2/6: Configurando variáveis de ambiente...', colors.yellow);
  
  if (!fs.existsSync('.env')) {
    const supabaseUrl = await question('URL do seu projeto Supabase (ou pressione Enter para pular): ');
    const supabaseKey = await question('Chave anon do Supabase (ou pressione Enter para pular): ');
    
    if (supabaseUrl && supabaseKey) {
      const envContent = `VITE_SUPABASE_URL=${supabaseUrl}\nVITE_SUPABASE_ANON_KEY=${supabaseKey}\n`;
      fs.writeFileSync('.env', envContent);
      log('✅ Arquivo .env criado\n', colors.green);
    } else {
      log('⚠️  Configuração do Supabase pulada. Você pode configurar depois no arquivo .env\n', colors.yellow);
    }
  } else {
    log('✅ Arquivo .env já existe\n', colors.green);
  }

  // 3. Instalar Capacitor
  log('📱 Passo 3/6: Instalando Capacitor (para apps mobile)...', colors.yellow);
  const installCapacitor = await question('Deseja instalar Capacitor para Android/iOS? (s/n): ');
  
  if (installCapacitor.toLowerCase() === 's') {
    execSync('npm install @capacitor/core @capacitor/cli', { stdio: 'inherit' });
    log('✅ Capacitor instalado\n', colors.green);
    
    // Inicializar Capacitor
    const appId = await question('ID do aplicativo (ex: com.casameta.wms): ') || 'com.casameta.wms';
    const appName = await question('Nome do aplicativo: ') || 'WMS Casa Meta';
    
    try {
      execSync(`npx cap init "${appName}" "${appId}" --web-dir=dist`, { stdio: 'inherit' });
      log('✅ Capacitor inicializado\n', colors.green);
    } catch (error) {
      log('⚠️  Erro ao inicializar Capacitor. Você pode fazer isso manualmente depois.\n', colors.yellow);
    }
  } else {
    log('⚠️  Capacitor não instalado\n', colors.yellow);
  }

  // 4. Instalar Electron
  log('💻 Passo 4/6: Instalando Electron (para app Windows)...', colors.yellow);
  const installElectron = await question('Deseja instalar Electron para Windows? (s/n): ');
  
  if (installElectron.toLowerCase() === 's') {
    execSync('npm install --save-dev electron electron-builder', { stdio: 'inherit' });
    log('✅ Electron instalado\n', colors.green);
  } else {
    log('⚠️  Electron não instalado\n', colors.yellow);
  }

  // 5. Gerar ícones
  log('🎨 Passo 5/6: Gerando ícones...', colors.yellow);
  
  if (fs.existsSync('public/icons/icon-source.png')) {
    const generateIcons = await question('Deseja gerar ícones em múltiplos tamanhos? (s/n): ');
    
    if (generateIcons.toLowerCase() === 's') {
      try {
        execSync('npm install --save-dev sharp', { stdio: 'inherit' });
        execSync('node scripts/generate-icons.js', { stdio: 'inherit' });
        log('✅ Ícones gerados\n', colors.green);
      } catch (error) {
        log('⚠️  Erro ao gerar ícones. Você pode fazer isso manualmente depois.\n', colors.yellow);
      }
    }
  } else {
    log('⚠️  Ícone fonte não encontrado em public/icons/icon-source.png\n', colors.yellow);
    log('💡 Coloque um ícone PNG 1024x1024 e execute: node scripts/generate-icons.js\n', colors.blue);
  }

  // 6. Build inicial
  log('🔨 Passo 6/6: Build inicial...', colors.yellow);
  const doBuild = await question('Deseja fazer o build agora? (s/n): ');
  
  if (doBuild.toLowerCase() === 's') {
    execSync('npm run build', { stdio: 'inherit' });
    log('✅ Build concluído\n', colors.green);
  }

  // Resumo
  log('\n' + '='.repeat(60), colors.cyan);
  log('✅ INSTALAÇÃO CONCLUÍDA!', colors.green);
  log('='.repeat(60), colors.cyan);
  
  log('\n📚 Próximos passos:', colors.blue);
  log('1. Configure o Supabase (se ainda não configurou)', colors.blue);
  log('2. Execute as migrations no Supabase SQL Editor', colors.blue);
  log('3. Crie um usuário administrador', colors.blue);
  log('4. Execute: npm run dev', colors.blue);
  log('5. Acesse: http://localhost:3000', colors.blue);
  
  log('\n📖 Documentação:', colors.blue);
  log('- INSTALL_GUIDE.md: Guia completo de instalação', colors.blue);
  log('- SETUP_GUIDE.md: Configuração do Supabase', colors.blue);
  log('- README_DISTRIBUICAO.md: Guia de distribuição', colors.blue);
  
  log('\n🚀 Comandos úteis:', colors.blue);
  log('- npm run dev: Iniciar servidor de desenvolvimento', colors.blue);
  log('- npm run build: Build para produção', colors.blue);
  log('- npm run electron:dev: Testar app Windows', colors.blue);
  log('- npm run electron:build: Gerar executável Windows', colors.blue);
  log('- npx cap add android: Adicionar plataforma Android', colors.blue);
  log('- npx cap add ios: Adicionar plataforma iOS (apenas Mac)', colors.blue);
  
  log('\n🎉 Pronto para usar!\n', colors.green);
  
  rl.close();
}

main().catch((error) => {
  log(`\n❌ Erro: ${error.message}`, colors.red);
  rl.close();
  process.exit(1);
});
