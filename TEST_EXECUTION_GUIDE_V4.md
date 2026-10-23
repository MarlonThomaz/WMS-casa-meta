# 🧪 Guia de Execução de Testes - Quinta Rodada Corretiva
## WMS Casa Meta - Testes de Regressão

## ⚠️ AVISO IMPORTANTE

**NÃO execute estes testes em produção!**

Estes testes:
- Criam e modificam dados de estoque
- Testam cancelamentos e ajustes
- Podem deixar resíduos se falharem

**Execute APENAS em ambiente de teste isolado.**

---

## 📋 Pré-requisitos

### 1. Ambiente de Teste
- [ ] Banco de dados PostgreSQL isolado (NÃO produção)
- [ ] Supabase configurado com migrations 001-006 aplicadas
- [ ] Dados de exemplo carregados (migration 003)
- [ ] Usuários de teste criados (migration 007 ou manualmente)

### 2. Usuários de Teste Necessários

Os testes requerem os seguintes usuários:

```sql
-- Verificar se usuários existem
SELECT email, role FROM profiles 
WHERE email IN (
  'admin.test@casameta.com',
  'operator1.test@casameta.com',
  'operator2.test@casameta.com',
  'viewer.test@casameta.com'
);
```

Se não existirem, criar manualmente:

```sql
-- Criar admin
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  aud, role, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin.test@casameta.com',
  crypt('AdminTest123!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Admin Test"}',
  NOW(), NOW(),
  'authenticated', 'authenticated',
  '', '', '', ''
);

INSERT INTO profiles (id, email, full_name, role)
SELECT id, email, 'Admin Test', 'admin'
FROM auth.users WHERE email = 'admin.test@casameta.com';

-- Repetir para operator1, operator2, viewer com roles apropriados
```

---

## 🚀 Passo a Passo

### Passo 1: Conectar ao Banco de Teste

```bash
# Via linha de comando
psql -h <host> -U <user> -d <database_test>

# Ou via Supabase Dashboard
# 1. Acesse https://app.supabase.com
# 2. Selecione o projeto de teste
# 3. Vá em SQL Editor
```

### Passo 2: Verificar Estado Inicial

```sql
-- Verificar migrations aplicadas
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;

-- Resultado esperado: 001, 002, 003, 004, 005, 006

-- Verificar dados de exemplo
SELECT COUNT(*) AS product_count FROM products;
SELECT COUNT(*) AS location_count FROM locations;

-- Resultado esperado: 10 produtos, 30 localizações
```

### Passo 3: Aplicar Migration 007

```sql
-- Aplicar correções da quinta rodada
\i supabase/migrations/007_fifth_round_fixes.sql
```

**Resultado Esperado:**
```
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
```

**Verificar:**
```sql
-- Verificar que funções foram atualizadas
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'confirm_shipment_picked',
  'process_receipt_atomically',
  'prevent_direct_status_change',
  'process_stock_count_adjustments',
  'log_audit_event'
);

-- Resultado esperado: 5 linhas
```

### Passo 4: Executar Testes de Regressão

```sql
-- Executar testes de regressão
\i supabase/tests/regression_tests_round5.sql
```

