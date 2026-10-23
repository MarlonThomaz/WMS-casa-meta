# 🧪 Guia de Execução de Testes - WMS Casa Meta

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
- [ ] Supabase configurado com migrations 001-004 aplicadas
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
-- Verificar se migrations 001-004 estão aplicadas
SELECT version, name 
FROM supabase_migrations.schema_migrations 
ORDER BY version;

-- Resultado esperado:
-- 001_initial_schema
-- 002_stock_engine
-- 003_seed_data
-- 004_security_fixes

-- Verificar se dados de exemplo existem
SELECT COUNT(*) AS product_count FROM products;
SELECT COUNT(*) AS location_count FROM locations;
SELECT COUNT(*) AS balance_count FROM stock_balances;

-- Resultado esperado:
-- product_count: 10
-- location_count: 30
-- balance_count: 12
```

### Passo 3: Aplicar Migration 005

```sql
-- Aplicar correções críticas
\i supabase/migrations/005_critical_fixes.sql

-- Ou copiar e colar o conteúdo do arquivo
```

**Resultado Esperado:**
```
DROP POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
ALTER TABLE
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
```

**Verificar:**
```sql
-- Verificar se política foi criada
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'profiles' 
AND policyname = 'profiles_update_self_safe';

-- Resultado esperado: 1 linha

-- Verificar se campo foi adicionado
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'shipment_lines' 
AND column_name = 'reservations_released';

-- Resultado esperado: 1 linha
```

### Passo 4: Executar Testes Corrigidos

```sql
-- Executar testes com autenticação
\i supabase/tests/validation_tests_v2.sql

-- Ou copiar e colar o conteúdo do arquivo
```

**Resultado Esperado:**
```
NOTA: Usuários de teste criados com sucesso
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
NOTA: === TESTE 7A: Alteração direta deve ser bloqueada ===
NOTA: ✓ Trigger bloqueou alteração direta
NOTA: === TESTE 7A: PASSOU ✓ ===
NOTA: === TESTE 7B: Alteração via função deve funcionar ===
NOTA: ✓ Função process_stock_movement executada com sucesso
NOTA: ✓ Status alterado para completed via função
NOTA: === TESTE 7B: PASSOU ✓ ===
NOTA: ========================================
NOTA: TESTES CORIGIDOS EXECUTADOS
NOTA: ========================================
NOTA: Todas as correções validadas com sucesso!
```

### Passo 5: Validar Resultados

```sql
-- Verificar se usuários de teste foram criados
SELECT email, role 
FROM profiles 
WHERE email IN ('admin@test.com', 'operator@test.com', 'viewer@test.com');

-- Resultado esperado: 3 linhas

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
SET ROLE 'operator@test.com';

-- Tentar alterar próprio role (deve falhar)
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'operator@test.com';

-- Resultado esperado: ERRO ou 0 rows affected

-- Voltar para superusuário
RESET ROLE;

-- Conectar como admin
SET ROLE 'admin@test.com';

-- Alterar role de outro usuário (deve funcionar)
UPDATE profiles 
SET role = 'manager' 
WHERE email = 'operator@test.com';

-- Resultado esperado: 1 row affected

-- Voltar role ao original
UPDATE profiles 
SET role = 'operator' 
WHERE email = 'operator@test.com';

RESET ROLE;
```

### Teste B: Validação de Propriedade

```sql
-- Criar movimentação como operator
SET ROLE 'operator@test.com';

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

-- Tentar processar como outro operator (deve falhar)
SET ROLE 'viewer@test.com';

SELECT process_stock_movement(
  (SELECT id FROM movements WHERE reference = 'MANUAL-TEST-001'),
  auth.uid()
);

-- Resultado esperado: ERRO "Operador só pode processar suas próprias movimentações"

RESET ROLE;

-- Processar como admin (deve funcionar)
SET ROLE 'admin@test.com';

-- Primeiro adicionar linha à movimentação
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

### Teste C: Liberação de Reservas

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

-- Tentar liberar novamente (deve falhar)
SELECT release_shipment_reservations(
  (SELECT id FROM shipments WHERE shipment_number = 'MANUAL-TEST-002')
);

-- Resultado esperado: ERRO "Reservas desta expedição já foram liberadas"

-- Limpar
DELETE FROM shipment_lines WHERE shipment_id = (SELECT id FROM shipments WHERE shipment_number = 'MANUAL-TEST-002');
DELETE FROM shipments WHERE shipment_number = 'MANUAL-TEST-002';
```

---

## 📊 Checklist de Validação

### Migration 005
- [ ] Política `profiles_update_self_safe` criada
- [ ] Campo `reservations_released` adicionado
- [ ] Função `release_shipment_reservations` atualizada
- [ ] Função `process_stock_movement` atualizada
- [ ] Função `reserve_stock_for_shipment` atualizada
- [ ] Função `confirm_shipment_picked` atualizada

### Testes Automatizados
- [ ] Teste 1 passou (recebimento não duplica)
- [ ] Teste 2 passou (separação não duplica)
- [ ] Teste 7A passou (alteração direta bloqueada)
- [ ] Teste 7B passou (alteração via função funciona)
- [ ] Nenhum dado residual
- [ ] Estoque restaurado

### Testes Manuais
- [ ] Teste A: Política de profiles funciona
- [ ] Teste B: Validação de propriedade funciona
- [ ] Teste C: Liberação de reservas funciona

### Limpeza
- [ ] Usuários de teste podem ser removidos (opcional)
- [ ] Nenhum dado de teste restante
- [ ] Estoque no estado original

---

## 🐛 Solução de Problemas

### Erro: "relation does not exist"
**Causa:** Migrations 001-004 não foram aplicadas  
**Solução:** Aplicar migrations na ordem correta

### Erro: "permission denied"
**Causa:** Usuário não tem permissões suficientes  
**Solução:** Conectar como superusuário ou usuário com privilégios

### Erro: "function does not exist"
**Causa:** Migration 005 não foi aplicada  
**Solução:** Aplicar migration 005

### Teste falha com "Exceção inesperada"
**Causa:** Comportamento diferente do esperado  
**Solução:** 
1. Verificar mensagem de erro exata
2. Consultar `REVIEW_ROUND3_FINAL.md`
3. Verificar se migrations estão na ordem correta

### Dados residuais após testes
**Causa:** Teste falhou antes da limpeza  
**Solução:**
```sql
-- Limpar manualmente
DELETE FROM receipts WHERE receipt_number LIKE 'TEST-%';
DELETE FROM shipments WHERE shipment_number LIKE 'TEST-%';
DELETE FROM movements WHERE reference LIKE 'TEST-%';
DELETE FROM receipt_lines WHERE receipt_id IN (SELECT id FROM receipts WHERE receipt_number LIKE 'TEST-%');
DELETE FROM shipment_lines WHERE shipment_id IN (SELECT id FROM shipments WHERE shipment_number LIKE 'TEST-%');
DELETE FROM movement_lines WHERE movement_id IN (SELECT id FROM movements WHERE reference LIKE 'TEST-%');
```

---

## 📞 Suporte

**Documentação:**
- `REVIEW_ROUND3_FINAL.md` - Relatório completo
- `REVIEW_ROUND3_ANALYSIS.md` - Análise inicial
- `supabase/migrations/005_critical_fixes.sql` - Migration
- `supabase/tests/validation_tests_v2.sql` - Testes

**Próximos Passos:**
1. Executar todos os testes
2. Validar resultados
3. Documentar quaisquer problemas
4. Só então considerar para produção

---

**Última atualização:** 2026-01-16  
**Versão:** 1.2.0
