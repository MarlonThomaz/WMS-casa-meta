-- ========================================
-- WMS Casa Meta - Migration 008
-- Sétima Rodada Corretiva
-- Mantém o histórico existente e corrige segurança/integridade
-- ========================================

-- ========================================
-- 1. PROFILES: política válida + proteção de role
-- ========================================

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.validate_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT role
    INTO v_user_role
    FROM public.profiles
   WHERE id = auth.uid();

  IF v_user_role IS DISTINCT FROM 'admin'
     AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar roles';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_role_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_validate_role_change ON public.profiles;
CREATE TRIGGER trg_validate_role_change
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_change();

-- ========================================
-- 2. AUDITORIA: impedir fabricação direta de eventos
-- ========================================

-- SECURITY DEFINER bypassa RLS; portanto clientes não precisam de INSERT direto.
DROP POLICY IF EXISTS "audit_events_insert" ON public.audit_events;
CREATE POLICY "audit_events_insert" ON public.audit_events
  FOR INSERT
  WITH CHECK (false);

REVOKE INSERT, UPDATE, DELETE ON public.audit_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_event_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_details JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_user_role TEXT;
  v_entity_created_by UUID;
  v_entity_exists BOOLEAN := false;
  v_expected_entity_type TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT email, role
    INTO v_user_email, v_user_role
    FROM public.profiles
   WHERE id = v_user_id
     AND active = true;

  IF v_user_email IS NULL OR v_user_role IS NULL THEN
    RAISE EXCEPTION 'Perfil ativo não encontrado';
  END IF;

  v_expected_entity_type := CASE p_event_type
    WHEN 'movement_processed' THEN 'movement'
    WHEN 'shipment_picking_started' THEN 'shipment'
    WHEN 'shipment_picked' THEN 'shipment'
    WHEN 'shipment_reservations_released' THEN 'shipment'
    WHEN 'shipment_cancelled_empty' THEN 'shipment'
    WHEN 'receipt_processed' THEN 'receipt'
    WHEN 'stock_count_completed' THEN 'stock_count'
    WHEN 'product_created' THEN 'product'
    WHEN 'product_updated' THEN 'product'
    WHEN 'location_created' THEN 'location'
    WHEN 'location_updated' THEN 'location'
    WHEN 'user_login' THEN 'profile'
    WHEN 'user_logout' THEN 'profile'
    ELSE NULL
  END;

  IF v_expected_entity_type IS NULL THEN
    RAISE EXCEPTION 'Tipo de evento inválido: %', p_event_type;
  END IF;

  IF p_entity_type IS DISTINCT FROM v_expected_entity_type THEN
    RAISE EXCEPTION 'Evento % exige entity_type %, recebido %',
      p_event_type, v_expected_entity_type, p_entity_type;
  END IF;

  CASE p_entity_type
    WHEN 'movement' THEN
      SELECT created_by
        INTO v_entity_created_by
        FROM public.movements
       WHERE id = p_entity_id;
      v_entity_exists := FOUND;

    WHEN 'receipt' THEN
      SELECT created_by
        INTO v_entity_created_by
        FROM public.receipts
       WHERE id = p_entity_id;
      v_entity_exists := FOUND;

    WHEN 'shipment' THEN
      SELECT created_by
        INTO v_entity_created_by
        FROM public.shipments
       WHERE id = p_entity_id;
      v_entity_exists := FOUND;

    WHEN 'stock_count' THEN
      SELECT created_by
        INTO v_entity_created_by
        FROM public.stock_counts
       WHERE id = p_entity_id;
      v_entity_exists := FOUND;

    WHEN 'product' THEN
      SELECT EXISTS(
        SELECT 1 FROM public.products WHERE id = p_entity_id
      ) INTO v_entity_exists;
      v_entity_created_by := NULL;

    WHEN 'location' THEN
      SELECT EXISTS(
        SELECT 1 FROM public.locations WHERE id = p_entity_id
      ) INTO v_entity_exists;
      v_entity_created_by := NULL;

    WHEN 'profile' THEN
      SELECT EXISTS(
        SELECT 1 FROM public.profiles WHERE id = p_entity_id
      ) INTO v_entity_exists;
      v_entity_created_by := p_entity_id;
  END CASE;

  IF NOT v_entity_exists THEN
    RAISE EXCEPTION 'Entidade não encontrada: % %', p_entity_type, p_entity_id;
  END IF;

  -- Para entidades operacionais, operador só pode registrar eventos próprios.
  -- created_by NULL é rejeitado para operador em vez de liberar o acesso.
  IF p_entity_type IN ('movement', 'receipt', 'shipment', 'stock_count') THEN
    IF v_user_role = 'operator'
       AND v_entity_created_by IS DISTINCT FROM v_user_id THEN
      RAISE EXCEPTION 'Operador não pode registrar evento para entidade de outro usuário ou sem proprietário';
    END IF;

    IF v_user_role NOT IN ('admin', 'manager', 'operator') THEN
      RAISE EXCEPTION 'Usuário não autorizado a registrar evento operacional';
    END IF;
  ELSIF p_entity_type = 'profile' THEN
    IF v_user_role NOT IN ('admin', 'manager')
       AND p_entity_id IS DISTINCT FROM v_user_id THEN
      RAISE EXCEPTION 'Usuário não pode registrar evento para outro perfil';
    END IF;
  ELSE
    IF v_user_role NOT IN ('admin', 'manager', 'operator') THEN
      RAISE EXCEPTION 'Usuário não autorizado a registrar evento';
    END IF;
  END IF;

  INSERT INTO public.audit_events (
    event_type, entity_type, entity_id, user_id, user_email, details
  ) VALUES (
    p_event_type, p_entity_type, p_entity_id, v_user_id, v_user_email, p_details
  );
