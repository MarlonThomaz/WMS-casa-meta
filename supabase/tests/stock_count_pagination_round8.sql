-- ========================================
-- Annona Mercis WMS - Regressão de escala da contagem física
-- 1.200 linhas de inventário, tudo revertido ao final.
-- ========================================

BEGIN;

SET LOCAL statement_timeout = '3s';

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '10000000-0000-0000-0000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);

INSERT INTO public.products (
  id, sku, name, category, unit_base, min_stock, max_stock, active
) VALUES (
  '92000000-0000-0000-0000-000000000001',
  'COUNT-PERF-SKU',
  'Produto performance contagem',
  'PERF-COUNT',
  'un',
  0,
  100000,
  true
);

INSERT INTO public.locations (
  id, code, zone, aisle, rack, level, location_type, capacity, status
)
SELECT
  ('93000000-0000-0000-' || lpad(gs::text, 4, '0') || '-000000000001')::uuid,
  'COUNT-PERF-L-' || lpad(gs::text, 4, '0'),
  'COUNT',
  lpad(((gs - 1) / 20 + 1)::text, 2, '0'),
  lpad(((gs - 1) % 20 + 1)::text, 2, '0'),
  '01',
  'storage',
  100,
  'available'
FROM generate_series(1, 1200) AS gs;

INSERT INTO public.stock_counts (
  id,
  count_number,
  count_type,
  status,
  notes,
  created_by,
  operator_id
) VALUES (
  '94000000-0000-0000-0000-000000000001',
  'CNT-PERF-1200',
  'full',
  'in_progress',
  'Fixture temporária de paginação',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002'
);

INSERT INTO public.stock_count_lines (
  stock_count_id,
  product_id,
  location_id,
  system_quantity,
  counted_quantity,
  unit
)
SELECT
  '94000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  l.id,
  10,
  NULL,
  'un'
FROM public.locations l
WHERE l.code LIKE 'COUNT-PERF-L-%';

DO $$
DECLARE
  v_rows BIGINT;
  v_total BIGINT;
  v_second_rows BIGINT;
  v_exact_rows BIGINT;
  v_exact_total BIGINT;
  v_progress_total BIGINT;
  v_progress_confirmed BIGINT;
  v_progress_discrepancies BIGINT;
  v_started TIMESTAMPTZ;
  v_elapsed INTERVAL;
BEGIN
  v_started := clock_timestamp();
  SELECT count(*), COALESCE(MAX(total_count), 0)
    INTO v_rows, v_total
    FROM public.search_stock_count_lines(
      '94000000-0000-0000-0000-000000000001',
      'COUNT-PERF',
      50,
      0
    );
  v_elapsed := clock_timestamp() - v_started;

  IF v_rows <> 50 OR v_total <> 1200 THEN
    RAISE EXCEPTION 'COUNT-PAGE-8.1: esperado 50 de 1200, retornou % de %', v_rows, v_total;
  END IF;

  IF v_elapsed > interval '3 seconds' THEN
    RAISE EXCEPTION 'COUNT-PAGE-8.1: primeira página excedeu 3s: %', v_elapsed;
  END IF;

  SELECT count(*)
    INTO v_second_rows
    FROM public.search_stock_count_lines(
      '94000000-0000-0000-0000-000000000001',
      'COUNT-PERF',
      50,
      50
    );

  IF v_second_rows <> 50 THEN
    RAISE EXCEPTION 'COUNT-PAGE-8.1: segunda página deveria ter 50 linhas, retornou %', v_second_rows;
  END IF;

  SELECT count(*), COALESCE(MAX(total_count), 0)
    INTO v_exact_rows, v_exact_total
    FROM public.search_stock_count_lines(
      '94000000-0000-0000-0000-000000000001',
      'COUNT-PERF-L-1199',
      50,
      0
    );

  IF v_exact_rows <> 1 OR v_exact_total <> 1 THEN
    RAISE EXCEPTION 'COUNT-PAGE-8.1: busca exata deveria retornar 1 de 1, retornou % de %',
      v_exact_rows, v_exact_total;
  END IF;

  SELECT total_lines, confirmed_lines, discrepancy_lines
    INTO v_progress_total, v_progress_confirmed, v_progress_discrepancies
    FROM public.get_stock_count_progress('94000000-0000-0000-0000-000000000001');

  IF v_progress_total <> 1200 OR v_progress_confirmed <> 0 OR v_progress_discrepancies <> 0 THEN
    RAISE EXCEPTION 'COUNT-PAGE-8.2: progresso inicial inválido: %, %, %',
      v_progress_total, v_progress_confirmed, v_progress_discrepancies;
  END IF;
END $$;

WITH first_two AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn
  FROM public.stock_count_lines
  WHERE stock_count_id = '94000000-0000-0000-0000-000000000001'
  ORDER BY id
  LIMIT 2
)
UPDATE public.stock_count_lines scl
SET counted_quantity = CASE WHEN ft.rn = 1 THEN 10 ELSE 8 END,
    counted_by = '10000000-0000-0000-0000-000000000002',
    counted_at = now(),
    updated_at = now()
FROM first_two ft
WHERE scl.id = ft.id;

DO $$
DECLARE
  v_progress_total BIGINT;
  v_progress_confirmed BIGINT;
  v_progress_discrepancies BIGINT;
BEGIN
  SELECT total_lines, confirmed_lines, discrepancy_lines
    INTO v_progress_total, v_progress_confirmed, v_progress_discrepancies
    FROM public.get_stock_count_progress('94000000-0000-0000-0000-000000000001');

  IF v_progress_total <> 1200 OR v_progress_confirmed <> 2 OR v_progress_discrepancies <> 1 THEN
    RAISE EXCEPTION 'COUNT-PAGE-8.2: progresso após contagem inválido: %, %, %',
      v_progress_total, v_progress_confirmed, v_progress_discrepancies;
  END IF;
END $$;

ROLLBACK;
