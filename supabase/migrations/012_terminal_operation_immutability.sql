-- ========================================
-- WMS Casa Meta - Migration 012
-- Imutabilidade de operações finalizadas
-- ========================================

CREATE OR REPLACE FUNCTION public.prevent_update_after_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_status TEXT;
  v_internal BOOLEAN;
BEGIN
  v_internal := COALESCE(
    current_setting('wms.internal_status_transition', true),
    ''
  ) = 'on';

  -- Apenas funções transacionais internas e service_role podem fazer
  -- manutenção técnica durante a própria transação. Admin de aplicação
  -- não recebe bypass para reescrever histórico concluído.
  IF v_internal OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'receipt_lines' THEN
    SELECT status
      INTO v_parent_status
      FROM public.receipts
     WHERE id = NEW.receipt_id;
  ELSIF TG_TABLE_NAME = 'shipment_lines' THEN
    SELECT status
      INTO v_parent_status
      FROM public.shipments
     WHERE id = NEW.shipment_id;
  ELSIF TG_TABLE_NAME = 'stock_count_lines' THEN
    SELECT status
      INTO v_parent_status
      FROM public.stock_counts
     WHERE id = NEW.stock_count_id;
  ELSE
    RAISE EXCEPTION 'Tabela não suportada por prevent_update_after_completion: %', TG_TABLE_NAME;
  END IF;

  IF v_parent_status IS NULL THEN
    RAISE EXCEPTION 'Operação pai não encontrada';
  END IF;

  IF v_parent_status IN ('completed', 'cancelled', 'shipped') THEN
    RAISE EXCEPTION 'Linhas de operação finalizada são imutáveis (status: %)', v_parent_status;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_update_after_completion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_update_after_completion() FROM authenticated;