**Resultado Esperado:**
```
NOTA: === TESTE REG-01: Cancelamento atômico de expedição vazia ===
NOTA: ✓ Reserva criada: X (esperado: X)
NOTA: ✓ Expedição cancelada: cancelled
NOTA: ✓ Reserva liberada: X (esperado: X)
NOTA: ✓ Nenhuma movimentação de saída criada
NOTA: ✓ Evento de auditoria criado: shipment_cancelled_empty
NOTA: === TESTE REG-01: PASSOU ✓ ===

NOTA: === TESTE REG-02: Recebimento parcial não marca completed ===
NOTA: ✓ Primeira execução: status = partial
NOTA: ✓ Estoque após primeira execução: X (esperado: X)
NOTA: ✓ Segunda execução: status continua partial
NOTA: ✓ Estoque não mudou na segunda execução: X
NOTA: === TESTE REG-02: PASSOU ✓ ===

NOTA: === TESTE REG-03: prevent_direct_status_change ===
NOTA: ✓ Alteração direta para completed bloqueada
NOTA: ✓ Cancelamento legítimo permitido
NOTA: ✓ Alteração de cancelled para completed bloqueada
NOTA: === TESTE REG-03: PASSOU ✓ ===

NOTA: === TESTE REG-04: Contagem com saldo inexistente ===
NOTA: ✓ Saldo removido para teste
NOTA: ✓ Saldo criado
NOTA: ✓ Estoque ajustado: 5
NOTA: === TESTE REG-04: PASSOU ✓ ===

NOTA: === TESTE REG-05: Teste 7A sem falsos positivos ===
NOTA: ✓ Trigger bloqueou alteração: ...
NOTA: === TESTE REG-05: PASSOU ✓ ===

NOTA: === TESTE REG-06: Autorização com contextos reais ===
NOTA: ✓ Validação de propriedade implementada na função
NOTA: === TESTE REG-06: PASSOU ✓ ===

NOTA: === TESTE REG-07: log_audit_event com validação ===
NOTA: ✓ Evento inválido bloqueado: ...
NOTA: ✓ Evento válido criado
NOTA: === TESTE REG-07: PASSOU ✓ ===

NOTA: ========================================
NOTA: TESTES DE REGRESSÃO EXECUTADOS
NOTA: ========================================
NOTA: REG-01: shipment_cancelled_empty - EXECUTADO
NOTA: REG-02: process_receipt_atomically - EXECUTADO
NOTA: REG-03: prevent_direct_status_change - EXECUTADO
NOTA: REG-04: process_stock_count_adjustments - EXECUTADO
NOTA: REG-05: Teste 7A corrigido - EXECUTADO
NOTA: REG-06: Autorização com contextos - EXECUTADO
NOTA: REG-07: log_audit_event - EXECUTADO
NOTA: ========================================
```

### Passo 5: Validar Resultados

```sql
-- Verificar que não há dados residuais
SELECT COUNT(*) AS residual_shipments 
FROM shipments 
WHERE shipment_number LIKE 'TEST-REG-%';

SELECT COUNT(*) AS residual_receipts 
FROM receipts 
WHERE receipt_number LIKE 'TEST-REG-%';

SELECT COUNT(*) AS residual_movements 
FROM movements 
WHERE reference LIKE 'TEST-REG-%';

SELECT COUNT(*) AS residual_counts 
FROM stock_counts 
WHERE count_number LIKE 'TEST-REG-%';

-- Resultado esperado: 0 para todos
```

---

## 🔍 Testes Manuais Adicionais

### Teste A: Cancelamento Atômico de Expedição Vazia

```sql
-- Criar expedição
INSERT INTO shipments (shipment_number, customer_name, status, created_at)
VALUES ('MANUAL-001', 'Cliente Teste', 'pending', NOW());

-- Adicionar linha com picked = 0
INSERT INTO shipment_lines (shipment_id, product_id, requested_quantity, from_location_id, picked_quantity)
SELECT 
  (SELECT id FROM shipments WHERE shipment_number = 'MANUAL-001'),
  (SELECT id FROM products WHERE sku = 'SKU-001'),
  10,
  (SELECT id FROM locations WHERE code = 'A-01-01-01'),
  0;

-- Separar (reservar)
SELECT reserve_stock_for_shipment(
  (SELECT id FROM shipments WHERE shipment_number = 'MANUAL-001')
);

-- Confirmar com picked = 0 (deve cancelar)
UPDATE shipments SET status = 'picking' WHERE shipment_number = 'MANUAL-001';

SELECT confirm_shipment_picked(
  (SELECT id FROM shipments WHERE shipment_number = 'MANUAL-001')
);

-- Verificar status
SELECT status FROM shipments WHERE shipment_number = 'MANUAL-001';
-- Resultado esperado: cancelled

-- Verificar que reservas foram liberadas
-- (deve voltar ao estado inicial)

-- Limpar
DELETE FROM shipment_lines WHERE shipment_id = (SELECT id FROM shipments WHERE shipment_number = 'MANUAL-001');
DELETE FROM shipments WHERE shipment_number = 'MANUAL-001';
```