END;
$$;

-- O logger é somente interno. As funções transacionais SECURITY DEFINER,
-- pertencentes ao owner da função, continuam podendo chamá-lo.
REVOKE ALL ON FUNCTION public.log_audit_event(TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_audit_event(TEXT, TEXT, UUID, JSONB) FROM authenticated;

-- ========================================
-- 3. PROPRIEDADE: impedir bypass quando created_by é NULL
-- ========================================

-- Defesa adicional para todas as mudanças de status operacionais.
CREATE OR REPLACE FUNCTION public.guard_operator_status_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := public.user_role();

  IF NEW.status IS DISTINCT FROM OLD.status
     AND v_role = 'operator'
     AND OLD.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Operador só pode alterar status de registros próprios';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_operator_status_owner() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_movement_status_owner ON public.movements;
CREATE TRIGGER trg_guard_movement_status_owner
  BEFORE UPDATE OF status ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.guard_operator_status_owner();

DROP TRIGGER IF EXISTS trg_guard_receipt_status_owner ON public.receipts;
CREATE TRIGGER trg_guard_receipt_status_owner
  BEFORE UPDATE OF status ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.guard_operator_status_owner();

DROP TRIGGER IF EXISTS trg_guard_shipment_status_owner ON public.shipments;
CREATE TRIGGER trg_guard_shipment_status_owner
  BEFORE UPDATE OF status ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.guard_operator_status_owner();

DROP TRIGGER IF EXISTS trg_guard_stock_count_status_owner ON public.stock_counts;
CREATE TRIGGER trg_guard_stock_count_status_owner
  BEFORE UPDATE OF status ON public.stock_counts
  FOR EACH ROW EXECUTE FUNCTION public.guard_operator_status_owner();

-- Protege alterações em linhas mesmo em caminhos que não mudem o status do pai.
CREATE OR REPLACE FUNCTION public.guard_operator_line_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_created_by UUID;
BEGIN
  v_role := public.user_role();

  IF v_role IS DISTINCT FROM 'operator' THEN
    RETURN NEW;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'shipment_lines' THEN
      SELECT created_by INTO v_created_by
        FROM public.shipments
       WHERE id = NEW.shipment_id;
    WHEN 'receipt_lines' THEN
      SELECT created_by INTO v_created_by
        FROM public.receipts
       WHERE id = NEW.receipt_id;
    WHEN 'stock_count_lines' THEN
      SELECT created_by INTO v_created_by
        FROM public.stock_counts
       WHERE id = NEW.stock_count_id;
    ELSE
      RAISE EXCEPTION 'Tabela não suportada pelo guard de propriedade: %', TG_TABLE_NAME;
  END CASE;

  IF v_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Operador só pode alterar linhas de registros próprios';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_operator_line_owner() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_shipment_line_owner ON public.shipment_lines;
CREATE TRIGGER trg_guard_shipment_line_owner
  BEFORE UPDATE ON public.shipment_lines
  FOR EACH ROW EXECUTE FUNCTION public.guard_operator_line_owner();

DROP TRIGGER IF EXISTS trg_guard_receipt_line_owner ON public.receipt_lines;
CREATE TRIGGER trg_guard_receipt_line_owner
  BEFORE UPDATE ON public.receipt_lines
  FOR EACH ROW EXECUTE FUNCTION public.guard_operator_line_owner();

DROP TRIGGER IF EXISTS trg_guard_stock_count_line_owner ON public.stock_count_lines;
CREATE TRIGGER trg_guard_stock_count_line_owner
  BEFORE UPDATE ON public.stock_count_lines
  FOR EACH ROW EXECUTE FUNCTION public.guard_operator_line_owner();

-- ========================================
-- 4. CONTAGEM: preservar movimentações pós-snapshot
-- ========================================
-- Regra operacional:
--   system_quantity = saldo do snapshot no momento da contagem.
--   counted_quantity = quantidade física observada naquele snapshot.
--   variance = counted_quantity - system_quantity.
-- A finalização aplica SOMENTE essa variância ao saldo atual bloqueado.
-- Assim, movimentos legítimos posteriores ao snapshot são preservados.
-- Ex.: snapshot 100, contado 95, entrada posterior +20, saldo atual 120.
--      variância -5 => saldo final 115.

CREATE OR REPLACE FUNCTION public.process_stock_count_adjustments(p_count_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_count_status TEXT;
  v_count_number TEXT;
  v_count_created_by UUID;
  v_movement_id UUID;
  v_user_role TEXT;
  v_current_stock NUMERIC;
  v_reserved_stock NUMERIC;
  v_variance NUMERIC;
  v_new_stock NUMERIC;
BEGIN
  v_user_role := public.user_role();
  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  SELECT status, count_number, created_by
    INTO v_count_status, v_count_number, v_count_created_by
    FROM public.stock_counts
   WHERE id = p_count_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contagem não encontrada';
  END IF;

  IF v_user_role = 'operator'
     AND v_count_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Operador só pode processar suas próprias contagens';
  END IF;

  IF v_count_status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'Contagem não está em andamento (status: %)', v_count_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stock_count_lines WHERE stock_count_id = p_count_id
  ) THEN
    RAISE EXCEPTION 'Contagem não possui linhas';
  END IF;

  FOR v_line IN
    SELECT *
      FROM public.stock_count_lines
     WHERE stock_count_id = p_count_id
     ORDER BY product_id, location_id, id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.products
       WHERE id = v_line.product_id AND active = true
    ) THEN
      RAISE EXCEPTION 'Produto não encontrado ou inativo: %', v_line.product_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.locations WHERE id = v_line.location_id
    ) THEN
      RAISE EXCEPTION 'Localização não encontrada: %', v_line.location_id;
    END IF;

    IF v_line.counted_quantity < 0 OR v_line.system_quantity < 0 THEN
      RAISE EXCEPTION 'Quantidades da contagem não podem ser negativas';
    END IF;

    -- Garante a existência da linha antes do lock.
    INSERT INTO public.stock_balances (
      product_id, location_id, quantity, reserved_quantity, last_movement_at
    ) VALUES (
      v_line.product_id, v_line.location_id, 0, 0, NOW()
    )
    ON CONFLICT (product_id, location_id) DO NOTHING;

    SELECT quantity, reserved_quantity
      INTO v_current_stock, v_reserved_stock
      FROM public.stock_balances
     WHERE product_id = v_line.product_id
       AND location_id = v_line.location_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Não foi possível obter saldo para produto % na localização %',
        v_line.product_id, v_line.location_id;
    END IF;

    v_variance := v_line.counted_quantity - v_line.system_quantity;
    v_new_stock := v_current_stock + v_variance;

    IF v_new_stock < 0 THEN
      RAISE EXCEPTION 'Ajuste deixaria estoque negativo na linha %. Atual: %, Variância: %',
        v_line.id, v_current_stock, v_variance;
    END IF;

    IF v_new_stock < v_reserved_stock THEN
      RAISE EXCEPTION 'Ajuste deixaria estoque abaixo do reservado na linha %. Novo saldo: %, Reservado: %',
        v_line.id, v_new_stock, v_reserved_stock;
    END IF;

    IF v_variance = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.movements (
      reference,
      movement_type,
      status,
      operator_id,
      created_by,
      source_reference,
      notes,
      completed_at,
      processed_at
    ) VALUES (
      public.generate_movement_reference('adjustment'),
      'adjustment',
      'completed',
      auth.uid(),
      auth.uid(),
      v_count_number,
      format(
        'Ajuste contagem %s linha %s: Snapshot=%s, Contado=%s, SaldoAtual=%s, Variância=%s, SaldoFinal=%s',
        v_count_number,
        v_line.id,
        v_line.system_quantity,
        v_line.counted_quantity,
        v_current_stock,
        v_variance,
        v_new_stock
      ),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_movement_id;

    IF v_variance > 0 THEN
      INSERT INTO public.movement_lines (
        movement_id, product_id, to_location_id, quantity, unit, notes
      ) VALUES (
        v_movement_id,
        v_line.product_id,
        v_line.location_id,
        v_variance,
        'un',
        format('Contagem %s: ajuste positivo de variância', v_count_number)
      );
    ELSE
      INSERT INTO public.movement_lines (
        movement_id, product_id, from_location_id, quantity, unit, notes
      ) VALUES (
        v_movement_id,
        v_line.product_id,
        v_line.location_id,
        ABS(v_variance),
        'un',
        format('Contagem %s: ajuste negativo de variância', v_count_number)
      );
    END IF;

    UPDATE public.stock_balances
       SET quantity = v_new_stock,
           last_movement_at = NOW(),
           updated_at = NOW()
     WHERE product_id = v_line.product_id
       AND location_id = v_line.location_id;
  END LOOP;

  UPDATE public.stock_counts
     SET status = 'completed',
         completed_at = NOW()
   WHERE id = p_count_id;

  PERFORM public.log_audit_event(
    'stock_count_completed',
    'stock_count',
    p_count_id,
    jsonb_build_object(
      'count_number', v_count_number,
      'adjustment_rule', 'snapshot_variance_applied_to_current_balance'
    )
  );
END;
$$;

-- Mantém a função transacional acessível ao cliente autenticado.
REVOKE ALL ON FUNCTION public.process_stock_count_adjustments(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_stock_count_adjustments(UUID) TO authenticated;

-- ========================================
-- FIM DA MIGRATION 008
-- ========================================
