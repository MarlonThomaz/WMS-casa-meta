# Guia de instalação — piloto web

Este guia descreve somente o caminho suportado nesta fase do WMS Casa Meta.

## O que está pronto para o piloto

O entregável atual é uma aplicação **web**. Ela pode ser usada no Windows, Linux, macOS, Android ou iOS por um navegador moderno, desde que tenha acesso ao endereço HTTPS onde o frontend estiver publicado.

PWA instalável, APK Android, IPA iOS e executável Electron/Windows ainda não fazem parte do critério de pronto.

## 1. Rodar localmente

Requisitos:

- Node.js 22 recomendado;
- npm;
- Git;
- projeto Supabase de homologação para testar persistência e autenticação real.

```bash
git clone https://github.com/MarlonThomaz/WMS-casa-meta.git
cd WMS-casa-meta
git checkout wms-stabilization-round8
npm ci
```

Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### Backend real de homologação

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
VITE_ENABLE_DEMO=false
```

Nunca use `service_role` ou secret key em variável `VITE_*`.

### Demo isolada

```env
VITE_ENABLE_DEMO=true
```

A demo usa somente dados fictícios em memória e não serve para validar RLS, JWT, persistência ou concorrência real.

## 2. Executar

```bash
npm run dev
```

O Vite exibirá o endereço local da aplicação. Para teste na mesma rede, use a opção de host somente em rede confiável:

```bash
npm run dev -- --host 0.0.0.0
```

## 3. Validar o frontend

```bash
npm run typecheck
npm run build
```

O build de produção é criado em `dist/`.

## 4. Banco de homologação

Aplique as migrations de `supabase/migrations` em ordem numérica num projeto **de teste**. Não experimente a cadeia de migrations diretamente num banco de produção.

A homologação precisa usar usuários reais de Supabase Auth e testar os papéis:

- admin;
- manager;
- operator;
- viewer.

Consulte `PILOT_RUNBOOK.md` para os cenários mínimos.

## 5. Publicação do piloto

A opção preferencial é hospedar o frontend estático em HTTPS e apontá-lo para o projeto Supabase de homologação/piloto.

A câmera do navegador exige contexto seguro em dispositivos móveis; portanto, para teste de scanner em Android/iOS, use HTTPS.

## 6. Leitor USB

Leitores USB HID genéricos que enviam o código como teclado e finalizam com Enter ou Tab são suportados pela interface. Teste o modelo físico que será usado no galpão antes do piloto.

Consulte `USB_BARCODE_READER_GUIDE.md`.

## Não usar como instrução atual

Arquivos ou anotações antigas que mencionem geração imediata de APK, IPA, PWA ou `.exe` devem ser tratados como histórico/escopo futuro. Esses formatos serão retomados somente depois da estabilização do piloto web.
