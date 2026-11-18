# Annona Mercis WMS

Sistema web para organização, endereçamento e controle físico de armazéns, desenvolvido com React, TypeScript, Vite, Supabase e PostgreSQL.

## Objetivo do produto

O foco principal do Annona Mercis é responder de forma rápida e confiável:

> **Onde está fisicamente cada produto do estoque?**

A aplicação foi orientada para operações com grande quantidade de SKUs e muitas posições físicas, onde conhecer apenas o saldo total não é suficiente.

O núcleo operacional cobre:

- localizar produto por SKU, nome, categoria ou endereço;
- controlar estoque por localização física;
- manter múltiplos endereços para o mesmo SKU;
- guardar/endereçar mercadorias;
- transferir mercadorias entre posições;
- visualizar mapa e ocupação das localizações;
- executar contagens físicas e reconciliação;
- trabalhar com códigos de barras e leitores HID/câmera;
- registrar auditoria das operações.

Recebimento, reserva, picking, packing e expedição continuam implementados como **módulos complementares**, mas não são o foco principal da interface do piloto.

## Estado do projeto

O projeto está em **estabilização final para piloto web controlado**.

A `main` é a branch oficial e incorpora a estabilização Round 8. Novos trabalhos devem partir da `main`.

O núcleo transacional já foi homologado em Supabase hospedado para os principais fluxos de estoque, usuários, permissões, recebimento, expedição, contagem e scanner físico.

Antes do piloto físico ainda restam alguns gates importantes, principalmente:

1. concorrência real em duas sessões simultâneas;
2. câmera em navegador móvel via HTTPS;
3. ensaio real de backup + restauração;
4. teste de carga representativo para o novo localizador e mapa de endereços.

Consulte `PILOT_TECHNICAL_AUDIT.md` para a auditoria técnica e o *fat trim* mais recente, e `PILOT_RUNBOOK.md` para o checklist operacional.

## Escopo atual

### Núcleo de estoque físico

- produtos e SKUs;
- códigos de barras;
- localizações físicas;
- estoque por endereço;
- busca de mercadoria por produto ou posição;
- entradas, saídas, transferências e ajustes;
- contagem física com snapshot e reconciliação;
- dashboard operacional;
- auditoria;
- usuários e papéis.

### Módulos complementares

- recebimento parcial e idempotente;
- criação atômica de recebimentos;
- expedição;
- reserva de estoque;
- picking completo/parcial;
- packing;
- shipping;
- cancelamento e liberação de reservas.

Esses módulos permanecem disponíveis para empresas que precisem de um fluxo logístico mais completo ou para futuras integrações com ERP.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase Auth
- PostgreSQL / Supabase
- Row Level Security (RLS)
- GitHub Actions

## Desenvolvimento local

Recomendado: Node.js 22.

```bash
npm ci
cp .env.example .env
npm run dev
```

Para usar o backend real de homologação:

```bash
npm run dev:homolog
```

Para expor a aplicação na rede local durante testes em celular:

```bash
npm run dev:mobile
```

