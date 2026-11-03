-- ========================================
-- Annona Mercis WMS - Regressão de escala do localizador
-- 3.000 SKUs e 6.000 saldos, tudo revertido ao final.
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

INSERT INTO public.locations (
  code, zone, aisle, rack, level, location_type, capacity, status
)
SELECT
  'PERF-L-' || lpad(gs::text, 3, '0'),
  'PERF',
  lpad(((gs - 1) / 20 + 1)::text, 2, '0'),
  lpad(((gs - 1) % 20 + 1)::text, 2, '0'),
  '01',
  'storage',
  100000,
  'available'
FROM generate_series(1, 60) AS gs;

INSERT INTO public.products (
  sku, name, description, category, unit_base, min_stock, max_stock, active
)
SELECT
  'PERF-SKU-' || lpad(gs::text, 5, '0'),
  'Produto de performance ' || lpad(gs::text, 5, '0'),
  'Fixture temporária de teste de escala',
  CASE WHEN gs % 2 = 0 THEN 'PERF-A' ELSE 'PERF-B' END,
  'un',
  0,
  10000,
  true
FROM generate_series(1, 3000) AS gs;

-- Cada SKU ocupa duas posições diferentes: 6.000 linhas de saldo.
WITH numbered_products AS (
  SELECT
    id,
    row_number() OVER (ORDER BY sku) AS rn
  FROM public.products
  WHERE sku LIKE 'PERF-SKU-%'
),
numbered_locations AS (
  SELECT
    id,
    row_number() OVER (ORDER BY code) AS rn
  FROM public.locations
  WHERE code LIKE 'PERF-L-%'
)
INSERT INTO public.stock_balances (
  product_id,
  location_id,
  quantity,
  reserved_quantity,
  last_movement_at
)
SELECT
  p.id,
  l.id,
  100 + slot,
  0,
  now()
FROM numbered_products p
CROSS JOIN generate_series(0, 1) AS slot
JOIN numbered_locations l
  ON l.rn = (((p.rn - 1) * 2 + slot) % 60) + 1;

DO $$
DECLARE
  v_products BIGINT;
  v_balances BIGINT;
  v_exact_rows BIGINT;
  v_name_rows BIGINT;
  v_limited_rows BIGINT;
  v_expected_dashboard_products BIGINT;
  v_dashboard_products BIGINT;
  v_expected_dashboard_stock NUMERIC;
  v_dashboard_stock NUMERIC;
  v_started TIMESTAMPTZ;
  v_elapsed INTERVAL;
BEGIN
  SELECT count(*) INTO v_products
  FROM public.products
  WHERE sku LIKE 'PERF-SKU-%';

  SELECT count(*) INTO v_balances
  FROM public.stock_balances sb
  JOIN public.products p ON p.id = sb.product_id
  WHERE p.sku LIKE 'PERF-SKU-%';

  IF v_products <> 3000 THEN
    RAISE EXCEPTION 'LOAD-8.1: esperado 3000 SKUs, encontrado %', v_products;
  END IF;

  IF v_balances <> 6000 THEN
    RAISE EXCEPTION 'LOAD-8.1: esperado 6000 saldos, encontrado %', v_balances;
  END IF;

  v_started := clock_timestamp();
  SELECT count(*) INTO v_exact_rows
  FROM public.search_stock_locations('PERF-SKU-02999', 100);
  v_elapsed := clock_timestamp() - v_started;

  IF v_exact_rows <> 2 THEN
    RAISE EXCEPTION 'LOAD-8.1: SKU exato deveria retornar 2 posições, retornou %', v_exact_rows;
  END IF;

  IF v_elapsed > interval '3 seconds' THEN
    RAISE EXCEPTION 'LOAD-8.1: busca exata excedeu 3s: %', v_elapsed;
  END IF;

  v_started := clock_timestamp();
  SELECT count(*) INTO v_name_rows
  FROM public.search_stock_locations('Produto de performance 02999', 100);
  v_elapsed := clock_timestamp() - v_started;

  IF v_name_rows <> 2 THEN
    RAISE EXCEPTION 'LOAD-8.1: busca por nome deveria retornar 2 posições, retornou %', v_name_rows;
  END IF;

  IF v_elapsed > interval '3 seconds' THEN
    RAISE EXCEPTION 'LOAD-8.1: busca por nome excedeu 3s: %', v_elapsed;
  END IF;

  -- Consulta ampla deve respeitar o limite e nunca despejar o armazém inteiro no cliente.
  SELECT count(*) INTO v_limited_rows
  FROM public.search_stock_locations('PERF', 100);

  IF v_limited_rows <> 100 THEN
    RAISE EXCEPTION 'LOAD-8.1: limite esperado 100, retornado %', v_limited_rows;
  END IF;

  -- O dashboard deve agregar no banco e retornar o universo completo,
  -- sem depender de qualquer limite de linhas da API/PostgREST.
  SELECT count(*)
    INTO v_expected_dashboard_products
    FROM public.products
   WHERE active = true;

  SELECT COALESCE(SUM(sb.quantity), 0)
    INTO v_expected_dashboard_stock
    FROM public.products p
    LEFT JOIN public.stock_balances sb ON sb.product_id = p.id
   WHERE p.active = true;

  SELECT total_products, total_stock
    INTO v_dashboard_products, v_dashboard_stock
    FROM public.get_dashboard_stats();

  IF v_dashboard_products <> v_expected_dashboard_products THEN
    RAISE EXCEPTION 'LOAD-8.2: dashboard contou % produtos, esperado %',
      v_dashboard_products, v_expected_dashboard_products;
  END IF;

  IF v_dashboard_stock <> v_expected_dashboard_stock THEN
    RAISE EXCEPTION 'LOAD-8.2: dashboard somou % unidades, esperado %',
      v_dashboard_stock, v_expected_dashboard_stock;
  END IF;
END $$;

ROLLBACK;
