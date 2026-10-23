# 🧪 Guia de Execução de Testes - Quarta Rodada Corretiva
## WMS Casa Meta - Auditoria Estática

## ⚠️ AVISO IMPORTANTE

**NÃO execute estes testes em produção!**

Estes testes:
- Criam usuários de teste
- Modificam dados de estoque
- Criam e deletam registros
- Podem deixar resíduos se falharem

**Execute APENAS em ambiente de teste isolado.**

---

## 📋 Pré-requisitos

### 1. Ambiente de Teste
- [ ] Banco de dados PostgreSQL isolado (NÃO produção)
- [ ] Supabase configurado com migrations 001-005 aplicadas
- [ ] Dados de exemplo carregados (migration 003)
- [ ] Acesso de superusuário ao banco

### 2. Ferramentas
- [ ] `psql` instalado e configurado
- [ ] Conexão ao banco de teste funcionando
- [ ] Permissões para criar usuários e executar funções

---

## 🚀 Passo a Passo

### Passo 1: Conectar ao Banco de Teste

```bash
# Opção 1: Via linha de comando
psql -h <host> -U <user> -d <database_test>

# Opção 2: Via Supabase Dashboard
# 1. Acesse https://app.supabase.com
# 2. Selecione o projeto de teste
# 3. Vá em SQL Editor
# 4. Cole os comandos abaixo
```

### Passo 2: Verificar Estado Inicial

```sql
-- Verificar se migrations 001-005 estão aplicadas
SELECT version, name 
FROM supabase_migrations.schema_migrations 
ORDER BY version;

-- Resultado esperado:
-- 001_initial_schema
-- 002_stock_engine
-- 003_seed_data
-- 004_security_fixes
-- 005_critical_fixes

-- Verificar se dados de exemplo existem
SELECT COUNT(*) AS product_count FROM products;
SELECT COUNT(*) AS location_count FROM locations;
SELECT COUNT(*) AS balance_count FROM stock_balances;

-- Resultado esperado:
-- product_count: 10
-- location_count: 30
-- balance_count: 12
```

### Passo 3: Aplicar Migration 006

```sql
-- Aplicar correções de segurança e integridade
\i supabase/migrations/006_security_integrity_fixes.sql

-- Ou copiar e colar o conteúdo do arquivo
```

**Resultado Esperado:**
```
REVOKE
REVOKE
REVOKE
REVOKE
REVOKE
GRANT
GRANT
GRANT
GRANT
GRANT
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE TRIGGER
CREATE TRIGGER
CREATE TRIGGER
CREATE FUNCTION
CREATE FUNCTION
```

**Verificar:**
```sql
-- Verificar se funções foram revogadas do PUBLIC
SELECT grantee, routine_name
FROM information_schema.routine_privileges
WHERE routine_name IN (
  'get_product_total_stock',
  'get_product_stock_by_location',
  'get_location_occupancy',
  'find_product_by_barcode',
  'get_products_with_stock'
)
AND grantee = 'PUBLIC';

-- Resultado esperado: 0 linhas (nenhuma permissão para PUBLIC)

-- Verificar se triggers foram criados
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_prevent_update_%';

-- Resultado esperado: 3 linhas (receipt_lines, shipment_lines, stock_count_lines)
```

### Passo 4: Executar Testes Corrigidos

```sql
-- Executar testes com autenticação
\i supabase/tests/validation_tests_v3.sql

-- Ou copiar e colar o conteúdo do arquivo
```

