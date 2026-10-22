import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Importar todos os arquivos como strings usando ?raw do Vite
import indexHtml from '../index.html?raw';
import packageJson from '../package.json?raw';
import tsconfigJson from '../tsconfig.json?raw';
import viteConfigJs from '../vite.config.js?raw';

import srcMainTsx from './main.tsx?raw';
import srcAppTsx from './App.tsx?raw';
import srcIndexCss from './index.css?raw';
import srcTypesTs from './types.ts?raw';
import srcDataTs from './data.ts?raw';

import srcComponentsSidebar from './components/Sidebar.tsx?raw';
import srcComponentsDashboard from './components/Dashboard.tsx?raw';
import srcComponentsInventory from './components/Inventory.tsx?raw';
import srcComponentsLocations from './components/Locations.tsx?raw';
import srcComponentsReceiving from './components/Receiving.tsx?raw';
import srcComponentsShipping from './components/Shipping.tsx?raw';
import srcComponentsMovements from './components/Movements.tsx?raw';
import srcComponentsBarcodeScanner from './components/BarcodeScanner.tsx?raw';
import srcComponentsBarcodeKit from './components/BarcodeKit.tsx?raw';
import srcDownloadProject from './downloadProject.ts?raw';
import srcViteEnvDts from './vite-env.d.ts?raw';

const files: Record<string, string> = {
  'index.html': indexHtml,
  'package.json': packageJson,
  'tsconfig.json': tsconfigJson,
  'vite.config.js': viteConfigJs,
  'src/main.tsx': srcMainTsx,
  'src/App.tsx': srcAppTsx,
  'src/index.css': srcIndexCss,
  'src/types.ts': srcTypesTs,
  'src/data.ts': srcDataTs,
  'src/components/Sidebar.tsx': srcComponentsSidebar,
  'src/components/Dashboard.tsx': srcComponentsDashboard,
  'src/components/Inventory.tsx': srcComponentsInventory,
  'src/components/Locations.tsx': srcComponentsLocations,
  'src/components/Receiving.tsx': srcComponentsReceiving,
  'src/components/Shipping.tsx': srcComponentsShipping,
  'src/components/Movements.tsx': srcComponentsMovements,
  'src/components/BarcodeScanner.tsx': srcComponentsBarcodeScanner,
  'src/components/BarcodeKit.tsx': srcComponentsBarcodeKit,
  'src/downloadProject.ts': srcDownloadProject,
  'src/vite-env.d.ts': srcViteEnvDts,
};

export async function downloadProjectZip() {
  const zip = new JSZip();

  // Adicionar todos os arquivos ao ZIP
  Object.entries(files).forEach(([path, content]) => {
    zip.file(path, content);
  });

  // Adicionar um README
  const readme = `# WMS - Warehouse Management System

## Descrição
Sistema de gerenciamento de armazém (WMS) desenvolvido com React, TypeScript, Tailwind CSS e Vite.

## Funcionalidades
- **Dashboard**: Visão geral com KPIs, gráficos de movimentações e alertas de estoque baixo
- **Inventário**: Gestão completa de produtos com CRUD, filtros e busca
- **Localizações**: Mapa visual do armazém com zonas, corredores e níveis
- **Recebimento**: Ordens de recebimento com conferência e status
- **Expedição**: Ordens de expedição com fluxo de separação/embalagem/despacho
- **Movimentações**: Histórico de todas as movimentações do armazém
- **Kit Código de Barras**: Leitor via câmera para cadastro de SKUs, transferência de itens e localização de estoque

## Como executar

\`\`\`bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Build para produção
npm run build
\`\`\`

## Tecnologias
- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4
- Recharts (gráficos)
- Lucide React (ícones)
- JSZip (exportação)
- html5-qrcode (leitor de código de barras)

## Estrutura do Projeto
\`\`\`
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.js
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── types.ts
    ├── data.ts
    ├── downloadProject.ts
    ├── vite-env.d.ts
    └── components/
        ├── Sidebar.tsx
        ├── Dashboard.tsx
        ├── Inventory.tsx
        ├── Locations.tsx
        ├── Receiving.tsx
        ├── Shipping.tsx
        ├── Movements.tsx
        ├── BarcodeScanner.tsx
        └── BarcodeKit.tsx
\`\`\`

---
Gerado automatic pelo WMS Pro
`;

  zip.file('README.md', readme);

  // Gerar o ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  
  // Fazer download
  saveAs(blob, 'wms-projeto.zip');
}
