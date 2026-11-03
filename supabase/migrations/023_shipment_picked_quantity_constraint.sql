-- ========================================
-- Annona Mercis WMS - Migration 023
-- Impede que uma linha de expedição registre quantidade separada acima da solicitada
-- ========================================

ALTER TABLE public.shipment_lines
  DROP CONSTRAINT IF EXISTS shipment_lines_picked_not_above_requested;

ALTER TABLE public.shipment_lines
  ADD CONSTRAINT shipment_lines_picked_not_above_requested
  CHECK (picked_quantity <= requested_quantity)
  NOT VALID;

-- Falha explicitamente durante a migration se já existir dado inconsistente.
-- Antes do piloto preferimos detectar a corrupção em vez de corrigi-la silenciosamente.
ALTER TABLE public.shipment_lines
  VALIDATE CONSTRAINT shipment_lines_picked_not_above_requested;
