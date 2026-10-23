# 🏭 WMS Casa Meta - Guia de Configuração e Execução

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** versão 18 ou superior
  - Download: https://nodejs.org/
  - Verificar: `node --version`

- **npm** (vem com Node.js)
  - Verificar: `npm --version`

- **Conta no Supabase** (gratuita)
  - Criar conta: https://supabase.com/

- **Editor de código** (recomendado: VS Code)
  - Download: https://code.visualstudio.com/

## 🚀 Configuração Inicial (Primeira Vez)

### 1. Clonar ou Baixar o Projeto

Se você recebeu um arquivo ZIP:
```bash
# Extrair o arquivo
unzip wms-casa-meta.zip

# Entrar na pasta
cd wms-casa-meta
```

Se está usando Git:
```bash
git clone <url-do-repositorio>
cd wms-casa-meta
```

### 2. Instalar Dependências

```bash
npm install
```

Aguarde a instalação completar (pode levar 1-2 minutos).

### 3. Criar Projeto no Supabase

1. Acesse https://supabase.com/ e faça login
2. Clique em **"New Project"**
3. Preencha os dados:
   - **Name**: `wms-casa-meta-dev` (ou outro nome de sua preferência)
   - **Database Password**: Crie uma senha forte e **ANOTE ELA**
   - **Region**: Escolha a mais próxima (ex: `South America (São Paulo)`)
4. Clique em **"Create new project"**
5. Aguarde o projeto ser criado (cerca de 2 minutos)

### 4. Obter Credenciais do Supabase

1. No dashboard do seu projeto Supabase, clique em **"Settings"** (ícone de engrenagem)
2. Clique em **"API"** no menu lateral
3. Copie os seguintes valores:
   - **Project URL**: Algo como `https://xxxxx.supabase.co`
   - **anon public key**: Uma chave longa começando com `eyJ...`

### 5. Configurar Variáveis de Ambiente

1. Na raiz do projeto, copie o arquivo `.env.example`:
```bash
cp .env.example .env
```

2. Abra o arquivo `.env` no editor de código e preencha:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**IMPORTANTE**: 
- Substitua pelos valores reais copiados do Supabase
- **NUNCA** commite o arquivo `.env` no Git
- O arquivo `.env` já está no `.gitignore`

### 6. Executar Migrations no Supabase

#### Opção A: Via SQL Editor (Recomendado para iniciantes)

1. No dashboard do Supabase, clique em **"SQL Editor"** no menu lateral
2. Clique em **"New query"**
3. Copie o conteúdo do arquivo `supabase/migrations/001_initial_schema.sql`
4. Cole no editor SQL
5. Clique em **"Run"** (ou pressione Ctrl+Enter)
6. Aguarde a execução (deve aparecer "Success. No rows returned")
7. Repita o processo para:
   - `supabase/migrations/002_stock_engine.sql`
   - `supabase/migrations/003_seed_data.sql`

#### Opção B: Via Supabase CLI (Para usuários avançados)

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login no Supabase
supabase login

# Linkar ao projeto
supabase link --project-ref <seu-project-ref>

# Executar migrations
supabase db push
```

### 7. Verificar se Tudo Foi Criado

No Supabase, clique em **"Table Editor"** no menu lateral. Você deve ver as seguintes tabelas:

- `profiles`
- `products`
- `product_barcodes`
- `locations`
- `stock_balances`
- `movements`
- `movement_lines`
- `receipts`
- `receipt_lines`
- `shipments`
- `shipment_lines`
- `stock_counts`
- `stock_count_lines`

### 8. Criar Primeiro Usuário

1. No Supabase, clique em **"Authentication"** no menu lateral
2. Clique em **"Users"**
3. Clique em **"Add user"** → **"Create new user"**
4. Preencha:
   - **Email**: seu@email.com
   - **Password**: crie uma senha
   - **Auto Confirm User**: ✅ Marcado
5. Clique em **"Create user"**
6. Copie o **User UID** (algo como `123e4567-e89b-12d3-a456-426614174000`)

Agora, no **SQL Editor**, execute:

```sql
-- Substitua pelo UID real do usuário
INSERT INTO profiles (id, email, full_name, role)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000', -- Substitua pelo UID
  'seu@email.com',
  'Administrador',
  'admin'
);
```

## 🎯 Executar o Projeto

### Modo Desenvolvimento

```bash
npm run dev
```

Você verá algo como:
```
  VITE v6.3.5  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

Abra o navegador e acesse: **http://localhost:3000**

### Modo Produção (Build)

```bash
# Gerar build otimizada
npm run build

# Visualizar build localmente
npm run preview
```

Os arquivos serão gerados na pasta `dist/`.

## 🧪 Testar o Sistema

### 1. Fazer Login

1. Acesse http://localhost:3000
2. Faça login com o email e senha criados no passo 8
3. Você deve ver o Dashboard

### 2. Verificar Dados de Exemplo

- **Inventário**: Deve mostrar 10 produtos cadastrados
- **Localizações**: Deve mostrar 30 endereços (Zonas A, B, C, D, E)
- **Dashboard**: Deve mostrar gráficos com dados reais

