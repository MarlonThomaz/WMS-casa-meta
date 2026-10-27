# Runbook do piloto — WMS Casa Meta

Este documento é o checklist operacional para promover a branch de estabilização a um piloto web controlado.

## 1. Ambiente

Use um projeto Supabase exclusivo de homologação/piloto. Não use banco de produção para a primeira aplicação das migrations ou para testes destrutivos.

Registre antes de começar:

- URL do projeto Supabase;
- data/hora da aplicação das migrations;
- commit Git utilizado;
- responsável pelo teste;
- resultado dos checks de frontend e CI.

## 2. Preparação do banco

1. Criar projeto Supabase de teste vazio.
2. Aplicar as migrations de `supabase/migrations` em ordem numérica.
3. Confirmar que a última migration aplicada é `017_pilot_inventory_integrity.sql` ou posterior.
4. Não inserir `service_role` no frontend.
5. Criar as contas de teste no Supabase Auth.

## 3. Usuários de homologação

Criar quatro contas distintas:

| Perfil | Estado esperado | Objetivo |
|---|---|---|
| admin | ativo | usuários, operação completa e auditoria |
| manager | ativo | operação completa e auditoria |
| operator | ativo | fluxos operacionais |
| viewer | ativo | leitura sem mutações |

Uma conta nova deve aparecer inicialmente como `viewer` e `active = false`. Ative e defina o papel pela tela **Usuários** usando a conta admin.

Validar:

- viewer lê dados, mas não cria/edita;
- operator não altera papel de usuário;
- manager não administra papéis;
- admin consegue ativar/desativar outro perfil e alterar role;
- usuário inativo deixa de receber papel operacional.

## 4. Cenário de recebimento

1. Criar produto e endereço de recebimento.
2. Criar recebimento esperado de 10 unidades.
3. Informar 5 recebidas e processar.
4. Confirmar status `partial` e saldo +5.
5. Processar novamente sem mudar quantidade.
6. Confirmar que o saldo não aumenta novamente.
7. Alterar recebido para 10 e processar.
8. Confirmar status `completed`, saldo total +10 e `processed_quantity = 10`.
9. Conferir movimento e evento de auditoria.

## 5. Cenário de expedição

Preparar duas linhas com estoque suficiente.

### Picking parcial com linha zerada

- linha A: solicitado 10, separado 6;
- linha B: solicitado 5, separado 0.

Validar:

1. iniciar picking reserva 10 + 5;
2. confirmar embalagem;
3. quantidade física da linha A diminui 6;
4. quantidade física da linha B não muda;
5. reserva final de ambas as linhas volta ao valor anterior;
6. não sobra reserva fantasma;
7. somente a linha A gera saída física;
8. status vira `packed`;
9. despacho final vira `shipped`.

### Picking totalmente zerado

1. reservar uma expedição;
2. manter todas as quantidades separadas em zero;
3. confirmar picking;
4. validar cancelamento e liberação integral das reservas;
5. validar que nenhuma quantidade física foi consumida.

## 6. Estoque reservado x movimentação manual

1. reservar quase todo o saldo de um SKU numa expedição;
2. tentar uma saída/transferência manual maior que o saldo disponível, mas menor que o saldo físico total;
3. a operação deve falhar com estoque disponível insuficiente;
4. não deve existir movimento órfão;
5. quantidade e reserva devem permanecer consistentes.

## 7. Contagem com movimento posterior

Exemplo recomendado:

- snapshot: 100;
- contagem física: 95;
- depois da contagem, entrada legítima: +20.

Ao concluir a contagem, o resultado esperado é **115**, não 95.

Validar:

1. abrir contagem;
2. iniciar;
3. registrar quantidade física;
4. realizar uma movimentação posterior ao `counted_at`;
5. concluir;
6. confirmar que a movimentação posterior foi preservada;
7. confirmar que o ajuste representa somente a divergência física da contagem.

## 8. Movimentações manuais

Testar pela tela **Movimentações**:

- entrada;
- saída;
- transferência;
- ajuste positivo;
- ajuste negativo.

Validar origem/destino, quantidade, histórico, saldo e auditoria.

## 9. Código de barras

Testar:

- busca por barcode;
- entrada manual;
- leitor USB HID físico;
- câmera em Android por HTTPS;
- cadastro de produto com barcode;
- estoque inicial;
- tentativa de barcode duplicado;
- transferência por scanner.

O cadastro duplicado deve fazer rollback integral, sem produto órfão.

## 10. Auditoria

Como admin/manager, abrir **Auditoria** e verificar eventos de:

- produto criado/alterado;
- localização criada/alterada;
- recebimento processado;
- picking iniciado/concluído;
- reservas liberadas;
- movimentação processada;
- contagem concluída.

O navegador não deve possuir permissão para inserir eventos de auditoria diretamente.

## 11. Concorrência

Abrir duas sessões/navegadores com usuários diferentes.

Testes mínimos:

- duas tentativas de consumir o mesmo saldo;
- expedição reservando enquanto outro usuário tenta saída manual;
- movimentação durante contagem física;
- retry de recebimento em abas diferentes.

O banco deve impedir saldo negativo, excesso de reserva e duplicação de processamento.

## 12. Backup antes do piloto

Antes de carregar dados reais do piloto:

1. gerar backup lógico do banco pela ferramenta suportada pelo projeto Supabase;
2. registrar o commit Git e a lista de migrations aplicadas;
3. guardar exportação dos cadastros iniciais usados no piloto;
4. confirmar que o backup pode ser restaurado em ambiente descartável.

Um backup não é considerado válido até que exista pelo menos um teste de restauração.

## 13. Rollback operacional

Se uma migration nova ainda não tiver sido aplicada no banco do piloto, reverta apenas o código/branch.

Se uma migration já tiver sido aplicada:

- não reescreva ou delete migrations históricas;
- crie uma migration corretiva forward;
- em incidente grave, interrompa novas operações, preserve logs/auditoria e restaure o último backup validado em ambiente controlado;
- valide saldos, reservas, operações abertas e usuários antes de reabrir o sistema.

Nunca use `git push --force` ou edição manual de `stock_balances` como método de recuperação operacional.

## 14. Critério para iniciar o piloto

Somente iniciar o piloto quando:

- CI estiver verde no commit candidato;
- typecheck e build estiverem verdes;
- migrations aplicarem do zero no ambiente de homologação;
- todos os cenários acima tiverem resultado registrado;
- scanner usado na operação tiver sido testado fisicamente;
- backup e restauração tiverem sido ensaiados;
- não houver bloqueador conhecido de integridade de estoque.