**Resultado Esperado:**
```
NOTA: === SETUP: Criando usuários de teste ===
NOTA: ✓ Admin criado: admin.test@casameta.com / AdminTest123!
NOTA: ✓ Operator1 criado: operator1.test@casameta.com / Operator1Test123!
NOTA: ✓ Operator2 criado: operator2.test@casameta.com / Operator2Test123!
NOTA: ✓ Viewer criado: viewer.test@casameta.com / ViewerTest123!
NOTA: === SETUP: Concluído ===
NOTA: === TESTE 1: Confirmar recebimento duas vezes ===
NOTA: ✓ Primeira confirmação executada com sucesso
NOTA: ✓ Estoque após primeira confirmação: X (esperado: X)
NOTA: ✓ Segunda confirmação bloqueada corretamente: ...
NOTA: === TESTE 1: PASSOU ✓ ===
NOTA: === TESTE 2: Iniciar separação duas vezes ===
NOTA: ✓ Primeira separação executada com sucesso
NOTA: ✓ Reserva após primeira separação: X (esperado: X)
NOTA: ✓ Segunda separação bloqueada corretamente: ...
NOTA: === TESTE 2: PASSOU ✓ ===
NOTA: === TESTE 3: Liberar reservas idempotente ===
NOTA: ✓ Primeira liberação: reserva voltou para X
NOTA: ✓ Segunda liberação: reserva permaneceu em X (IDEMPOTENTE)
NOTA: === TESTE 3: PASSOU ✓ ===
NOTA: === TESTE 4A: Constraint picked <= requested ===
NOTA: ✓ Constraint bloqueou corretamente: ...
NOTA: === TESTE 4A: PASSOU ✓ ===
NOTA: === TESTE 4B: Validação da função confirm_shipment_picked ===
NOTA: ✓ Confirmação com picked = requested funcionou
NOTA: === TESTE 4B: PASSOU ✓ ===
NOTA: === TESTE 7A: Alteração direta deve ser bloqueada ===
NOTA: ✓ Trigger bloqueou alteração direta
NOTA: === TESTE 7A: PASSOU ✓ ===
NOTA: === TESTE 7B: Alteração via função deve funcionar ===
NOTA: ✓ Função process_stock_movement executada com sucesso
NOTA: ✓ Status alterado para completed via função
NOTA: === TESTE 7B: PASSOU ✓ ===
NOTA: === TESTE 8A: Recebimento com linhas repetidas ===
NOTA: ✓ Ambas as linhas foram processadas: estoque aumentou em 15
NOTA: === TESTE 8A: PASSOU ✓ ===
NOTA: === TESTE 8B: IDs inexistentes ===
NOTA: ✓ Função validou ID inexistente: ...
NOTA: === TESTE 8B: PASSOU ✓ ===
NOTA: ========================================
NOTA: TODOS OS TESTES FORAM EXECUTADOS
NOTA: ========================================
NOTA: Todas as correções validadas com sucesso!
```

### Passo 5: Validar Resultados

```sql
-- Verificar se usuários de teste foram criados
SELECT email, role 
FROM profiles 
WHERE email LIKE '%.test@casameta.com';

-- Resultado esperado: 4 linhas (admin, operator1, operator2, viewer)

-- Verificar se não há dados residuais
SELECT COUNT(*) AS residual_receipts 
FROM receipts 
WHERE receipt_number LIKE 'TEST-%';

SELECT COUNT(*) AS residual_shipments 
FROM shipments 
WHERE shipment_number LIKE 'TEST-%';

SELECT COUNT(*) AS residual_movements 
FROM movements 
WHERE reference LIKE 'TEST-%';

-- Resultado esperado: 0 para todos
```

---

## 🔍 Testes Manuais Adicionais

### Teste A: Política de Profiles

```sql
-- Conectar como operator
SET ROLE 'operator1.test@casameta.com';

-- Tentar alterar próprio role (deve falhar)
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'operator1.test@casameta.com';

-- Resultado esperado: ERRO ou 0 rows affected

-- Voltar para superusuário
RESET ROLE;

-- Conectar como admin
SET ROLE 'admin.test@casameta.com';

-- Alterar role de outro usuário (deve funcionar)
UPDATE profiles 
SET role = 'manager' 
WHERE email = 'operator1.test@casameta.com';

-- Resultado esperado: 1 row affected

-- Voltar role ao original
UPDATE profiles 
SET role = 'operator' 
WHERE email = 'operator1.test@casameta.com';

RESET ROLE;
```

### Teste B: Validação de Propriedade

```sql
-- Conectar como operator1
SET ROLE 'operator1.test@casameta.com';

-- Criar movimentação
INSERT INTO movements (reference, movement_type, status, created_by, created_at)
VALUES (
  'MANUAL-TEST-001',
  'inbound',
  'pending',
  auth.uid(),
  NOW()
);

-- Voltar para superusuário
RESET ROLE;

-- Conectar como operator2
SET ROLE 'operator2.test@casameta.com';

-- Tentar processar movimentação de operator1 (deve falhar)
INSERT INTO movement_lines (movement_id, product_id, to_location_id, quantity)
SELECT 
  (SELECT id FROM movements WHERE reference = 'MANUAL-TEST-001'),
  (SELECT id FROM products WHERE sku = 'SKU-001'),
  (SELECT id FROM locations WHERE code = 'A-01-01-01'),
  5;

SELECT process_stock_movement(
  (SELECT id FROM movements WHERE reference = 'MANUAL-TEST-001'),
  auth.uid()
);

-- Resultado esperado: ERRO "Operador só pode processar suas próprias movimentações"

RESET ROLE;

-- Conectar como admin
SET ROLE 'admin.test@casameta.com';

-- Processar como admin (deve funcionar)
SELECT process_stock_movement(
  (SELECT id FROM movements WHERE reference = 'MANUAL-TEST-001'),
  auth.uid()
);

-- Resultado esperado: Sucesso

-- Limpar
DELETE FROM movement_lines WHERE movement_id = (SELECT id FROM movements WHERE reference = 'MANUAL-TEST-001');
DELETE FROM movements WHERE reference = 'MANUAL-TEST-001';

-- Restaurar estoque
UPDATE stock_balances
SET quantity = quantity - 5
WHERE product_id = (SELECT id FROM products WHERE sku = 'SKU-001')
  AND location_id = (SELECT id FROM locations WHERE code = 'A-01-01-01');

RESET ROLE;
```

