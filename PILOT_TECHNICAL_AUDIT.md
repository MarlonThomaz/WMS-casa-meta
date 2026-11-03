# Annona Mercis WMS — Auditoria técnica pré-piloto

Data da revisão: 2026-11-03
Branch revisada: `wms-stabilization-round8`

## Objetivo

Esta auditoria consolida o *fat trim* realizado antes do piloto físico. O objetivo foi remover código morto, APIs legadas, scaffolds quebrados e documentação histórica que aumentavam a superfície de manutenção sem contribuir para a versão web homologada.

A revisão não altera a regra central do sistema: operações críticas de estoque continuam protegidas por PostgreSQL/Supabase, RLS, RPCs e triggers. As migrations históricas foram preservadas integralmente.

## Removido com baixo risco

### Código e APIs sem consumidor

- `src/data.ts`: dataset legado anterior ao `demoStore`.
- `src/hooks/useBarcodes.ts`: camada de hooks não utilizada pela interface atual.
- `src/utils/exportCSV.ts`: exportador baseado em um modelo de dados antigo e sem consumidor.
- helpers de autenticação Supabase que não eram utilizados pelo `AuthContext`.
- hooks e queries antigas do dashboard sem consumidor.
- hooks e services de estoque que não eram utilizados pelo localizador atual.
- consultas redundantes por status/tipo em movimentações, recebimentos e expedições, já que as telas filtram localmente.
- APIs antigas de criação de recebimento/expedição em múltiplas etapas, substituídas pelas RPCs atômicas.
- CRUD avulso de código de barras que não possuía interface consumidora.
- funções antigas de contagem física sem consumidor (`addStockCountLine` e consulta por status).
- logger de auditoria no cliente, substituído pela auditoria autoritativa no banco.

### Scaffolds fora do piloto

Foram removidos da branch ativa:

- Electron;
- configuração Capacitor;
- manifest PWA não ligado ao HTML;
- service worker não registrado;
- scripts antigos de build multiplataforma e geração de ícones.

Esses artefatos estavam incompletos ou inconsistentes com a configuração atual do projeto. A versão mobile do piloto continua sendo a aplicação web responsiva em navegador.

### Testes históricos

Foram removidas suites antigas que não eram executadas pela CI atual:

- regressões Round 5;
- regressões Round 6;
- validation tests v1, v2 e v3.

A CI continua executando as suites Round 8 de núcleo, expedição, contagem, barcode e RLS.

### Documentação histórica

Relatórios de rounds, etapas concluídas, status antigos e guias substituídos foram retirados da branch ativa. O histórico permanece recuperável no Git.

## Preservado deliberadamente

### Migrations 001–020

Nenhuma migration foi removida ou reescrita. A CI recria o banco do zero aplicando toda a cadeia em ordem; portanto, tratá-las como “código velho” quebraria a reprodutibilidade do schema.

### Módulos complementares

Recebimento e expedição continuam implementados. Eles deixaram de ser o foco da navegação, mas permanecem úteis como módulos opcionais e como base para integrações futuras.

### Demo

`demoStore.ts` permanece porque o modo demonstração explícito ainda é usado para explorar a interface sem backend real. A demo não substitui homologação de regras de estoque/RLS.

### Documentação operacional atual

Foram mantidos os documentos que ainda têm utilidade prática:

- `README.md`;
- `SETUP_GUIDE.md`;
- `INSTALL_GUIDE.md`;
- `PILOT_RUNBOOK.md`;
- `MOBILE_TEST_GUIDE.md`;
- `USB_BARCODE_READER_GUIDE.md`.

## Correção feita durante a auditoria

`getLocationsWithOccupancy` escondia falhas da RPC `get_location_occupancy` e retornava ocupação zero. Isso poderia apresentar um erro de backend como se fosse dado válido. Agora a falha é propagada para a interface.

## Riscos ainda abertos antes do piloto

### P0 — concorrência real

A CI testa consistência transacional no PostgreSQL, mas ainda é obrigatório testar duas sessões reais tentando reservar/movimentar o mesmo estoque simultaneamente. Esse é um gate de piloto, não código morto.

### P0 — backup e restauração

Ainda é necessário executar um restore real em ambiente separado. Backup que nunca foi restaurado não deve ser considerado validado.

### P1 — Localizar produto carrega todos os saldos positivos

`ProductLocator` atualmente carrega os `stock_balances` positivos com joins e filtra no navegador. Para o piloto pequeno isso é aceitável; para um armazém com milhares de SKUs e muitos endereços deve evoluir para busca server-side/indexada.

Risco: crescimento de payload, tempo de carregamento e consumo de memória no celular.

### P1 — ocupação de localizações usa padrão N+1

`getLocationsWithOccupancy` busca as localizações e executa uma RPC de ocupação para cada posição.

Risco: muitas requisições quando o armazém possuir centenas ou milhares de endereços.

Próxima evolução: uma única RPC/view que retorne todas as localizações com ocupação agregada.

### P1 — dashboard busca dados de produtos mais de uma vez

O dashboard usa `useProducts()` e também `getDashboardStats()`, que consulta produtos com estoque. Não causa inconsistência, mas gera tráfego duplicado.

### P1 — pesquisa de precisão de inventário não é agregada no banco

`getInventoryAccuracy` primeiro carrega IDs de contagens concluídas e depois consulta suas linhas. Funciona para o piloto, mas deve virar agregação SQL/RPC quando o histórico crescer.

### P2 — tipos frouxos remanescentes

`PilotDashboard.tsx` ainda utiliza `any` para métricas. Não é risco transacional, mas reduz a capacidade do TypeScript de detectar regressões.

### P2 — dependências npm ociosas

O `package.json` ainda declara bibliotecas que o frontend atual não importa, incluindo DnD Kit, `canvas-confetti`, `date-fns`, `framer-motion`, `react-router-dom`, `recharts` e `uuid`.

Elas não foram removidas nesta etapa porque `package.json` e `package-lock.json` precisam ser regenerados juntos. A poda correta deve ser feita com npm e validada com `npm ci`, typecheck e build.

### P2 — documentação/identidade antiga

Alguns documentos de configuração e a ajuda interna ainda usam a denominação “WMS Casa Meta”. Isso deve ser alinhado para “Annona Mercis WMS”, sem alterar comportamento do software.

## Gates recomendados antes do piloto

1. CI verde no head final do fat trim.
2. Teste real de concorrência em duas sessões.
3. Teste de cancelamento/liberação de reserva.
4. Câmera no Android via HTTPS.
5. Scanner físico já homologado deve ser retestado após o freeze da versão.
6. Backup + restore em projeto separado.
7. Carga de teste representativa (milhares de SKUs e muitas posições) para medir localizador e mapa.
8. Teste operacional focado em: localizar, guardar, transferir, contar e corrigir divergência.
9. Congelar uma versão/tag de piloto somente depois dos gates acima.

## Regra para próximas limpezas

Não remover migrations, RPCs ou triggers apenas porque parecem antigas. Antes de excluir qualquer peça de banco, verificar:

1. referência no frontend;
2. referência entre funções SQL;
3. grants/ACL;
4. RLS;
5. migrations posteriores;
6. testes Round 8;
7. uso real no Supabase hospedado.

A prioridade desta branch é confiabilidade operacional, não obter o menor número possível de linhas de código.
