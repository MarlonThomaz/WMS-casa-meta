-- ========================================
-- WMS Casa Meta - Migration 016
-- Cadastro atômico de produto + barcode + estoque inicial
-- ========================================

CREATE OR REPLACE FUNCTION public.register_product_with_barcode(
  p_sku TEXT,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_unit_base TEXT DEFAULT 'un',
  p_min_stock NUMERIC DEFAULT 0,
  p_max_stock NUMERIC DEFAULT NULL,
  p_barcode TEXT DEFAULT NULL,
  p_barcode_type TEXT DEFAULT NULL,
  p_packaging_type TEXT DEFAULT 'unit',
  p_quantity_per_package NUMERIC DEFAULT 1,
  p_initial_location_id UUID DEFAULT NULL,
  p_initial_quantity NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_product_id UUID;
  v_unit TEXT;
BEGIN
  v_role := public.user_role();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'manager', 'operator') THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  IF NULLIF(BTRIM(p_sku), '') IS NULL THEN
    RAISE EXCEPTION 'SKU é obrigatório';
  END IF;

  IF NULLIF(BTRIM(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Nome do produto é obrigatório';
  END IF;

  IF NULLIF(BTRIM(p_barcode), '') IS NULL THEN
    RAISE EXCEPTION 'Código de barras é obrigatório';
  END IF;

  v_unit := COALESCE(NULLIF(BTRIM(p_unit_base), ''), 'un');

  IF p_min_stock IS NULL OR p_min_stock < 0 THEN
    RAISE EXCEPTION 'Estoque mínimo inválido';
  END IF;

  IF p_max_stock IS NOT NULL AND p_max_stock < p_min_stock THEN
    RAISE EXCEPTION 'Estoque máximo deve ser maior ou igual ao mínimo';
  END IF;

  IF p_quantity_per_package IS NULL OR p_quantity_per_package <= 0 THEN
    RAISE EXCEPTION 'Quantidade por embalagem deve ser maior que zero';
  END IF;

  IF p_initial_quantity IS NULL OR p_initial_quantity < 0 THEN
    RAISE EXCEPTION 'Estoque inicial não pode ser negativo';
  END IF;

  IF p_initial_quantity > 0 THEN
    IF p_initial_location_id IS NULL THEN
      RAISE EXCEPTION 'Localização inicial é obrigatória quando houver estoque inicial';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM public.locations
       WHERE id = p_initial_location_id
         AND status NOT IN ('blocked', 'maintenance')
    ) THEN
      RAISE EXCEPTION 'Localização inicial inválida ou indisponível';
    END IF;
  END IF;

  INSERT INTO public.products (
    sku,
    name,
    description,
    category,
    unit_base,
    min_stock,
    max_stock,
    active
  ) VALUES (
    BTRIM(p_sku),
    BTRIM(p_name),
    NULLIF(BTRIM(p_description), ''),
    NULLIF(BTRIM(p_category), ''),
    v_unit,
    p_min_stock,
    p_max_stock,
    true
  )
  RETURNING id INTO v_product_id;

  INSERT INTO public.product_barcodes (
    product_id,
    barcode,
    barcode_type,
    packaging_type,
    quantity_per_package,
    is_primary
  ) VALUES (
    v_product_id,
    BTRIM(p_barcode),
    NULLIF(BTRIM(p_barcode_type), ''),
    COALESCE(NULLIF(BTRIM(p_packaging_type), ''), 'unit'),
    p_quantity_per_package,
    true
  );

  IF p_initial_quantity > 0 THEN
    PERFORM public.create_and_process_movement(
      'inbound',
      'INITIAL:' || BTRIM(p_sku),
      'Estoque inicial registrado no cadastro do produto',
      jsonb_build_array(
        jsonb_build_object(
          'product_id', v_product_id,
          'to_location_id', p_initial_location_id,
          'quantity', p_initial_quantity,
          'unit', v_unit,
          'notes', 'Carga inicial do produto'
        )
      )
    );
  END IF;

  RETURN v_product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_product_with_barcode(
  TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC,
  TEXT, TEXT, TEXT, NUMERIC, UUID, NUMERIC
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_product_with_barcode(
  TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC,
  TEXT, TEXT, TEXT, NUMERIC, UUID, NUMERIC
) TO authenticated;