### Teste C: Liberação de Reservas Idempotente

```sql
-- Criar expedição
INSERT INTO shipments (shipment_number, customer_name, status, created_at)
VALUES ('MANUAL-TEST-002', 'Cliente Teste', 'pending', NOW());

-- Adicionar linha
INSERT INTO shipment_lines (shipment_id, product_id, requested_quantity, from_location_id)
SELECT 
  (SELECT id FROM shipments WHERE shipment_number = 'MANUAL-TEST-002'),
  (SELECT id FROM products WHERE sku = 'SKU-002'),
  5,
  (SELECT id FROM locations WHERE code = 'A-02-01-01');

-- Separar
SELECT reserve_stock_for_shipment(
  (SELECT id FROM shipments WHERE shipment_number = 'MANUAL-TEST-002')
);

-- Cancelar expedição (libera reservas)
UPDATE shipments 
SET status = 'cancelled' 
WHERE shipment_number = 'MANUAL-TEST-002';

SELECT release_shipment_reservations(
  (SELECT id FROM shipments WHERE shipment_number = 'MANUAL-TEST-002')
);

-- Resultado esperado: Sucesso

-- Tentar liberar novamente (deve ser idempotente - não fazer nada)
SELECT release_shipment_reservations(
  (SELECT id FROM shipments WHERE shipment_number = 'MANUAL-TEST-002')
);

-- Resultado esperado: Sucesso (sem erro, sem alteração)

-- Limpar
DELETE FROM shipment_lines WHERE shipment_id = (SELECT id FROM shipments WHERE shipment_number = 'MANUAL-TEST-002');
DELETE FROM shipments WHERE shipment_number = 'MANUAL-TEST-002';
```

---

## 📊 Checklist de Validação

### Migration 006
- [ ] Funções de leitura revogadas do PUBLIC
- [ ] Função log_audit_event com validação de eventos
- [ ] Função prevent_direct_status_change corrigida
- [ ] Triggers prevent_update_after_completion criados
- [ ] Função release_shipment_reservations idempotente
- [ ] Função confirm_shipment_picked com separação parcial
- [ ] Função process_receipt_atomically com controle por linha
- [ ] Função process_stock_count_adjustments com validação de IDs

### Testes Automatizados
- [ ] Teste 1 passou (recebimento não duplica)
- [ ] Teste 2 passou (separação não duplica)
- [ ] Teste 3 passou (liberação idempotente)
- [ ] Teste 4A passou (constraint funciona)
- [ ] Teste 4B passou (função valida)
- [ ] Teste 7A passou (alteração direta bloqueada)
- [ ] Teste 7B passou (alteração via função funciona)
- [ ] Teste 8A passou (linhas repetidas processadas)
- [ ] Teste 8B passou (IDs inexistentes validados)
- [ ] Nenhum dado residual
- [ ] Estoque restaurado

### Testes Manuais
- [ ] Teste A: Política de profiles funciona
- [ ] Teste B: Validação de propriedade funciona
- [ ] Teste C: Liberação de reservas idempotente

### Limpeza
- [ ] Usuários de teste podem ser removidos (opcional)
- [ ] Nenhum dado de teste restante
- [ ] Estoque no estado original

---

## 🐛 Solução de Problemas

### Erro: "relation does not exist"
**Causa:** Migrations 001-005 não foram aplicadas  
**Solução:** Aplicar migrations na ordem correta

### Erro: "permission denied"
**Causa:** Usuário não tem permissões suficientes  
**Solução:** Conectar como superusuário ou usuário com privilégios

### Erro: "function does not exist"
**Causa:** Migration 006 não foi aplicada  
**Solução:** Aplicar migration 006

### Teste falha com "Exceção inesperada"
**Causa:** Comportamento diferente do esperado  
**Solução:** 
1. Verificar mensagem de erro exata
2. Consultar `ROUND4_FINAL_REPORT.md`
3. Verificar se migrations estão na ordem correta

### Dados residuais após testes
**Causa:** Teste falhou antes da limpeza  
**Solução:**
```sql
-- Limpar manualmente
SELECT cleanup_test_data();
```

---

## 📞 Suporte

**Documentação:**
- `ROUND4_FINAL_REPORT.md` - Relatório completo
- `supabase/migrations/006_security_integrity_fixes.sql` - Migration
- `supabase/tests/validation_tests_v3.sql` - Testes

**Próximos Passos:**
1. Executar todos os testes
2. Validar resultados
3. Documentar quaisquer problemas
4. Só então considerar para produção

---

**Última atualização:** 2026-01-16  
**Versão:** 1.3.0