### Teste B: Recebimento Parcial - Segunda Execução

```sql
-- Criar recebimento
INSERT INTO receipts (receipt_number, supplier_name, status, created_at)
VALUES ('MANUAL-002', 'Fornecedor Teste', 'pending', NOW());

-- Adicionar linha com expected = 20, received = 10
INSERT INTO receipt_lines (receipt_id, product_id, expected_quantity, received_quantity, location_id)
SELECT 
  (SELECT id FROM receipts WHERE receipt_number = 'MANUAL-002'),
  (SELECT id FROM products WHERE sku = 'SKU-002'),
  20,
  10,
  (SELECT id FROM locations WHERE code = 'A-02-01-01');

-- Primeira execução
SELECT process_receipt_atomically(
  (SELECT id FROM receipts WHERE receipt_number = 'MANUAL-002')
);

-- Verificar status
SELECT status FROM receipts WHERE receipt_number = 'MANUAL-002';
-- Resultado esperado: partial

-- Segunda execução
SELECT process_receipt_atomically(
  (SELECT id FROM receipts WHERE receipt_number = 'MANUAL-002')
);

-- Verificar que status AINDA é partial
SELECT status FROM receipts WHERE receipt_number = 'MANUAL-002';
-- Resultado esperado: partial (NÃO completed)

-- Limpar
DELETE FROM movement_lines WHERE movement_id IN (
  SELECT id FROM movements WHERE source_reference = 'MANUAL-002'
);
DELETE FROM movements WHERE source_reference = 'MANUAL-002';
DELETE FROM receipt_lines WHERE receipt_id = (SELECT id FROM receipts WHERE receipt_number = 'MANUAL-002');
DELETE FROM receipts WHERE receipt_number = 'MANUAL-002';
```

### Teste C: Contagem com Saldo Inexistente

```sql
-- Remover saldo se existir
DELETE FROM stock_balances
WHERE product_id = (SELECT id FROM products WHERE sku = 'SKU-003')
  AND location_id = (SELECT id FROM locations WHERE code = 'A-02-01-02');

-- Verificar que não existe
SELECT COUNT(*) FROM stock_balances
WHERE product_id = (SELECT id FROM products WHERE sku = 'SKU-003')
  AND location_id = (SELECT id FROM locations WHERE code = 'A-02-01-02');
-- Resultado esperado: 0

-- Criar contagem
INSERT INTO stock_counts (count_number, count_type, status, created_at)
VALUES ('MANUAL-003', 'cycle', 'pending', NOW());

-- Adicionar linha com divergência positiva
INSERT INTO stock_count_lines (stock_count_id, product_id, location_id, system_quantity, counted_quantity)
SELECT 
  (SELECT id FROM stock_counts WHERE count_number = 'MANUAL-003'),
  (SELECT id FROM products WHERE sku = 'SKU-003'),
  (SELECT id FROM locations WHERE code = 'A-02-01-02'),
  0,
  5;

-- Iniciar contagem
UPDATE stock_counts SET status = 'in_progress' WHERE count_number = 'MANUAL-003';

-- Processar ajustes (deve criar saldo)
SELECT process_stock_count_adjustments(
  (SELECT id FROM stock_counts WHERE count_number = 'MANUAL-003')
);

-- Verificar que saldo foi criado
SELECT quantity FROM stock_balances
WHERE product_id = (SELECT id FROM products WHERE sku = 'SKU-003')
  AND location_id = (SELECT id FROM locations WHERE code = 'A-02-01-02');
-- Resultado esperado: 5

-- Limpar
DELETE FROM stock_count_lines WHERE stock_count_id = (SELECT id FROM stock_counts WHERE count_number = 'MANUAL-003');
DELETE FROM stock_counts WHERE count_number = 'MANUAL-003';
DELETE FROM movement_lines WHERE movement_id IN (
  SELECT id FROM movements WHERE source_reference = 'MANUAL-003'
);
DELETE FROM movements WHERE source_reference = 'MANUAL-003';
DELETE FROM stock_balances
WHERE product_id = (SELECT id FROM products WHERE sku = 'SKU-003')
  AND location_id = (SELECT id FROM locations WHERE code = 'A-02-01-02');
```

