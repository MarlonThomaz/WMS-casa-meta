-- ========================================
-- WMS Casa Meta - Migration 014
-- Auditoria automática de produtos e localizações
-- ========================================

CREATE OR REPLACE FUNCTION public.audit_catalog_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type TEXT;
  v_entity_type TEXT;
  v_entity_id UUID;
  v_details JSONB;
BEGIN
  -- Seeds e manutenção administrativa fora de uma sessão autenticada
  -- não geram eventos atribuídos a um usuário inexistente.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'products' THEN
    v_entity_type := 'product';
    v_entity_id := NEW.id;
    v_event_type := CASE TG_OP
      WHEN 'INSERT' THEN 'product_created'
      ELSE 'product_updated'
    END;

    v_details := CASE TG_OP
      WHEN 'INSERT' THEN jsonb_build_object(
        'sku', NEW.sku,
        'name', NEW.name,
        'category', NEW.category,
        'active', NEW.active
      )
      ELSE jsonb_build_object(
        'sku', NEW.sku,
        'before', jsonb_build_object(
          'name', OLD.name,
          'category', OLD.category,
          'unit_base', OLD.unit_base,
          'min_stock', OLD.min_stock,
          'max_stock', OLD.max_stock,
          'active', OLD.active
        ),
        'after', jsonb_build_object(
          'name', NEW.name,
          'category', NEW.category,
          'unit_base', NEW.unit_base,
          'min_stock', NEW.min_stock,
          'max_stock', NEW.max_stock,
          'active', NEW.active
        )
      )
    END;

  ELSIF TG_TABLE_NAME = 'locations' THEN
    v_entity_type := 'location';
    v_entity_id := NEW.id;
    v_event_type := CASE TG_OP
      WHEN 'INSERT' THEN 'location_created'
      ELSE 'location_updated'
    END;

    v_details := CASE TG_OP
      WHEN 'INSERT' THEN jsonb_build_object(
        'code', NEW.code,
        'zone', NEW.zone,
        'location_type', NEW.location_type,
        'status', NEW.status
      )
      ELSE jsonb_build_object(
        'code', NEW.code,
        'before', jsonb_build_object(
          'zone', OLD.zone,
          'aisle', OLD.aisle,
          'rack', OLD.rack,
          'level', OLD.level,
          'location_type', OLD.location_type,
          'capacity', OLD.capacity,
          'status', OLD.status
        ),
        'after', jsonb_build_object(
          'zone', NEW.zone,
          'aisle', NEW.aisle,
          'rack', NEW.rack,
          'level', NEW.level,
          'location_type', NEW.location_type,
          'capacity', NEW.capacity,
          'status', NEW.status
        )
      )
    END;
  ELSE
    RAISE EXCEPTION 'Tabela não suportada para auditoria de catálogo: %', TG_TABLE_NAME;
  END IF;

  PERFORM public.log_audit_event(
    v_event_type,
    v_entity_type,
    v_entity_id,
    v_details
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_catalog_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_catalog_change() FROM authenticated;

DROP TRIGGER IF EXISTS trg_audit_product_change ON public.products;
CREATE TRIGGER trg_audit_product_change
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_catalog_change();

DROP TRIGGER IF EXISTS trg_audit_location_change ON public.locations;
CREATE TRIGGER trg_audit_location_change
  AFTER INSERT OR UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_catalog_change();
