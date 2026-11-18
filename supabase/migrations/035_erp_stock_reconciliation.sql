-- ERP exchange pilot: read-only comparison, no automatic inventory updates.
-- Whole WMS instance = one declared warehouse. ERP snapshot may be partial;
-- missing rows are never interpreted as zero. Exact, case-sensitive SKU.
CREATE OR REPLACE FUNCTION public.reconcile_erp_stock(p_rows jsonb, p_basis text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.user_role();
  v_report jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_role IS NULL OR v_role NOT IN ('admin','manager') THEN
    RAISE EXCEPTION 'Somente administrador ou gerente ativo pode conciliar estoque ERP' USING ERRCODE='42501';
  END IF;
  IF p_basis IS NULL OR p_basis NOT IN ('physical','available') THEN
    RAISE EXCEPTION 'Tipo de saldo inválido';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Lista de saldos obrigatória';
  END IF;
  IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 5000 OR octet_length(p_rows::text)>10000000 THEN
    RAISE EXCEPTION 'Limite: 1 a 5000 linhas e 10 MB de JSON';
  END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_to_recordset(p_rows) AS r(line integer,sku text,unit text,quantity text)
    WHERE line IS NULL OR line<2 OR sku IS NULL OR btrim(sku)='' OR length(btrim(sku))>128
       OR unit IS NULL OR btrim(unit)='' OR length(btrim(unit))>32
       OR quantity IS NULL OR quantity !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$'
  ) OR EXISTS(
    SELECT 1 FROM jsonb_to_recordset(p_rows) AS r(line integer,sku text)
    GROUP BY lower(btrim(sku)) HAVING count(*)>1
  ) OR EXISTS(
    SELECT 1 FROM jsonb_to_recordset(p_rows) AS r(line integer)
    GROUP BY line HAVING count(*)>1
  ) THEN
    RAISE EXCEPTION 'Linhas inválidas ou repetidas; corrija o arquivo antes da conciliação';
  END IF;
  WITH input AS (
    SELECT line,btrim(sku) sku,btrim(unit) unit,quantity::numeric quantity
    FROM jsonb_to_recordset(p_rows) AS r(line integer,sku text,unit text,quantity text)
  ), balances AS (
    SELECT b.product_id,sum(b.quantity) physical,sum(b.reserved_quantity) reserved,
      sum(b.available_quantity) available
    FROM public.stock_balances b
    JOIN public.products p ON p.id=b.product_id
    JOIN input i ON i.sku=p.sku
    GROUP BY b.product_id
  ), compared AS (
    SELECT i.line,i.sku,i.unit erp_unit,i.quantity erp_quantity,p.unit_base wms_unit,
      CASE WHEN p.id IS NOT NULL THEN coalesce(b.physical,0) END wms_physical,
      CASE WHEN p.id IS NOT NULL THEN coalesce(b.reserved,0) END wms_reserved,
      CASE WHEN p.id IS NOT NULL THEN coalesce(b.available,0) END wms_available,
      CASE WHEN p.id IS NOT NULL AND p.active AND lower(btrim(p.unit_base))=lower(i.unit)
        THEN i.quantity-CASE p_basis WHEN 'physical' THEN coalesce(b.physical,0) ELSE coalesce(b.available,0) END
      END difference,
      CASE WHEN p.id IS NULL THEN 'unknown_sku'
        WHEN NOT p.active THEN 'inactive'
        WHEN lower(btrim(p.unit_base))<>lower(i.unit) THEN 'unit_mismatch'
        WHEN i.quantity=CASE p_basis WHEN 'physical' THEN coalesce(b.physical,0) ELSE coalesce(b.available,0) END THEN 'match'
        ELSE 'difference' END status
    FROM input i LEFT JOIN public.products p ON p.sku=i.sku
    LEFT JOIN balances b ON b.product_id=p.id
  )
  SELECT jsonb_build_object('basis',p_basis,'compared_at',statement_timestamp(),
    'unlisted_active',(SELECT count(*) FROM public.products p WHERE p.active AND NOT EXISTS(SELECT 1 FROM input i WHERE i.sku=p.sku)),
    'rows',coalesce(jsonb_agg(jsonb_build_object(
      'line',line,'sku',sku,'erp_unit',erp_unit,'erp_quantity',erp_quantity::text,
      'wms_unit',wms_unit,'wms_physical',wms_physical::text,'wms_reserved',wms_reserved::text,
      'wms_available',wms_available::text,'difference',difference::text,'status',status) ORDER BY line),'[]'::jsonb))
  INTO v_report FROM compared;
  RETURN v_report;
END $$;
REVOKE ALL ON FUNCTION public.reconcile_erp_stock(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_erp_stock(jsonb,text) TO authenticated;
