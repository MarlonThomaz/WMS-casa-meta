# 🧪 Guia de Execução de Testes - Sexta Rodada Corretiva
## WMS Casa Meta - Validação Completa

## ⚠️ AVISO IMPORTANTE

**NÃO execute estes testes em produção!**

**Pré-requisitos:**
- Banco de dados PostgreSQL isolado (NÃO produção)
- Supabase configurado
- Acesso de superusuário ao banco

---

## 🚀 Passo a Passo

### Passo 1: Conectar ao Banco de Teste

```bash
psql -h <host> -U <user> -d <database_test>
```

### Passo 2: Aplicar Migrations

```sql
-- Aplicar estrutura completa
\i supabase/migrations/001_initial_schema.sql

-- Aplicar funções transacionais
\i supabase/migrations/002_functions.sql
```

**Resultado Esperado:**
```
CREATE EXTENSION
CREATE SEQUENCE (x6)
CREATE TABLE (x14)
CREATE INDEX (x10)
CREATE FUNCTION (x3)
CREATE TRIGGER (x7)
ALTER TABLE (x14)
CREATE POLICY (x20+)
CREATE FUNCTION (x15+)
REVOKE (x16)
GRANT (x16)
```

### Passo 3: Executar Testes

```sql
\i supabase/tests/regression_tests_round6.sql
```

**Resultado Esperado:**
```
NOTA: === SETUP: Criando usuários de teste ===
NOTA: ✓ Admin criado
NOTA: ✓ Operator criado
NOTA: ✓ Viewer criado
NOTA: === SETUP: Concluído ===

NOTA: === TESTE REG-01A: Recebimento integral pending → completed ===
NOTA: === TESTE REG-01A: PASSOU ✓ ===

NOTA: === TESTE REG-01B: Recebimento parcial pending → partial ===
NOTA: === TESTE REG-01B: PASSOU ✓ ===

NOTA: === TESTE REG-01C: Segunda execução não marca completed ===
NOTA: === TESTE REG-01C: PASSOU ✓ ===

NOTA: === TESTE REG-03: prevent_direct_status_change sem falsos positivos ===
NOTA: === TESTE REG-03: PASSOU ✓ ===

NOTA: === TESTE REG-04: Contagem com movimento concorrente ===
NOTA: === TESTE REG-04: PASSOU ✓ ===

NOTA: === TESTE REG-05: Contagem sem saldo prévio ===
NOTA: === TESTE REG-05: PASSOU ✓ ===

NOTA: === TESTE REG-06A: Operator não pode processar movimentação de outro ===
NOTA: ✓ Validação de propriedade implementada na função process_stock_movement
NOTA: ✓ Operator não pode processar movimentação criada por admin
NOTA: === TESTE REG-06A: PASSOU ✓ ===

NOTA: === TESTE REG-07: log_audit_event sem falsos positivos ===
NOTA: ✓ Evento inválido bloqueado: ...
NOTA: ✓ Evento válido criado
NOTA: === TESTE REG-07: PASSOU ✓ ===

NOTA: === TESTE REG-08: Cancelamento atômico de expedição vazia ===
NOTA: === TESTE REG-08: PASSOU ✓ ===

NOTA: ========================================
NOTA: TESTES DE REGRESSÃO EXECUTADOS
NOTA: ========================================
NOTA: REG-01A: Recebimento integral - EXECUTADO
NOTA: REG-01B: Recebimento parcial - EXECUTADO
NOTA: REG-01C: Segunda execução - EXECUTADO
NOTA: REG-03: prevent_direct_status_change - EXECUTADO
NOTA: REG-04: Movimento concorrente - EXECUTADO
NOTA: REG-05: Saldo inexistente - EXECUTADO
NOTA: REG-06A: Autorização - EXECUTADO
NOTA: REG-07: log_audit_event - EXECUTADO
NOTA: REG-08: Cancelamento atômico - EXECUTADO
NOTA: ========================================
```

### Passo 4: Validar Resultados

```sql
-- Verificar usuários de teste
SELECT email, role FROM profiles WHERE email LIKE '%.test@casameta.com';
-- Esperado: 3 linhas (admin, operator, viewer)

-- Verificar que não há dados residuais
SELECT COUNT(*) FROM receipts WHERE receipt_number LIKE 'TEST-%';
SELECT COUNT(*) FROM shipments WHERE shipment_number LIKE 'TEST-%';
SELECT COUNT(*) FROM movements WHERE reference LIKE 'TEST-%';
SELECT COUNT(*) FROM stock_counts WHERE count_number LIKE 'TEST-%';
-- Esperado: 0 para todos
```

---

## 🔍 Testes Manuais Adicionais

### Teste A: Recebimento Integral

```sql
-- Criar recebimento integral
INSERT INTO receipts (receipt_number, supplier_name, status, created_at)
VALUES ('MANUAL-001', 'Fornecedor', 'pending', NOW());

INSERT INTO receipt_lines (receipt_id, product_id, expected_quantity, received_quantity, location_id)
SELECT (SELECT id FROM receipts WHERE receipt_number = 'MANUAL-001'),
  (SELECT id FROM products WHERE sku = 'SKU-001'),
  20, 20, (SELECT id FROM locations WHERE code = 'A-01-01-01');

-- Processar
SELECT process_receipt_atomically((SELECT id FROM receipts WHERE receipt_number = 'MANUAL-001'));

-- Verificar status
SELECT status FROM receipts WHERE receipt_number = 'MANUAL-001';
-- Esperado: completed

-- Limpar
DELETE FROM movement_lines WHERE movement_id IN (SELECT id FROM movements WHERE source_reference = 'MANUAL-001');
DELETE FROM movements WHERE source_reference = 'MANUAL-001';
DELETE FROM receipt_lines WHERE receipt_id = (SELECT id FROM receipts WHERE receipt_number = 'MANUAL-001');
DELETE FROM receipts WHERE receipt_number = 'MANUAL-001';
```

