# 🔧 Terceira Rodada Corretiva - WMS Casa Meta

**Data:** 2026-01-16  
**Status:** 🚧 **EM ANDAMENTO - NÃO APLICAR EM PRODUÇÃO**

---

## 📋 Problemas Identificados na Análise

### 1. Testes SQL com Lógica Incorreta

**Problema:** Testes 1, 2 e 7 capturam exceções como se fossem sucesso.

**Exemplo do Teste 1 (linhas 78-82):**
```sql
EXCEPTION
  WHEN OTHERS THEN
    -- Se lançou exceção, também está correto (impediu duplicação)
    RAISE NOTICE 'Segunda confirmação bloqueada com erro: % (CORRETO)', SQLERRM;
```

**Problema Real:**
- O teste aceita QUALQUER exceção como sucesso
- Não diferencia entre "bloqueado corretamente" e "erro inesperado"
- Se o teste falhar por outro motivo (ex: constraint violation), ainda passa

**Correção Necessária:**
- Capturar exceção específica esperada
- Verificar mensagem de erro exata
- Falhar se a exceção for diferente da esperada

---

### 2. Política RLS de Profiles com Risco de Recursão

**Problema:** Migration 004, linhas 37-43:
```sql
CREATE POLICY "profiles_update_self_limited" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    AND id = (SELECT id FROM profiles WHERE id = auth.uid())
  );
```

**Problema Real:**
- A cláusula `WITH CHECK` faz SELECT na mesma tabela que está sendo atualizada
- Pode causar recursão infinita em alguns cenários
- A condição `id = (SELECT id FROM profiles WHERE id = auth.uid())` é redundante

**Correção Necessária:**
- Simplificar a política para evitar recursão
- Usar OLD.role em vez de SELECT
- Garantir que não haja loop

---

### 3. release_shipment_reservations sem Proteção contra Chamadas Repetidas

**Problema:** Migration 004, linhas 424-434:
```sql
FOR v_line IN
  SELECT * FROM shipment_lines WHERE shipment_id = p_shipment_id
LOOP
  IF v_line.from_location_id IS NOT NULL AND v_line.requested_quantity > 0 THEN
    UPDATE stock_balances
    SET reserved_quantity = GREATEST(0, reserved_quantity - v_line.requested_quantity)
    WHERE product_id = v_line.product_id AND location_id = v_line.from_location_id;
  END IF;
END LOOP;
```

**Problema Real:**
- Se a função for chamada duas vezes, subtrai duas vezes
- Não verifica se as reservas já foram liberadas
- Pode afetar reservas de outras expedições se compartilharem produto/localização

**Correção Necessária:**
- Adicionar campo `reservations_released` em shipment_lines
- Verificar antes de liberar
- Garantir que só libera uma vez por expedição

---

### 4. Funções SECURITY DEFINER sem Validação de Propriedade

**Problema:** Funções validam papel do usuário, mas não validam se o usuário pode operar sobre o registro específico.

**Exemplo - process_stock_movement:**
```sql
-- Validar papel do usuário
v_user_role := public.user_role();
IF v_user_role NOT IN ('admin', 'manager', 'operator') THEN
  RAISE EXCEPTION 'Usuário não autorizado';
END IF;

-- Processa movimentação sem verificar se o usuário criou
```

**Problema Real:**
- Um operador pode processar movimentação criada por outro usuário
- Não há validação de `created_by = auth.uid()`
- Admin/manager podem processar qualquer coisa sem restrição

**Correção Necessária:**
- Adicionar validação de propriedade do registro
- Operador só pode processar seus próprios registros
- Admin/manager têm acesso total (já está correto)

---

### 5. Testes sem Autenticação Real

**Problema:** Testes executam como superusuário do banco, não como usuários com papéis específicos.

**Problema Real:**
- Não testa políticas RLS reais
- Não valida permissões por papel
- Não simula cenário de produção

**Correção Necessária:**
- Criar usuários de teste com papéis específicos
- Executar testes com `SET ROLE`
- Validar que políticas RLS funcionam

---

### 6. Testes não Garantem Limpeza Completa

**Problema:** Testes podem deixar resíduos se falharem no meio.

**Exemplo - Teste 2 (linhas 154-161):**
```sql
-- Limpar
DELETE FROM shipments WHERE id = v_shipment_id;
DELETE FROM shipment_lines WHERE shipment_id = v_shipment_id;

-- Restaurar reserva
UPDATE stock_balances
SET reserved_quantity = v_initial_reserved
WHERE product_id = v_product_id AND location_id = v_location_id;
```

**Problema Real:**
- Se o teste falhar antes da limpeza, dados ficam no banco
- Não usa transação com rollback
- Pode afetar outros testes

**Correção Necessária:**
- Envolver cada teste em transação
- Usar SAVEPOINT para rollback em caso de falha
- Garantir limpeza mesmo em caso de erro

---

## 🎯 Plano de Correção

### Fase 1: Corrigir Testes SQL (Prioridade Alta)
1. Reescrever testes 1, 2 e 7 com lógica correta
2. Adicionar testes negativos e positivos claros
3. Implementar transações com rollback
4. Criar framework de teste com autenticação

### Fase 2: Corrigir Migration 004 (Prioridade Alta)
1. Corrigir política de profiles (evitar recursão)
2. Corrigir release_shipment_reservations (impedir duplicação)
3. Adicionar validação de propriedade nas funções
4. Criar migration 005 com correções

### Fase 3: Criar Documentação de Testes (Prioridade Média)
1. Instruções claras de execução
2. Scripts de setup para usuários de teste
3. Validação de resultados esperados

---

## 📊 Status Atual

- [x] Problemas identificados e documentados
- [ ] Correções implementadas
- [ ] Testes reescritos
- [ ] Migration 005 criada
- [ ] Testes executados com sucesso
- [ ] Documentação completa

**Próximo passo:** Implementar correções nos testes SQL
