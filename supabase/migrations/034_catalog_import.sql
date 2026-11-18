-- Controlled onboarding: create-only catalog import; no balances or movements.
-- Atomic full-file commit, with the same validation re-run under catalog locks.
CREATE OR REPLACE FUNCTION public.import_product_catalog(p_rows jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_role text := public.user_role();
  v_dry boolean := COALESCE(p_dry_run,true);
  v_ready integer;
  v_skipped integer;
  v_created integer := 0;
  v_issues jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_role IS NULL OR v_role NOT IN ('admin','manager') THEN
    RAISE EXCEPTION 'Somente administrador ou gerente ativo pode importar o catálogo' USING ERRCODE='42501';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Informe uma lista de produtos';
  END IF;
  IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 5000 OR octet_length(p_rows::text) > 10000000 THEN
    RAISE EXCEPTION 'Limite: 1 a 5000 linhas e 10 MB de dados JSON';
  END IF;

  -- Prevent concurrent catalog writes changing validation during the commit.
  -- Dry run is read-only and does not block catalog writes.
  IF NOT v_dry THEN
    LOCK TABLE public.products, public.product_barcodes IN SHARE ROW EXCLUSIVE MODE;
  END IF;

  WITH normalized AS (
    SELECT r.line, btrim(r.sku) sku, btrim(r.name) name,
      nullif(btrim(r.description),'') description, nullif(btrim(r.category),'') category,
      coalesce(nullif(btrim(r.unit_base),''),'un') unit_base,
      coalesce(r.min_stock,0) min_stock, r.max_stock, nullif(btrim(r.barcode),'') barcode
    FROM jsonb_to_recordset(p_rows) AS r(line integer,sku text,name text,description text,category text,
        unit_base text,min_stock numeric,max_stock numeric,barcode text)
  ), tagged AS (
    SELECT n.*, count(*) OVER (PARTITION BY lower(n.sku)) sku_count,
      count(*) OVER (PARTITION BY n.barcode) barcode_count,
      count(*) OVER (PARTITION BY n.line) line_count
    FROM normalized n
  ), inspected AS (
    SELECT n.*, CASE
      WHEN n.line IS NULL OR n.line < 2 OR n.line_count > 1 THEN 'Número de linha inválido ou repetido'
      WHEN n.sku IS NULL OR n.sku = '' OR length(n.sku)>128 THEN 'SKU obrigatório (máximo 128 caracteres)'
      WHEN n.name IS NULL OR n.name = '' OR length(n.name)>500 THEN 'Nome obrigatório (máximo 500 caracteres)'
      WHEN length(n.description)>2000 OR length(n.category)>200 OR length(n.unit_base)>32 OR length(n.barcode)>200 THEN 'Campo excede o tamanho permitido'
      WHEN n.min_stock::text IN ('NaN','Infinity','-Infinity') OR n.max_stock::text IN ('NaN','Infinity','-Infinity')
        OR n.min_stock < 0 OR n.max_stock < n.min_stock THEN 'Estoque mínimo/máximo inválido'
      WHEN n.sku_count > 1 THEN 'SKU repetido no arquivo'
      WHEN n.barcode IS NOT NULL AND n.barcode_count > 1 THEN 'Código de barras repetido no arquivo'
      WHEN existing.matches > 1 THEN 'Mais de um SKU equivalente no banco; revisar manualmente'
      WHEN existing.matches = 1 AND (
        p.sku IS DISTINCT FROM n.sku OR NOT p.active OR
        p.name IS DISTINCT FROM n.name OR nullif(btrim(p.description),'') IS DISTINCT FROM n.description OR
        nullif(btrim(p.category),'') IS DISTINCT FROM n.category OR p.unit_base IS DISTINCT FROM n.unit_base OR
        p.min_stock IS DISTINCT FROM n.min_stock OR p.max_stock IS DISTINCT FROM n.max_stock OR
        (n.barcode IS NOT NULL AND (b.product_id IS DISTINCT FROM p.id OR NOT b.is_primary))
      ) THEN 'SKU existente com dados diferentes ou inativo; nenhuma alteração será feita'
      WHEN existing.matches = 0 AND b.id IS NOT NULL THEN 'Código de barras já vinculado a outro produto'
      ELSE NULL END AS issue,
      existing.matches
    FROM tagged n
    CROSS JOIN LATERAL (
      SELECT count(*) matches, min(p0.id::text)::uuid product_id FROM public.products p0
      WHERE lower(p0.sku)=lower(n.sku)
    ) existing
    LEFT JOIN public.products p ON p.id=existing.product_id
    LEFT JOIN public.product_barcodes b ON b.barcode=n.barcode
  )
  SELECT count(*) FILTER (WHERE issue IS NULL AND matches=0),
         count(*) FILTER (WHERE issue IS NULL AND matches=1),
         coalesce(jsonb_agg(jsonb_build_object('line',line,'sku',sku,'message',issue) ORDER BY line)
           FILTER (WHERE issue IS NOT NULL),'[]'::jsonb)
    INTO v_ready,v_skipped,v_issues FROM inspected;

  IF NOT v_dry AND jsonb_array_length(v_issues)=0 AND v_ready>0 THEN
    WITH normalized AS (
      SELECT btrim(r.sku) sku,btrim(r.name) name,
        nullif(btrim(r.description),'') description,nullif(btrim(r.category),'') category,
        coalesce(nullif(btrim(r.unit_base),''),'un') unit_base,
        coalesce(r.min_stock,0) min_stock,r.max_stock,nullif(btrim(r.barcode),'') barcode
      FROM jsonb_to_recordset(p_rows) AS r(sku text,name text,description text,category text,
          unit_base text,min_stock numeric,max_stock numeric,barcode text)
    ), new_rows AS (
      SELECT n.* FROM normalized n WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE lower(p.sku)=lower(n.sku))
    ), created AS (
      INSERT INTO public.products(sku,name,description,category,unit_base,min_stock,max_stock,active)
      SELECT sku,name,description,category,unit_base,min_stock,max_stock,true FROM new_rows
      RETURNING id,sku
    ), codes AS (
      INSERT INTO public.product_barcodes(product_id,barcode,barcode_type,packaging_type,quantity_per_package,is_primary)
      SELECT c.id,n.barcode,CASE WHEN n.barcode ~ '^[0-9]{13}$' THEN 'EAN13'
        WHEN n.barcode ~ '^[0-9]{8}$' THEN 'EAN8' ELSE 'OTHER' END,'unit',1,true
      FROM created c JOIN new_rows n ON n.sku=c.sku WHERE n.barcode IS NOT NULL
      RETURNING id
    )
    SELECT count(*) INTO v_created FROM created;
    IF v_created <> v_ready THEN RAISE EXCEPTION 'Quantidade importada diverge da validação'; END IF;
  END IF;
  RETURN jsonb_build_object('total',jsonb_array_length(p_rows),'ready',v_ready,'skipped',v_skipped,
    'created',v_created,'issues',v_issues,'dryRun',v_dry);
END $$;

REVOKE ALL ON FUNCTION public.import_product_catalog(jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.import_product_catalog(jsonb,boolean) TO authenticated;