### Teste B: Recebimento Parcial - Segunda Execução

```sql
-- Criar recebimento parcial
INSERT INTO receipts (receipt_number, supplier_name, status, created_at)
VALUES ('MANUAL-002', 'Fornecedor', 'pending', NOW());

INSERT INTO receipt_lines (receipt_id, product_id, expected_quantity, received_quantity, location_id)
SELECT (SELECT id FROM receipts WHERE receipt_number = 'MANUAL-002'),
  (SELECT id FROM products WHERE sku = 'SKU-002'),
  20, 10, (SELECT id FROM locations WHERE code = 'A-02-01-01');

-- Primeira execução
SELECT process_receipt_atomically((SELECT id FROM receipts WHERE receipt_number = 'MANUAL-002'));
SELECT status FROM receipts WHERE receipt_number = 'MANUAL-002';
-- Esperado: partial

-- Segunda execução
SELECT process_receipt_atomically((SELECT id FROM receipts WHERE receipt_number = 'MANUAL-002'));
SELECT status FROM receipts WHERE receipt_number = 'MANUAL-002';
-- Esperado: partial (NÃO completed)

-- Limpar
DELETE FROM movement_lines WHERE movement_id IN (SELECT id FROM movements WHERE source_reference = 'MANUAL-002');
DELETE FROM movements WHERE source_reference = 'MANUAL-002';
DELETE FROM receipt_lines WHERE receipt_id = (SELECT id FROM receipts WHERE receipt_number = 'MANUAL-002');
DELETE FROM receipts WHERE receipt_number = 'MANUAL-002';
```

### Teste C: Cancelamento Atômico de Expedição Vazia

```sql
-- Criar expedição
INSERT INTO shipments (shipment_number, customer_name, status, created_at)
VALUES ('MANUAL-003', 'Cliente', 'pending', NOW());

INSERT INTO shipment_lines (shipment_id, product_id, requested_quantity, from_location_id, picked_quantity)
SELECT (SELECT id FROM shipments WHERE shipment_number = 'MANUAL-003'),
  (SELECT id FROM products WHERE sku = 'SKU-003'),
  10, (SELECT id FROM locations WHERE code = 'A-02-01-02'), 0;

-- Separar (reservar)
SELECT reserve_stock_for_shipment((SELECT id FROM shipments WHERE shipment_number = 'MANUAL-003'));

-- Confirmar com picked = 0 (deve cancelar)
UPDATE shipments SET status = 'picking' WHERE shipment_number = 'MANUAL-003';
SELECT confirm_shipment_picked((SELECT id FROM shipments WHERE shipment_number = 'MANUAL-003'));

-- Verificar status
SELECT status FROM shipments WHERE shipment_number = 'MANUAL-003';
-- Esperado: cancelled

-- Verificar que reservas foram liberadas
-- (deve voltar ao estado inicial)

-- Limpar
DELETE FROM shipment_lines WHERE shipment_id = (SELECT id FROM shipments WHERE shipment_number = 'MANUAL-003');
DELETE FROM shipments WHERE shipment_number = 'MANUAL-003';
```

---

## 📊 Checklist de Validação

### Migrations
- [ ] Migration 001 aplicada sem erros
- [ ] Migration 002 aplicada sem erros
- [ ] Todas as tabelas criadas
- [ ] Todas as funções criadas
- [ ] Todas as políticas RLS criadas

### Testes Automatizados
- [ ] REG-01A passou (recebimento integral)
- [ ] REG-01B passou (recebimento parcial)
- [ ] REG-01C passou (segunda execução)
- [ ] REG-03 passou (prevent_direct_status_change)
- [ ] REG-04 passou (movimento concorrente)
- [ ] REG-05 passou (saldo inexistente)
- [ ] REG-06A passou (autorização)
- [ ] REG-07 passou (log_audit_event)
- [ ] REG-08 passou (cancelamento atômico)

### Testes Manuais
- [ ] Teste A: Recebimento integral funciona
- [ ] Teste B: Recebimento parcial não marca completed
- [ ] Teste C: Cancelamento atômico funciona

### Limpeza
- [ ] Nenhum dado residual (TEST-% ou MANUAL-%)
- [ ] Estoque no estado original
- [ ] Usuários de teste podem ser removidos (opcional)

---

## 🐛 Solução de Problemas

### Erro: "relation does not exist"
**Causa:** Migration 001 não foi aplicada  
**Solução:** Aplicar migration 001 primeiro

### Erro: "function does not exist"
**Causa:** Migration 002 não foi aplicada  
**Solução:** Aplicar migration 002

### Erro: "permission denied"
**Causa:** Usuário não tem permissões suficientes  
**Solução:** Conectar como superusuário

### Teste falha com "Exceção inesperada"
**Causa:** Comportamento diferente do esperado  
**Solução:**
1. Verificar mensagem de erro exata
2. Consultar `ROUND6_FINAL_REPORT.md`
3. Verificar se migrations estão na ordem correta

### Dados residuais após testes
**Causa:** Teste falhou antes da limpeza  
**Solução:**
```sql
SELECT cleanup_test_data();
```

---

## 📞 Suporte

**Documentação:**
- `ROUND6_FINAL_REPORT.md` - Relatório técnico completo
- `ROUND6_SUMMARY.md` - Resumo executivo
- `REPOSITORY_STATUS.md` - Status do repositório

**Próximos Passos:**
1. Executar todos os testes
2. Validar resultados
3. Documentar quaisquer problemas
4. Só então considerar para produção

---

**Última atualização:** 2026-01-16  
**Versão:** 1.5.0