Configuração mínima do backend:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica-aqui
VITE_ENABLE_DEMO=false
```

`VITE_SUPABASE_ANON_KEY` continua aceito por compatibilidade.

Nunca coloque `service_role`, secret key ou qualquer chave privilegiada em variável `VITE_*`.

Para demonstração isolada, sem persistência real:

```env
VITE_ENABLE_DEMO=true
```

O modo demo serve para explorar a interface. Ele não substitui autenticação, RLS, concorrência ou persistência reais.

## Checks locais

```bash
npm run typecheck
npm run build
```

A CI executa esses checks automaticamente e também recria o banco do zero para validar as migrations e regressões SQL.

## Banco de dados

As migrations ficam em `supabase/migrations` e são aplicadas em ordem numérica.

A cadeia histórica **001–033 deve ser preservada**. Ela é necessária para reconstruir o schema de forma reproduzível e não deve ser tratada como código morto apenas por conter versões anteriores de funções ou políticas.

A suíte atual de regressão fica em `supabase/tests` e cobre:

- núcleo transacional Round 8;
- autorização e RLS;
- cadastro atômico por código de barras;
- picking parcial e liberação de reservas;
- proteção contra consumo de estoque reservado;
- preservação de movimentos posteriores à contagem física.

A CI não reproduz integralmente Supabase Auth/PostgREST hospedado. Por isso, **CI verde não substitui homologação real**.

## Regras de arquitetura

### Autoridade no banco

O navegador não é fonte confiável para autoria, saldo, reservas ou eventos de auditoria.

Operações críticas passam por RPCs, triggers e regras no PostgreSQL, e o banco deriva o usuário a partir da sessão autenticada.

### Estoque físico

`stock_balances` não deve ser alterado diretamente pelo cliente.

Movimentações críticas usam funções transacionais para impedir saldo inválido e preservar consistência entre posições.

Saídas, transferências e ajustes negativos respeitam estoque disponível e não devem consumir unidades já reservadas para expedição.

### Endereçamento

Uma mercadoria pode existir em mais de uma localização. A soma dos saldos por endereço representa o estoque físico conhecido pelo Annona.

O localizador consulta produto + posição para responder onde cada SKU está armazenado.

### Recebimento

`processed_quantity` é interno ao banco. Reprocessar um recebimento parcial não duplica saldo: apenas o delta ainda não contabilizado é aplicado.

### Expedição

Ao iniciar picking, o sistema reserva estoque disponível. Ao confirmar o picking, somente a quantidade efetivamente separada vira saída física e a reserva não utilizada é liberada.

### Contagem física

A abertura da contagem cria um snapshot.

Na conclusão, movimentos legítimos ocorridos após o instante físico contado são preservados, evitando que uma reconciliação apague operações posteriores.

### RLS e papéis

- `admin`: operação completa, usuários e auditoria;
- `manager`: operação completa, endereços e auditoria;
- `operator`: fluxos operacionais permitidos;
- `viewer`: somente leitura.

Uma conta criada no Supabase Auth nasce como `viewer` e `active = false`. Um administrador ativa e define o papel pela tela **Usuários**.

### Auditoria

Eventos autoritativos são gravados por funções e triggers do banco. O navegador consulta a auditoria, mas não pode fabricar eventos diretamente.

## Homologação já realizada

No ambiente Supabase hospedado já foram validados em uso real:

- login e papéis dos quatro perfis;
- transferência entre endereços;
- recebimento parcial, retry idempotente e conclusão;
- reserva de expedição;
- picking parcial;
- packing e shipping sem baixa duplicada;
- contagem física com movimentação posterior ao snapshot;
- scanner físico Bluetooth/HID;
- RLS e permissões principais.

## Antes do piloto físico

Ainda devem ser concluídos:

1. teste de concorrência em duas sessões reais;
2. cancelamento/liberação de reserva durante o teste de concorrência;
3. câmera em Android via HTTPS;
4. backup + restauração em ambiente separado;
5. carga representativa com milhares de SKUs e muitas posições;
6. teste operacional focado em localizar, guardar, transferir, contar e corrigir divergência;
7. freeze/tag da versão de piloto após todos os gates.

## Instalação e distribuição

Para o piloto, utilize a aplicação **web** em navegador moderno.

### Consulta offline (Round 9)

A aplicação publicada por HTTPS prepara automaticamente uma cópia mínima de produtos, códigos de barras, endereços e saldos em IndexedDB, associada à conta autenticada neste navegador. O service worker armazena somente a interface estática. A cópia é somente leitura, tem validade de 24 horas desde a última atualização e exibe sua data; não representa estoque atual garantido. É necessário um login prévio e uma primeira sincronização bem-sucedida. Se a sessão local não estiver disponível (por exemplo, após expiração do token), conecte-se novamente.

As atualizações acontecem a cada cinco minutos e após operações relevantes neste navegador; falhas preservam a última cópia válida. A aplicação verifica o acesso ao backend também quando o Wi-Fi permanece conectado. Ao sair ou trocar de conta, bloqueia e tenta apagar os dados do aparelho; a revogação remota exige conexão. Desativação remota de um perfil só pode ser descoberta quando voltar a comunicar-se com o servidor. Dados locais não são criptografados pela aplicação; use dispositivos corporativos protegidos, não compartilhe perfis de navegador e não trate a cópia como autorização para movimentar mercadoria.

Movimentações, contagens e todas as escritas exigem conexão. PWA instalável, Electron/Windows, APK/IPA e fila de escritas offline não fazem parte desta fase.

### Escalabilidade (Round 10)

A contagem física usa as RPCs de busca/progresso das migrations 032–033, com 50 linhas por página e confirmação explícita. O progresso considera todas as linhas, inclusive aquelas que não são exibidas. As edições ainda não confirmadas permanecem durante a navegação dentro da contagem, mas não são gravadas sem confirmação. Históricos de movimentação, recebimento, expedição, contagem e auditoria usam páginas de 50 registros e totais do banco. A pesquisa de auditoria cobre evento, entidade, usuário e UUID exato (não busca texto livre dentro do JSON de detalhes). Os detalhes de documentos e do código de barras são lidos em lotes por cursor. Aplicar as migrations existentes até 033 em homologação antes do teste. A CI inclui simulações de 6.000 linhas de contagem e 1.200 históricos; isso não substitui medir latência real no galpão.

### Round 11 — Importação e recuperação

- Inventário > Importar CSV: admin/manager autenticado, até 5.000 produtos, prévia e relatório de conflitos. Migration 034 necessária; gravação atômica sem saldos fictícios. Produtos existentes idênticos são ignorados; alterações e cargas físicas são separadas.
- Ferramentas de TI: `npm run backup:wms -- <diretório privado>`, `npm run backup:verify -- <pasta da cópia>`, `npm run backup:restore-local -- <pasta da cópia> --confirm-disposable`. Exige ferramentas PostgreSQL e variáveis libpq; ver [RECOVERY_RUNBOOK.md](RECOVERY_RUNBOOK.md). O arquivo lógico não substitui backup gerenciado completo. Nenhum backup real, agendamento ou restauração em produção é ativado pelo build.
- Diagnóstico somente leitura em `supabase/diagnostics/`. Não executar testes destrutivos na produção.

### Round 12A — Integração ERP por arquivo

Inventário > Integração ERP: mapeamento assistido de CSV (catálogo e estoque), importação segura pela migration 034, conciliação somente leitura pela migration 035 e exportação de relatório JSON/CSV. Não é uma integração API ativa. Utilizar exclusivamente a empresa/armazém correspondente à instância. Veja [contrato e roteiro de homologação](docs/ATON_INTEGRATION.md) e os exemplos sintéticos em `docs/fixtures/`.
