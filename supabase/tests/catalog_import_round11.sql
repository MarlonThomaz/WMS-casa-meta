BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
DO $$
DECLARE
  v_rows jsonb;
  v_result jsonb;
  v_invalid jsonb;
  v_initial_balances bigint;
  v_initial_movements bigint;
  v_initial_audit bigint;
  v_started timestamptz;
BEGIN
  SELECT count(*) INTO v_initial_balances FROM public.stock_balances;
  SELECT count(*) INTO v_initial_movements FROM public.movements;
  SELECT count(*) INTO v_initial_audit FROM public.audit_events;
  SELECT jsonb_agg(jsonb_build_object('line',i+1,'sku','R11-'||lpad(i::text,5,'0'),'name','Produto '||i,
    'unit_base','un','min_stock',0,'max_stock',10,'barcode','11'||lpad(i::text,11,'0')) ORDER BY i)
    INTO v_rows FROM generate_series(1,3000) i;
  v_started:=clock_timestamp();
  v_result:=public.import_product_catalog(v_rows,true);
  RAISE NOTICE 'Prévia 3000 SKUs: % ms',round(extract(epoch FROM clock_timestamp()-v_started)*1000);
  IF (v_result->>'ready')::int<>3000 OR (v_result->>'created')::int<>0 OR jsonb_array_length(v_result->'issues')<>0
    OR EXISTS(SELECT 1 FROM public.products WHERE sku LIKE 'R11-%') THEN
    RAISE EXCEPTION 'Prévia incorreta ou gravou dados: %',v_result;
  END IF;
  v_invalid:=v_rows||jsonb_build_array(jsonb_build_object('line',3002,'sku','R11-INVALID','name','Invalid','min_stock',9,'max_stock',8));
  v_result:=public.import_product_catalog(v_invalid,false);
  IF jsonb_array_length(v_result->'issues')<>1 OR (v_result->>'created')::int<>0 OR EXISTS(SELECT 1 FROM public.products WHERE sku LIKE 'R11-%') THEN
    RAISE EXCEPTION 'Arquivo com erro foi gravado';
  END IF;
  v_started:=clock_timestamp();
  v_result:=public.import_product_catalog(v_rows,false);
  RAISE NOTICE 'Gravação 3000 SKUs: % ms',round(extract(epoch FROM clock_timestamp()-v_started)*1000);
  IF (v_result->>'created')::int<>3000 OR (SELECT count(*) FROM public.products WHERE sku LIKE 'R11-%')<>3000 THEN
    RAISE EXCEPTION 'Importação 3000 produtos incorreta';
  END IF;
  IF (SELECT count(*) FROM public.product_barcodes b JOIN public.products p ON p.id=b.product_id WHERE p.sku LIKE 'R11-%' AND b.is_primary AND b.barcode='11'||lpad(substring(p.sku from 5)::int::text,11,'0'))<>3000
  THEN RAISE EXCEPTION 'Barcodes incompletos ou incorretos'; END IF;
  IF (SELECT count(*) FROM public.stock_balances)<>v_initial_balances OR (SELECT count(*) FROM public.movements)<>v_initial_movements THEN
    RAISE EXCEPTION 'Importação criou movimento ou saldo físico';
  END IF;
  IF (SELECT count(*) FROM public.audit_events)<>v_initial_audit+3000 THEN RAISE EXCEPTION 'Auditoria de importação incompleta'; END IF;
  v_result:=public.import_product_catalog(v_rows,false);
  IF (v_result->>'skipped')::int<>3000 OR (v_result->>'created')::int<>0 THEN RAISE EXCEPTION 'Importação repetida não idempotente'; END IF;
  v_invalid:=jsonb_build_array(jsonb_build_object('line',2,'sku','R11-00001','name','Alteração proibida'),
    jsonb_build_object('line',3,'sku','R11-NEW','name','Novo'),jsonb_build_object('line',4,'sku','R11-DUP','name','Duplicado','barcode','1100000000001'));
  v_result:=public.import_product_catalog(v_invalid,false);
  IF jsonb_array_length(v_result->'issues')<>2 OR EXISTS(SELECT 1 FROM public.products WHERE sku='R11-NEW') OR
    (SELECT name FROM public.products WHERE sku='R11-00001')<>'Produto 1' THEN
    RAISE EXCEPTION 'Conflito permitiu gravação parcial ou alteração';
  END IF;
  v_result:=public.import_product_catalog(jsonb_build_array(jsonb_build_object('line',2,'sku','R11-SEM-BC','name','Sem barcode')),false);
  IF (v_result->>'created')::int<>1 THEN RAISE EXCEPTION 'Barcode opcional falhou'; END IF;
  v_result:=public.import_product_catalog(jsonb_build_array(jsonb_build_object('line',2,'sku','r11-00001','name','Produto 1')),false);
  IF jsonb_array_length(v_result->'issues')<>1 THEN RAISE EXCEPTION 'Conflito de caixa não detectado'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.import_product_catalog('[{"line":2,"sku":"R11-UNAUTHORIZED","name":"Não"}]'::jsonb,false);
    RAISE EXCEPTION 'Operador pôde importar';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.import_product_catalog('[{"line":2,"sku":"X","name":"X"}]'::jsonb,true);
    RAISE EXCEPTION 'Viewer pôde validar';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.import_product_catalog('[{"line":2,"sku":"X","name":"X"}]'::jsonb,true);
    RAISE EXCEPTION 'Perfil desativado pôde validar';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.import_product_catalog('[{"line":2,"sku":"X","name":"X"}]'::jsonb,true);
    RAISE EXCEPTION 'Anon pôde validar';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