### 3. Testar Funcionalidades

- Buscar produtos por nome ou SKU
- Visualizar localizações no mapa
- Ver saldos de estoque por endereço

## 📁 Estrutura do Projeto

```
wms-casa-meta/
├── src/
│   ├── components/          # Componentes React
│   │   ├── App.tsx         # Componente principal
│   │   ├── Dashboard.tsx   # Dashboard com KPIs
│   │   ├── Inventory.tsx   # Gestão de produtos
│   │   ├── Locations.tsx   # Mapa de localizações
│   │   ├── Receiving.tsx   # Recebimento de mercadorias
│   │   ├── Shipping.tsx    # Expedição
│   │   ├── Movements.tsx   # Histórico de movimentações
│   │   ├── BarcodeKit.tsx  # Leitor de código de barras
│   │   ├── Help.tsx        # Manual do usuário
│   │   └── Sidebar.tsx     # Menu lateral
│   ├── lib/
│   │   └── supabase.ts     # Cliente Supabase
│   ├── types.ts            # Tipos TypeScript
│   ├── data.ts             # Dados de demonstração (legado)
│   └── main.tsx            # Ponto de entrada
├── supabase/
│   └── migrations/         # Scripts SQL do banco
│       ├── 001_initial_schema.sql
│       ├── 002_stock_engine.sql
│       └── 003_seed_data.sql
├── .env                    # Variáveis de ambiente (NÃO commite)
├── .env.example            # Exemplo de variáveis
├── package.json            # Dependências
├── tsconfig.json           # Configuração TypeScript
├── vite.config.js          # Configuração Vite
└── README.md               # Este arquivo
```

## 🔧 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento com hot reload |
| `npm run build` | Gera build de produção otimizada |
| `npm run preview` | Visualiza build de produção localmente |
| `npm run typecheck` | Verifica tipos TypeScript sem compilar |

## 🐛 Solução de Problemas

### Erro: "Missing Supabase environment variables"

**Causa**: Arquivo `.env` não configurado ou variáveis faltando.

**Solução**:
1. Verifique se o arquivo `.env` existe na raiz do projeto
2. Confirme que `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão preenchidos
3. Reinicie o servidor (`Ctrl+C` e `npm run dev` novamente)

### Erro: "relation does not exist"

**Causa**: Migrations não foram executadas no Supabase.

**Solução**:
1. Acesse o SQL Editor no Supabase
2. Execute as migrations na ordem:
   - 001_initial_schema.sql
   - 002_stock_engine.sql
   - 003_seed_data.sql

### Erro: "new row violates row-level security policy"

**Causa**: Usuário não está autenticado ou não tem permissão.

**Solução**:
1. Verifique se você fez login no sistema
2. Confirme que o perfil do usuário foi criado na tabela `profiles`
3. Verifique as políticas RLS no Supabase

### App não abre no navegador

**Causa**: Servidor não está rodando ou porta em uso.

**Solução**:
1. Verifique se o terminal mostra "ready in X ms"
2. Se a porta 3000 estiver em uso, edite `vite.config.js`:
   ```js
   server: {
     port: 3001, // Altere para outra porta
   }
   ```
3. Acesse a porta correta no navegador

### Dados não aparecem no Dashboard

**Causa**: Seed data não foi inserido ou conexão com Supabase falhou.

**Solução**:
1. Verifique no Supabase se as tabelas têm dados
2. Confirme que as variáveis de ambiente estão corretas
3. Abra o console do navegador (F12) e verifique erros

## 🔐 Segurança

### ⚠️ IMPORTANTE

1. **NUNCA** commite o arquivo `.env` no Git
2. **NUNCA** use a chave `service_role` no frontend
3. **SEMPRE** use apenas a chave `anon` no frontend
4. Configure políticas RLS adequadas antes de usar em produção
5. Faça backup regular do banco de dados

### Políticas RLS Atuais

As políticas atuais são básicas para desenvolvimento:
- Usuários autenticados podem **ler** todos os dados
- Para produção, implementar políticas mais restritivas baseadas em roles

## 📊 Próximos Passos

Após configurar e testar o sistema, os próximos passos são:

1. **Etapa 2**: Conectar frontend ao Supabase (serviços)
2. **Etapa 3**: Implementar autenticação completa
3. **Etapa 4**: Migrar telas para usar dados reais
4. **Etapa 5**: Testar fluxos completos
5. **Etapa 6**: Piloto controlado com dados reais

## 📞 Suporte

Se tiver dúvidas ou problemas:

1. Consulte o **Manual do Usuário** no menu "Ajuda" do app
2. Verifique o console do navegador (F12) para erros
3. Verifique o terminal para mensagens de erro
4. Consulte a documentação do Supabase: https://supabase.com/docs

## 🎉 Pronto!

Se você chegou até aqui e o app está rodando, parabéns! 🚀

O sistema está pronto para a próxima etapa de desenvolvimento: conectar o frontend ao banco de dados real.

---

**Dúvidas?** Consulte a documentação do Supabase ou entre em contato com a equipe de desenvolvimento.
