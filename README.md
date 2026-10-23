# WMS Casa Meta

Sistema web de gerenciamento de armazém para a operação da Casa Meta, desenvolvido com React, TypeScript, Vite, Tailwind CSS, Supabase e PostgreSQL.

## Estado do projeto

O projeto está em **estabilização para piloto web controlado**. Não deve ser tratado como produto concluído nem implantado em produção sem validar os fluxos operacionais no ambiente Supabase de teste.

A versão web já concentra os módulos principais em uma única aplicação:

- autenticação e perfis;
- produtos e códigos de barras;
- endereçamento/localizações;
- saldo e movimentações de estoque;
- recebimento;
- expedição;
- contagem física;
- auditoria e permissões por papel.

PWA, Electron/Windows, Android e iOS **não fazem parte do critério de pronto da fase atual**. Os arquivos experimentais dessas plataformas podem permanecer no repositório, mas não devem ser considerados builds suportados até receberem uma rodada própria de validação.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase Auth
- PostgreSQL / Supabase
- Row Level Security (RLS)

## Requisitos

- Node.js 22 recomendado para reproduzir a CI atual;
- npm;
- um projeto Supabase de teste;
- URL e anon key do Supabase.

## Configuração local

```bash
npm install
cp .env.example .env
```

Preencha o `.env`:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
VITE_ENABLE_DEMO=false
```

O modo demo é deliberadamente explícito. Para usá-lo sem backend local:

```env
VITE_ENABLE_DEMO=true
```

Nunca use esse modo para validar regras de estoque, autorização ou persistência.

## Provisionamento de usuários

O WMS **não oferece cadastro público de operadores**. Contas devem ser criadas/provisionadas pela administração.

Mesmo que o Supabase Auth aceite um cadastro por outro cliente, a trigger do banco cria o perfil como:

- `role = viewer`;
- `active = false`.

Assim, criar uma identidade no Auth não concede acesso ao WMS. Um administrador precisa ativar o perfil e atribuir o papel apropriado.

Para o primeiro administrador de um ambiente novo, crie a conta no painel de Auth do Supabase e, usando o SQL Editor com credencial administrativa, faça a promoção explícita:

```sql
update public.profiles
set role = 'admin', active = true
where email = 'admin@empresa.com';
```

Depois do primeiro bootstrap, mantenha o provisionamento de usuários como processo administrativo controlado.

## Banco de dados

As migrations ficam em `supabase/migrations` e devem ser aplicadas em ordem numérica.

A CI cria um PostgreSQL isolado, prepara uma compatibilidade mínima com o namespace `auth` do Supabase e aplica toda a cadeia de migrations do zero. Isso detecta SQL inválido, versões duplicadas e dependências quebradas entre migrations.

A suíte também executa regressões transacionais e uma simulação de RLS usando o papel de banco `authenticated`, cobrindo cenários como autoria não falsificável, perfil inativo, bloqueio de status direto, recebimento idempotente e isolamento entre papéis.

Antes do piloto, a mesma cadeia ainda deve ser validada em um **projeto Supabase de teste real**, porque Auth, JWT e PostgREST do Supabase não são integralmente reproduzidos pelo PostgreSQL genérico da CI.

## Desenvolvimento

```bash
npm run dev
```

Por padrão o Vite usa a porta configurada em `vite.config.js`.

## Checks obrigatórios

```bash
npm run typecheck
npm run build
```

A pull request também executa GitHub Actions para:

- TypeScript;
- build de produção;
- versões duplicadas de migrations;
- padrões inválidos de RLS;
- aplicação integral das migrations em PostgreSQL isolado;
- existência das RPCs críticas;
- regressões transacionais;
- regressões de RLS sob papel `authenticated`.

Um build verde não substitui o piloto operacional.

## Regras de arquitetura

### Autoridade no banco

O navegador não é fonte confiável para `created_by`. O banco deriva a autoria do usuário autenticado.

Operações que alteram estoque usam RPCs transacionais para evitar cabeçalhos ou linhas parcialmente persistidos.

### Estoque

Alterações físicas de saldo devem passar pelas funções transacionais do banco. `stock_balances` não deve ser alterado diretamente pelo cliente.

### RLS

Os papéis atuais são:

- `admin`
- `manager`
- `operator`
- `viewer`

Um perfil com `active = false` não recebe papel operacional por `user_role()`.

### Auditoria

Processamento de estoque é auditado pelas funções transacionais. Criação e edição de produtos e localizações também geram eventos automaticamente no banco.

### Operações finalizadas

Linhas de recebimentos, expedições e contagens finalizadas são tratadas como histórico e não devem ser reescritas pela aplicação, inclusive por administradores da aplicação.

## Fluxos atuais

### Produtos e localizações

- cadastro e edição de produtos;
- desativação de produto sem apagar histórico;
- cadastro e edição de localizações por `admin`/`manager`;
- auditoria automática das alterações.

### Recebimento

- criação de cabeçalho e linhas em uma única transação;
- conferência de quantidade recebida;
- processamento incremental/idempotente por `processed_quantity`;
- status `partial` e `completed` derivados do estado real das linhas.

### Expedição

- criação atômica de cabeçalho e linhas;
- reserva de estoque;
- picking;
- liberação de reserva não utilizada;
- packing e shipping.

### Movimentações

- entrada;
- saída;
- transferência;
- ajuste;
- criação e processamento em uma única RPC.

### Contagem física

- criação atômica do cabeçalho e snapshot;
- quantidade contada;
- ajuste transacional;
- preservação de movimentações legítimas ocorridas após o snapshot.

## Antes do piloto

Ainda é necessário concluir e registrar, no ambiente Supabase de teste real:

1. autenticação real com usuários `admin`, `manager`, `operator` e `viewer`;
2. regressões de autorização/RLS com JWTs emitidos pelo Supabase;
3. recebimento parcial, retry e conclusão pela interface;
4. reserva, picking parcial, cancelamento e expedição pela interface;
5. concorrência de estoque/contagem em duas sessões reais;
6. scanner em navegador móvel com HTTPS;
7. restauração/backup e procedimento de rollback.

## Git workflow

Mudanças estruturais devem entrar por branch e pull request. Não faça merge de uma rodada de estabilização apenas porque o frontend compilou: verifique também os jobs de migrations, regressões e os testes funcionais relevantes.

## Escopo futuro

Após o piloto web estar estável, podem ser retomados separadamente:

- PWA instalável;
- Electron para Windows;
- Capacitor/Android;
- iOS;
- offline/sincronização;
- distribuição de executáveis.

Esses itens não são requisitos para validar o MVP web do armazém.
