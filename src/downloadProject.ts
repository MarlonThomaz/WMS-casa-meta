import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export async function downloadProjectZip() {
  const zip = new JSZip();

  // Adicionar arquivos principais manualmente
  zip.file('README.md', `# WMS - Warehouse Management System

Sistema de gerenciamento de armazém desenvolvido com React, TypeScript, Tailwind CSS e Vite.

## Funcionalidades
- Dashboard com KPIs e gráficos
- Gestão de inventário
- Mapa de localizações
- Recebimento e expedição
- Kit de leitor de código de barras

## Como executar

\`\`\`bash
npm install
npm run dev
\`\`\`
`);

  zip.file('package.json', JSON.stringify({
    name: "wms-projeto",
    private: true,
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview"
    },
    dependencies: {
      "react": "^19.0.0",
      "react-dom": "^19.0.0",
      "lucide-react": "^0.468.0",
      "recharts": "^2.15.0",
      "jszip": "^3.10.1",
      "file-saver": "^2.0.5"
    },
    devDependencies: {
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      "@vitejs/plugin-react": "^4.3.4",
      "typescript": "~5.6.2",
      "vite": "^6.0.0",
      "tailwindcss": "^4.0.0",
      "@tailwindcss/vite": "^4.0.0"
    }
  }, null, 2));

  zip.file('index.html', `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WMS - Warehouse Management System</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`);

  zip.file('vite.config.js', `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
});`);

  zip.file('tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      jsx: "react-jsx",
      moduleResolution: "bundler",
      strict: true,
      skipLibCheck: true,
      esModuleInterop: true,
      isolatedModules: true,
      noEmit: true,
      allowImportingTsExtensions: true
    },
    include: ["src"]
  }, null, 2));

  // Gerar o ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  
  // Fazer download
  saveAs(blob, 'wms-projeto.zip');
}
