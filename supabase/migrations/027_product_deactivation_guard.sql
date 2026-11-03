-- ========================================
-- Annona Mercis WMS - Migration 027
-- Produto inativo não pode continuar participando do estoque físico
-- nem de operações abertas, evitando SKUs invisíveis no armazém.
-- ========================================

-- Repara dados de homologação que já violam a nova invariável.
UPDATE public.products p
   SET active = true,
       updated_at = NOW()
 WHERE p.active = false
   AND (
     EXISTS (
       SELECT 1
         FROM public.stock_balances sb
        WHERE sb.product_id = p.id
          AND (sb.quantity > 0 OR sb.reserved_quantity > 0)
     )
     OR EXISTS (
       SELECT 1
         FROM public.receipt_lines rl
         JOIN public.receipts r ON r.id = rl.receipt_id
        WHERE rl.product_id = p.id
          AND r.status IN ('pending', 'partial')
     )
     OR EXISTS (
       SELECT 1
         FROM public.shipment_lines sl
         JOIN public.shipments s ON s.id = sl.shipment_id
        WHERE sl.product_id = p.id
          AND s.status IN ('pending', 'picking', 'packed')
     )
     OR EXISTS (
       SELECT 1
         FROM public.stock_count_lines scl
         JOIN public.stock_counts sc ON sc.id = scl.stock_count_id
        WHERE scl.product_id = p.id
          AND sc.status IN ('pending', 'in_progress')
     )
     OR EXISTS (
       SELECT 1
         FROM public.movement_lines ml
         JOIN public.movements m ON m.id = ml.movement_id
        WHERE ml.product_id = p.id
          AND m.status IN ('pending', 'in_progress')
     )
   );

CREATE OR REPLACE FUNCTION public.prevent_product_deactivation_in_use()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.active IS DISTINCT FROM true OR NEW.active IS DISTINCT FROM false THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.stock_balances sb
     WHERE sb.product_id = NEW.id
       AND (sb.quantity > 0 OR sb.reserved_quantity > 0)
  ) THEN
    RAISE EXCEPTION 'Produto não pode ser desativado enquanto possuir saldo físico ou reservado';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.receipt_lines rl
      JOIN public.receipts r ON r.id = rl.receipt_id
     WHERE rl.product_id = NEW.id
       AND r.status IN ('pending', 'partial')
  ) THEN
    RAISE EXCEPTION 'Produto não pode ser desativado enquanto participar de recebimento aberto';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.shipment_lines sl
      JOIN public.shipments s ON s.id = sl.shipment_id
     WHERE sl.product_id = NEW.id
       AND s.status IN ('pending', 'picking', 'packed')
  ) THEN
    RAISE EXCEPTION 'Produto não pode ser desativado enquanto participar de expedição aberta';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.stock_count_lines scl
      JOIN public.stock_counts sc ON sc.id = scl.stock_count_id
     WHERE scl.product_id = NEW.id
       AND sc.status IN ('pending', 'in_progress')
  ) THEN
    RAISE EXCEPTION 'Produto não pode ser desativado enquanto participar de contagem aberta';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.movement_lines ml
      JOIN public.movements m ON m.id = ml.movement_id
     WHERE ml.product_id = NEW.id
       AND m.status IN ('pending', 'in_progress')
  ) THEN
    RAISE EXCEPTION 'Produto não pode ser desativado enquanto participar de movimentação aberta';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_product_deactivation_in_use() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_product_deactivation_in_use() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_product_deactivation_in_use() FROM authenticated;

DROP TRIGGER IF EXISTS prevent_product_deactivation_in_use_trigger
  ON public.products;

CREATE TRIGGER prevent_product_deactivation_in_use_trigger
  BEFORE UPDATE OF active ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_product_deactivation_in_use();
