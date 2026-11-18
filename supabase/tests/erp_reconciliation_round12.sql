BEGIN;
-- Fixtures are created by CI owner and reverted at the end. No real stock changes.
INSERT INTO public.locations(code,zone,location_type,status) VALUES
  ('R12-LOC-A','R12','storage','available'),('R12-LOC-B','R12','storage','available');
INSERT INTO public.products(sku,name,unit_base,active) VALUES
  ('R12-PHYS','Physical','un',true),('R12-ZERO','Zero','un',true),
  ('R12-INACTIVE','Inactive','un',false),('R12-OMITTED','Omitted','un',true);
INSERT INTO public.stock_balances(product_id,location_id,quantity,reserved_quantity)
SELECT p.id,l.id,CASE l.code WHEN 'R12-LOC-A' THEN 5.25 ELSE 4.75 END,
  CASE l.code WHEN 'R12-LOC-A' THEN 2 ELSE 1 END
FROM public.products p CROSS JOIN public.locations l
WHERE p.sku='R12-PHYS' AND l.code IN ('R12-LOC-A','R12-LOC-B');
INSERT INTO public.products(sku,name,unit_base) SELECT 'R12-BULK-'||i,'Bulk '||i,'un' FROM generate_series(1,3000) i;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
DO $$
DECLARE
  r jsonb; a jsonb; q jsonb; old_balances jsonb; old_audit bigint; old_movements bigint; old_products bigint; n bigint;
BEGIN
  SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) INTO old_balances FROM public.stock_balances b;
  SELECT count(*) INTO old_audit FROM public.audit_events;
  SELECT count(*) INTO old_movements FROM public.movements;
  SELECT count(*) INTO old_products FROM public.products;
  q:='[{"line":2,"sku":"R12-PHYS","unit":"UN","quantity":"10.000000"},{"line":3,"sku":"R12-ZERO","unit":"un","quantity":"0"},{"line":4,"sku":"R12-INACTIVE","unit":"un","quantity":"0"},{"line":5,"sku":"R12-UNKNOWN","unit":"un","quantity":"0"}]'::jsonb;
  r:=public.reconcile_erp_stock(q,'physical');
  IF jsonb_array_length(r->'rows')<>4 OR (r->>'unlisted_active')::bigint<3001 THEN RAISE EXCEPTION 'Truncated or omitted count invalid'; END IF;
  a:=r->'rows'->0;
  IF a->>'status'<>'match' OR (a->>'wms_physical')::numeric<>10 OR (a->>'wms_reserved')::numeric<>3 OR (a->>'wms_available')::numeric<>7 OR (a->>'difference')::numeric<>0 THEN RAISE EXCEPTION 'Physical comparison failed: %',a; END IF;
  IF r->'rows'->1->>'status'<>'match' OR r->'rows'->2->>'status'<>'inactive' OR r->'rows'->3->>'status'<>'unknown_sku' OR r->'rows'->3->>'difference' IS NOT NULL THEN RAISE EXCEPTION 'Zero/inactive/unknown comparison failed'; END IF;
  r:=public.reconcile_erp_stock(q,'available');a:=r->'rows'->0;
  IF a->>'status'<>'difference' OR (a->>'difference')::numeric<>3 THEN RAISE EXCEPTION 'Available comparison failed'; END IF;
  r:=public.reconcile_erp_stock('[{"line":2,"sku":"R12-PHYS","unit":"cx","quantity":"1"}]'::jsonb,'physical');a:=r->'rows'->0;
  IF a->>'status'<>'unit_mismatch' OR a->>'difference' IS NOT NULL THEN RAISE EXCEPTION 'Unit mismatch must block numeric comparison'; END IF;
  r:=public.reconcile_erp_stock('[{"line":2,"sku":"r12-phys","unit":"un","quantity":"10"}]'::jsonb,'physical');
  IF r->'rows'->0->>'status'<>'unknown_sku' THEN RAISE EXCEPTION 'SKU case silently guessed'; END IF;
  BEGIN
    PERFORM public.reconcile_erp_stock('[{"line":2,"sku":"R12-ZERO","unit":"un","quantity":"0"},{"line":3,"sku":"r12-zero","unit":"un","quantity":"2"}]'::jsonb,'physical');
    RAISE EXCEPTION 'duplicate not rejected';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Linhas inválidas%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.reconcile_erp_stock('[{"line":2,"sku":"R12-ZERO","unit":"un","quantity":"-2"}]'::jsonb,'physical');
    RAISE EXCEPTION 'negative not rejected';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Linhas inválidas%' THEN RAISE; END IF; END;
  SELECT jsonb_agg(jsonb_build_object('line',i+1,'sku','R12-BULK-'||i,'unit','un','quantity','0') ORDER BY i)
    INTO q FROM generate_series(1,3000) i;
  r:=public.reconcile_erp_stock(q,'physical');
  SELECT count(*) INTO n FROM jsonb_array_elements(r->'rows') x WHERE x->>'status'='match';
  IF n<>3000 OR jsonb_array_length(r->'rows')<>3000 OR r->'rows'->2999->>'sku'<>'R12-BULK-3000'
    THEN RAISE EXCEPTION '3000 row reconciliation truncated'; END IF;
  IF (SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM public.stock_balances b) IS DISTINCT FROM old_balances
    OR (SELECT count(*) FROM public.products)<>old_products OR (SELECT count(*) FROM public.audit_events)<>old_audit
    OR (SELECT count(*) FROM public.movements)<>old_movements THEN RAISE EXCEPTION 'Reconciliation modified stock or events'; END IF;
  RAISE NOTICE 'Round 12: 3000 rows, physical/available, missing and unit mismatch, no mutations passed';
END $$;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.reconcile_erp_stock('[{"line":2,"sku":"X","unit":"un","quantity":"0"}]'::jsonb,'physical');
    RAISE EXCEPTION 'operator unauthorized';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.reconcile_erp_stock('[{"line":2,"sku":"X","unit":"un","quantity":"0"}]'::jsonb,'physical');
    RAISE EXCEPTION 'disabled unauthorized';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.reconcile_erp_stock('[{"line":2,"sku":"X","unit":"un","quantity":"0"}]'::jsonb,'physical');
    RAISE EXCEPTION 'anon unauthorized';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
