const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Tamanhos necessários para PWA e apps nativos
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Caminho do ícone fonte (deve ser 1024x1024 ou maior)
const sourceIcon = path.join(__dirname, '../public/icons/icon-source.png');
const outputDir = path.join(__dirname, '../public/icons');

async function generateIcons() {
  console.log('🎨 Gerando ícones para WMS Casa Meta...\n');

  // Verificar se o ícone fonte existe
  if (!fs.existsSync(sourceIcon)) {
    console.error('❌ Erro: Ícone fonte não encontrado em:', sourceIcon);
    console.error('💡 Coloque um ícone PNG de 1024x1024 ou maior em public/icons/icon-source.png');
    process.exit(1);
  }

  // Criar diretório se não existir
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log('📁 Diretório criado:', outputDir);
  }

  // Gerar ícones em todos os tamanhos
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    
    try {
      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 37, g: 99, b: 235, alpha: 0 } // Azul transparente
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Gerado: icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`❌ Erro ao gerar icon-${size}x${size}.png:`, error.message);
    }
  }

  // Gerar ícone para Android (adaptive icon)
  const androidIconPath = path.join(outputDir, 'android-icon.png');
  try {
    await sharp(sourceIcon)
      .resize(432, 432, { fit: 'contain' })
      .png()
      .toFile(androidIconPath);
    console.log('✅ Gerado: android-icon.png (432x432)');
  } catch (error) {
    console.error('❌ Erro ao gerar android-icon.png:', error.message);
  }

  // Gerar ícone para iOS (app store)
  const iosIconPath = path.join(outputDir, 'ios-icon.png');
  try {
    await sharp(sourceIcon)
      .resize(1024, 1024, { fit: 'contain' })
      .png()
      .toFile(iosIconPath);
    console.log('✅ Gerado: ios-icon.png (1024x1024)');
  } catch (error) {
    console.error('❌ Erro ao gerar ios-icon.png:', error.message);
  }

  console.log('\n🎉 Todos os ícones foram gerados com sucesso!');
  console.log('📂 Localização:', outputDir);
}

generateIcons().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
