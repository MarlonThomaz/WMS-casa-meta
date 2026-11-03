-- ========================================
-- Annona Mercis WMS - Migration 025
-- Impede armazenagem em endereços bloqueados/manutenção
-- sem impedir reconciliação física de estoque já existente.
-- ========================================

CREATE OR REPLACE FUNCTION public.validate_movement_destination_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location_status TEXT;
  v_movement_type TEXT;
  v_movement_status TEXT;
BEGIN
  IF NEW.to_location_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Mantém um lock compartilhado na localização até o fim da transação,
  -- evitando que ela seja bloqueada entre a validação e a aplicação do saldo.
  SELECT status
    INTO v_location_status
    FROM public.locations
   WHERE id = NEW.to_location_id
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Localização de destino inválida';
  END IF;

  IF v_location_status NOT IN ('blocked', 'maintenance') THEN
    RETURN NEW;
  END IF;

  SELECT movement_type, status
    INTO v_movement_type, v_movement_status
    FROM public.movements
   WHERE id = NEW.movement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentação da linha não encontrada';
  END IF;

  -- Inbound e transfer representam entrada física real na posição e nunca
  -- podem apontar para endereço indisponível.
  -- Ajuste pendente corresponde ao ajuste manual do app e também é bloqueado.
  -- Ajustes já materializados internamente pela reconciliação de inventário
  -- podem refletir estoque que fisicamente já estava em uma posição bloqueada.
  IF v_movement_type IN ('inbound', 'transfer')
     OR (v_movement_type = 'adjustment' AND v_movement_status = 'pending') THEN
    RAISE EXCEPTION 'Localização de destino % está indisponível (%)',
      NEW.to_location_id, v_location_status;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_movement_destination_availability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_movement_destination_availability() FROM anon;
REVOKE ALL ON FUNCTION public.validate_movement_destination_availability() FROM authenticated;

DROP TRIGGER IF EXISTS validate_movement_destination_availability_trigger
  ON public.movement_lines;

CREATE TRIGGER validate_movement_destination_availability_trigger
  BEFORE INSERT OR UPDATE OF to_location_id, movement_id
  ON public.movement_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_movement_destination_availability();