---

## 📊 Checklist de Validação

### Migration 007
- [ ] Função `confirm_shipment_picked` atualizada
- [ ] Função `process_receipt_atomically` atualizada
- [ ] Função `prevent_direct_status_change` atualizada
- [ ] Função `process_stock_count_adjustments` atualizada
- [ ] Função `log_audit_event` atualizada

### Testes de Regressão
- [ ] REG-01 passou (cancelamento atômico)
- [ ] REG-02 passou (recebimento parcial)
- [ ] REG-03 passou (prevent_direct_status_change)
- [ ] REG-04 passou (contagem com saldo inexistente)
- [ ] REG-05 passou (teste 7A sem falsos positivos)
- [ ] REG-06 passou (autorização com contextos)
- [ ] REG-07 passou (log_audit_event)

### Testes Manuais
- [ ] Teste A: Cancelamento atômico funciona
- [ ] Teste B: Recebimento parcial não marca completed
- [ ] Teste C: Contagem cria saldo se não existir

### Limpeza
- [ ] Nenhum dado residual (TEST-REG-% ou MANUAL-%)
- [ ] Estoque no estado original

---

## 🐛 Solução de Problemas

### Erro: "function does not exist"
**Causa:** Migration 007 não foi aplicada  
**Solução:** Aplicar migration 007

### Erro: "usuário não encontrado"
**Causa:** Usuários de teste não foram criados  
**Solução:** Criar usuários manualmente (ver pré-requisitos)

### Erro: "saldo não encontrado"
**Causa:** Dados de exemplo não foram carregados  
**Solução:** Aplicar migration 003

### Teste falha com "Exceção inesperada"
**Causa:** Comportamento diferente do esperado  
**Solução:** 
1. Verificar mensagem de erro exata
2. Consultar `ROUND5_FINAL_REPORT.md`
3. Verificar se migrations estão na ordem correta

### Dados residuais após testes
**Causa:** Teste falhou antes da limpeza  
**Solução:**
```sql
-- Limpar manualmente
DELETE FROM shipments WHERE shipment_number LIKE 'TEST-REG-%' OR shipment_number LIKE 'MANUAL-%';
DELETE FROM shipment_lines WHERE shipment_id IN (SELECT id FROM shipments WHERE shipment_number LIKE 'TEST-REG-%' OR shipment_number LIKE 'MANUAL-%');
DELETE FROM receipts WHERE receipt_number LIKE 'TEST-REG-%' OR receipt_number LIKE 'MANUAL-%';
DELETE FROM receipt_lines WHERE receipt_id IN (SELECT id FROM receipts WHERE receipt_number LIKE 'TEST-REG-%' OR receipt_number LIKE 'MANUAL-%');
DELETE FROM movements WHERE reference LIKE 'TEST-REG-%' OR reference LIKE 'MANUAL-%';
DELETE FROM movement_lines WHERE movement_id IN (SELECT id FROM movements WHERE reference LIKE 'TEST-REG-%' OR reference LIKE 'MANUAL-%');
DELETE FROM stock_counts WHERE count_number LIKE 'TEST-REG-%' OR count_number LIKE 'MANUAL-%';
DELETE FROM stock_count_lines WHERE stock_count_id IN (SELECT id FROM stock_counts WHERE count_number LIKE 'TEST-REG-%' OR count_number LIKE 'MANUAL-%');
```

---

## 📞 Suporte

**Documentação:**
- `ROUND5_FINAL_REPORT.md` - Relatório técnico completo
- `ROUND5_SUMMARY.md` - Resumo executivo
- `supabase/migrations/007_fifth_round_fixes.sql` - Migration
- `supabase/tests/regression_tests_round5.sql` - Testes

**Próximos Passos:**
1. Executar todos os testes
2. Validar resultados
3. Documentar quaisquer problemas
4. Só então considerar para produção

---

**Última atualização:** 2026-01-16  
**Versão:** 1.4.0
