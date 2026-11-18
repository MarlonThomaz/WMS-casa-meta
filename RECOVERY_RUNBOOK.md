# Annona Mercis — Round 11: implantação e recuperação

## Escopo

A ferramenta de TI produz um arquivo lógico PostgreSQL consistente dos schemas public e auth, com catálogo do dump e manifesto SHA-256. Não é backup completo dos recursos gerenciados Supabase, arquivos Storage, segredos, configurações Auth, papéis globais, histórico de migrations fora desses schemas ou Edge Functions. A recuperação hospedada deve seguir o mecanismo oficial do Supabase, preferencialmente restaurando em um novo projeto. Não execute um dump SQL de produção sobre outro projeto sem revisão.

## 1. Pré-implantação

- Congelar o commit e registrar o projeto/ambiente; manter desenvolvimento, homologação e produção separados.
- Conferir CI e migrations 001–034 na homologação; não reaplicar seeds de demonstração em produção. Revisar a migration 003 antes da carga real.
- Registrar responsáveis autorizados, janela de manutenção, RPO/RTO e inventário de integrações. Proposta inicial: backup diário e antes de importações/migrations, retenção de 7 diários e 4 semanais; RPO até 24 h, RTO alvo 4 h, **não garantidos** até medir a restauração.
- Usar HTTPS, chave publishable/anon no frontend, MFA na administração, senhas individuais, perfil admin/manager para importação.
- Verificar espaço em disco, região, direitos de acesso e política de retenção. A cópia contém dados de usuários e hashes de autenticação: criptografar, restringir acesso e guardar fora do Git, do site e da pasta pública. Manter uma segunda cópia separada. Hash garante verificação de integridade, não autenticidade contra adulteração.

## 2. Exportar e verificar

Instale pg_dump e pg_restore da **mesma versão principal** do servidor (por exemplo, 15 para PostgreSQL 15; o script recusa divergências para evitar dumps com parâmetros incompatíveis), e use conexão direta ou pooler em modo sessão, nunca pooler de transação para este procedimento. Configure PGHOST, PGPORT, PGUSER, PGDATABASE e PGSSLMODE=verify-full para ambiente hospedado; siga a configuração TLS do provedor. Use PGPASSFILE com permissões restritas. Não coloque credenciais em argumentos ou arquivos versionados. Exemplos de comandos:

```sh
node scripts/wms-backup.mjs backup /caminho/privado/backups
node scripts/wms-backup.mjs verify /caminho/privado/backups/wms-...
```

O script cria uma pasta única contendo wms.dump e manifest.json. Arquivo parcial é removido em erro; não sobrescreve cópias anteriores. Para Windows, use PowerShell e caminhos locais protegidos, com pg_dump/pg_restore/psql disponíveis no PATH.

Caso pg_dump não tenha privilégios sobre auth ou dependências do ambiente hospedado, trate a falha como impeditivo, não como backup bem-sucedido. Use o backup da plataforma ou o procedimento lógico oficial do Supabase de acordo com a versão da CLI instalada. Referências:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/platform/clone-project

## 3. Ensaio seguro de restauração

A ferramenta automatizada aceita somente um PostgreSQL local isolado, com nome wms_restore_*, vazio, e confirmação explícita. Não usa DROP/--clean nem aponta a produção. O cluster local deve ter papéis globais (anon, authenticated, service_role e demais papéis referenciados) e extensões compatíveis. Para arquivos gerados no Supabase, dependências de schemas/extensions gerenciados podem impedir a restauração local; nesse caso use o fluxo oficial em um projeto novo isolado.

```sh
# Com PGHOST=127.0.0.1 e credenciais do PostgreSQL de TESTE:
createdb -T template0 wms_restore_drill
# Configure PGDATABASE=wms_restore_drill no ambiente.
node scripts/wms-backup.mjs restore-local /caminho/privado/backups/wms-... --confirm-disposable
psql -X -v ON_ERROR_STOP=1 -f supabase/diagnostics/integrity_report.sql
```

A rotina exige destino vazio e versões principais iguais de origem, ferramentas e destino, valida manifesto e restaura em uma transação. Depois confirma tabelas e invariantes básicas. Compare contagens, amostras de SKUs, saldos/reservas e histórico com uma referência consistente da origem. Em ensaio controlado, sem escritas concorrentes, compare a saída de row_counts.sql na origem e no destino. Em Supabase novo, valide também Auth, funções RPC, RLS (viewer/operator/manager/admin), sequências, auditoria e funcionamento do frontend. Registre duração e resultado. A CI simula o PostgreSQL e Auth mínimos; não substitui o ensaio no provedor real.

## 4. Incidente de dados

1. Suspender escritas/entradas operacionais, registrar hora/operador/commit, preservar logs e tirar cópia do estado atual sem sobrescrever a última cópia boa.
2. Diagnosticar com queries somente leitura (integrity_report.sql) e auditoria; comparar estoque físico, documentos ERP e WMS. Tratar divergências de reserva como investigação, não como autorização para zerar reserva.
3. Escolher entre correção transacional devidamente auditada e recuperação em ambiente novo. Não editar saldos diretamente, apagar registros de auditoria ou reexecutar operações concluídas.
4. Restaurar de uma cópia conhecida, validar integridade e permissões, reconciliar operações ocorridas depois do backup e validar fisicamente. A troca de URL/chaves do frontend exige aprovação e registro.
5. Após autorização, reabrir operações e acompanhar divergências. Invalidar cópias offline antigas nos dispositivos: sair, limpar dados locais quando necessário, entrar e aguardar nova sincronização.

## 5. Importação inicial do catálogo

Inventário > Importar CSV, disponível para admin/manager autenticado. CSV UTF-8 (vírgula ou ponto e vírgula), até 5.000 produtos/5 MB, SKU e código de barras tratados como texto. Campos mínimos sku e nome. Cabeçalhos conforme modelo dentro do app. Estoque mínimo/máximo são parâmetros, não quantidades físicas. Não inclua saldos nem endereços.

- Faça backup verificado antes da carga; reserve janela sem alterações simultâneas do catálogo.
- Exporte o catálogo do ERP, preserve zeros à esquerda, converta colunas no modelo e faça uma primeira validação em homologação.
- Corrija todas as linhas inválidas. Conflitos de SKU ou barcode bloqueiam o arquivo inteiro. Produto existente idêntico é ignorado; diferenças/inativos exigem revisão manual. A importação é transacional, revalida no banco no momento da gravação e não substitui cadastros existentes. Não há estoque inicial automático.
- Em caso de perda de conexão durante gravação, revalide o MESMO arquivo antes de tentar novamente; os itens já existentes idênticos serão reconhecidos.
- Compare total importado, amostras e auditoria product_created. Endereçamento e carga inicial física devem ser feitos depois, por movimentações/recebimentos auditados, com conferência da mercadoria. Não existe sincronização ERP nesta rodada.

## 6. Critérios de liberação

CI completa; backup verificado; restauração real ensaiada; validação dos perfis e homologação mobile/offline; importação de teste e reconciliação; autorização do responsável. Não confundir ferramenta disponível com backup agendado/armazenado ou SLA contratado. O agendamento deve ser instalado pelo administrador em host confiável, com alertas de falha e retenção; nenhuma credencial deve ficar no repositório.
