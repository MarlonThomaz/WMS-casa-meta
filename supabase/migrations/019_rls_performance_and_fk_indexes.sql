-- ========================================
-- WMS Casa Meta - Migration 019
-- Otimização de RLS + índices de FKs para Supabase hospedado
-- ========================================

CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON public.audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_movement_lines_movement_id ON public.movement_lines(movement_id);
CREATE INDEX IF NOT EXISTS idx_movement_lines_product_id ON public.movement_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_movement_lines_from_location_id ON public.movement_lines(from_location_id);
CREATE INDEX IF NOT EXISTS idx_movement_lines_to_location_id ON public.movement_lines(to_location_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_by ON public.movements(created_by);
CREATE INDEX IF NOT EXISTS idx_movements_operator_id ON public.movements(operator_id);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_product_id ON public.product_barcodes(product_id);
CREATE INDEX IF NOT EXISTS idx_receipt_lines_receipt_id ON public.receipt_lines(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_lines_product_id ON public.receipt_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_receipt_lines_location_id ON public.receipt_lines(location_id);
CREATE INDEX IF NOT EXISTS idx_receipts_created_by ON public.receipts(created_by);
CREATE INDEX IF NOT EXISTS idx_receipts_operator_id ON public.receipts(operator_id);
CREATE INDEX IF NOT EXISTS idx_shipment_lines_shipment_id ON public.shipment_lines(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_lines_product_id ON public.shipment_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_shipment_lines_from_location_id ON public.shipment_lines(from_location_id);
CREATE INDEX IF NOT EXISTS idx_shipments_created_by ON public.shipments(created_by);
CREATE INDEX IF NOT EXISTS idx_shipments_operator_id ON public.shipments(operator_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_location_id ON public.stock_balances(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_lines_stock_count_id ON public.stock_count_lines(stock_count_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_lines_product_id ON public.stock_count_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_lines_location_id ON public.stock_count_lines(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_counts_created_by ON public.stock_counts(created_by);
CREATE INDEX IF NOT EXISTS idx_stock_counts_location_id ON public.stock_counts(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_counts_operator_id ON public.stock_counts(operator_id);

DROP POLICY IF EXISTS stock_balances_write ON public.stock_balances;
DROP POLICY IF EXISTS stock_balances_service_write ON public.stock_balances;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING ((select auth.uid()) = id OR public.user_role() IN ('admin','manager'));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id OR public.user_role() = 'admin')
  WITH CHECK ((select auth.uid()) = id OR public.user_role() = 'admin');

DROP POLICY IF EXISTS products_select ON public.products;
DROP POLICY IF EXISTS products_insert ON public.products;
DROP POLICY IF EXISTS products_update ON public.products;
CREATE POLICY products_select ON public.products FOR SELECT TO authenticated USING (public.user_role() IS NOT NULL);
CREATE POLICY products_insert ON public.products FOR INSERT TO authenticated WITH CHECK (public.user_role() IN ('admin','manager','operator'));
CREATE POLICY products_update ON public.products FOR UPDATE TO authenticated USING (public.user_role() IN ('admin','manager','operator')) WITH CHECK (public.user_role() IN ('admin','manager','operator'));
DROP POLICY IF EXISTS stock_balances_select ON public.stock_balances;
CREATE POLICY stock_balances_select ON public.stock_balances FOR SELECT TO authenticated USING (public.user_role() IS NOT NULL);

DROP POLICY IF EXISTS locations_select ON public.locations; DROP POLICY IF EXISTS locations_insert ON public.locations; DROP POLICY IF EXISTS locations_update ON public.locations; DROP POLICY IF EXISTS locations_delete ON public.locations;
CREATE POLICY locations_select ON public.locations FOR SELECT TO authenticated USING (public.user_role() IS NOT NULL);
CREATE POLICY locations_insert ON public.locations FOR INSERT TO authenticated WITH CHECK (public.user_role() IN ('admin','manager'));
CREATE POLICY locations_update ON public.locations FOR UPDATE TO authenticated USING (public.user_role() IN ('admin','manager')) WITH CHECK (public.user_role() IN ('admin','manager'));
CREATE POLICY locations_delete ON public.locations FOR DELETE TO authenticated USING (public.user_role() IN ('admin','manager'));

DROP POLICY IF EXISTS product_barcodes_select ON public.product_barcodes; DROP POLICY IF EXISTS product_barcodes_insert ON public.product_barcodes; DROP POLICY IF EXISTS product_barcodes_update ON public.product_barcodes; DROP POLICY IF EXISTS product_barcodes_delete ON public.product_barcodes;
CREATE POLICY product_barcodes_select ON public.product_barcodes FOR SELECT TO authenticated USING (public.user_role() IS NOT NULL);
CREATE POLICY product_barcodes_insert ON public.product_barcodes FOR INSERT TO authenticated WITH CHECK (public.user_role() IN ('admin','manager','operator'));
CREATE POLICY product_barcodes_update ON public.product_barcodes FOR UPDATE TO authenticated USING (public.user_role() IN ('admin','manager','operator')) WITH CHECK (public.user_role() IN ('admin','manager','operator'));
CREATE POLICY product_barcodes_delete ON public.product_barcodes FOR DELETE TO authenticated USING (public.user_role() IN ('admin','manager'));

DROP POLICY IF EXISTS movements_select ON public.movements; DROP POLICY IF EXISTS movements_insert ON public.movements; DROP POLICY IF EXISTS movements_update_limited ON public.movements;
CREATE POLICY movements_select ON public.movements FOR SELECT TO authenticated USING (public.user_role() IS NOT NULL);
CREATE POLICY movements_insert ON public.movements FOR INSERT TO authenticated WITH CHECK (public.user_role() IN ('admin','manager','operator') AND created_by=(select auth.uid()));
CREATE POLICY movements_update_limited ON public.movements FOR UPDATE TO authenticated USING (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND status IN ('pending','in_progress') AND created_by=(select auth.uid()))) WITH CHECK (CASE WHEN public.user_role()='operator' THEN status IN ('pending','in_progress','cancelled') ELSE true END);

DROP POLICY IF EXISTS receipts_select ON public.receipts; DROP POLICY IF EXISTS receipts_insert ON public.receipts; DROP POLICY IF EXISTS receipts_update_limited ON public.receipts;
CREATE POLICY receipts_select ON public.receipts FOR SELECT TO authenticated USING (public.user_role() IS NOT NULL);
CREATE POLICY receipts_insert ON public.receipts FOR INSERT TO authenticated WITH CHECK (public.user_role() IN ('admin','manager','operator') AND created_by=(select auth.uid()));
CREATE POLICY receipts_update_limited ON public.receipts FOR UPDATE TO authenticated USING (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND status IN ('pending','partial') AND created_by=(select auth.uid()))) WITH CHECK (CASE WHEN public.user_role()='operator' THEN status IN ('pending','partial','cancelled') ELSE true END);

DROP POLICY IF EXISTS shipments_select ON public.shipments; DROP POLICY IF EXISTS shipments_insert ON public.shipments; DROP POLICY IF EXISTS shipments_update_limited ON public.shipments;
CREATE POLICY shipments_select ON public.shipments FOR SELECT TO authenticated USING (public.user_role() IS NOT NULL);
CREATE POLICY shipments_insert ON public.shipments FOR INSERT TO authenticated WITH CHECK (public.user_role() IN ('admin','manager','operator') AND created_by=(select auth.uid()));
CREATE POLICY shipments_update_limited ON public.shipments FOR UPDATE TO authenticated USING (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND status IN ('pending','picking','packed') AND created_by=(select auth.uid()))) WITH CHECK (CASE WHEN public.user_role()='operator' THEN status IN ('pending','picking','packed','cancelled') ELSE true END);

DROP POLICY IF EXISTS stock_counts_select ON public.stock_counts; DROP POLICY IF EXISTS stock_counts_insert ON public.stock_counts; DROP POLICY IF EXISTS stock_counts_update_limited ON public.stock_counts;
CREATE POLICY stock_counts_select ON public.stock_counts FOR SELECT TO authenticated USING (public.user_role() IS NOT NULL);
CREATE POLICY stock_counts_insert ON public.stock_counts FOR INSERT TO authenticated WITH CHECK (public.user_role() IN ('admin','manager','operator') AND created_by=(select auth.uid()));
CREATE POLICY stock_counts_update_limited ON public.stock_counts FOR UPDATE TO authenticated USING (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND status IN ('pending','in_progress') AND created_by=(select auth.uid()))) WITH CHECK (CASE WHEN public.user_role()='operator' THEN status IN ('pending','in_progress','cancelled') ELSE true END);

DROP POLICY IF EXISTS movement_lines_select ON public.movement_lines; DROP POLICY IF EXISTS movement_lines_insert ON public.movement_lines; DROP POLICY IF EXISTS movement_lines_update ON public.movement_lines; DROP POLICY IF EXISTS movement_lines_delete ON public.movement_lines;
CREATE POLICY movement_lines_select ON public.movement_lines FOR SELECT TO authenticated USING (public.user_role() IS NOT NULL);
CREATE POLICY movement_lines_insert ON public.movement_lines FOR INSERT TO authenticated WITH CHECK (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND EXISTS(SELECT 1 FROM public.movements m WHERE m.id=movement_id AND m.created_by=(select auth.uid()) AND m.status='pending')));
CREATE POLICY movement_lines_update ON public.movement_lines FOR UPDATE TO authenticated USING (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND EXISTS(SELECT 1 FROM public.movements m WHERE m.id=movement_id AND m.created_by=(select auth.uid()) AND m.status='pending'))) WITH CHECK (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND EXISTS(SELECT 1 FROM public.movements m WHERE m.id=movement_id AND m.created_by=(select auth.uid()) AND m.status='pending')));
CREATE POLICY movement_lines_delete ON public.movement_lines FOR DELETE TO authenticated USING (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND EXISTS(SELECT 1 FROM public.movements m WHERE m.id=movement_id AND m.created_by=(select auth.uid()) AND m.status='pending')));

DROP POLICY IF EXISTS receipt_lines_select ON public.receipt_lines; DROP POLICY IF EXISTS receipt_lines_insert ON public.receipt_lines; DROP POLICY IF EXISTS receipt_lines_update ON public.receipt_lines; DROP POLICY IF EXISTS receipt_lines_delete ON public.receipt_lines;
CREATE POLICY receipt_lines_select ON public.receipt_lines FOR SELECT TO authenticated USING (public.user_role() IS NOT NULL);
CREATE POLICY receipt_lines_insert ON public.receipt_lines FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.receipts r WHERE r.id=receipt_id AND r.status='pending' AND (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND r.created_by=(select auth.uid())))));
CREATE POLICY receipt_lines_update ON public.receipt_lines FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM public.receipts r WHERE r.id=receipt_id AND r.status IN ('pending','partial') AND (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND r.created_by=(select auth.uid()))))) WITH CHECK (EXISTS(SELECT 1 FROM public.receipts r WHERE r.id=receipt_id AND r.status IN ('pending','partial') AND (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND r.created_by=(select auth.uid())))));
CREATE POLICY receipt_lines_delete ON public.receipt_lines FOR DELETE TO authenticated USING (EXISTS(SELECT 1 FROM public.receipts r WHERE r.id=receipt_id AND r.status='pending' AND (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND r.created_by=(select auth.uid())))));

DROP POLICY IF EXISTS shipment_lines_select ON public.shipment_lines; DROP POLICY IF EXISTS shipment_lines_insert ON public.shipment_lines; DROP POLICY IF EXISTS shipment_lines_update ON public.shipment_lines; DROP POLICY IF EXISTS shipment_lines_delete ON public.shipment_lines;
CREATE POLICY shipment_lines_select ON public.shipment_lines FOR SELECT TO authenticated USING (public.user_role() IS NOT NULL);
CREATE POLICY shipment_lines_insert ON public.shipment_lines FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.shipments s WHERE s.id=shipment_id AND s.status='pending' AND (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND s.created_by=(select auth.uid())))));
CREATE POLICY shipment_lines_update ON public.shipment_lines FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM public.shipments s WHERE s.id=shipment_id AND s.status IN ('pending','picking') AND (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND s.created_by=(select auth.uid()))))) WITH CHECK (EXISTS(SELECT 1 FROM public.shipments s WHERE s.id=shipment_id AND s.status IN ('pending','picking') AND (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND s.created_by=(select auth.uid())))));
CREATE POLICY shipment_lines_delete ON public.shipment_lines FOR DELETE TO authenticated USING (EXISTS(SELECT 1 FROM public.shipments s WHERE s.id=shipment_id AND s.status='pending' AND (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND s.created_by=(select auth.uid())))));

DROP POLICY IF EXISTS stock_count_lines_select ON public.stock_count_lines; DROP POLICY IF EXISTS stock_count_lines_insert ON public.stock_count_lines; DROP POLICY IF EXISTS stock_count_lines_update ON public.stock_count_lines; DROP POLICY IF EXISTS stock_count_lines_delete ON public.stock_count_lines;
CREATE POLICY stock_count_lines_select ON public.stock_count_lines FOR SELECT TO authenticated USING (public.user_role() IS NOT NULL);
CREATE POLICY stock_count_lines_insert ON public.stock_count_lines FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.stock_counts c WHERE c.id=stock_count_id AND c.status='pending' AND (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND c.created_by=(select auth.uid())))));
CREATE POLICY stock_count_lines_update ON public.stock_count_lines FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM public.stock_counts c WHERE c.id=stock_count_id AND c.status IN ('pending','in_progress') AND (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND c.created_by=(select auth.uid()))))) WITH CHECK (EXISTS(SELECT 1 FROM public.stock_counts c WHERE c.id=stock_count_id AND c.status IN ('pending','in_progress') AND (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND c.created_by=(select auth.uid())))));
CREATE POLICY stock_count_lines_delete ON public.stock_count_lines FOR DELETE TO authenticated USING (EXISTS(SELECT 1 FROM public.stock_counts c WHERE c.id=stock_count_id AND c.status='pending' AND (public.user_role() IN ('admin','manager') OR (public.user_role()='operator' AND c.created_by=(select auth.uid())))));

DROP POLICY IF EXISTS audit_events_select ON public.audit_events; DROP POLICY IF EXISTS audit_events_insert ON public.audit_events;
CREATE POLICY audit_events_select ON public.audit_events FOR SELECT TO authenticated USING (public.user_role() IN ('admin','manager'));
CREATE POLICY audit_events_insert ON public.audit_events FOR INSERT TO authenticated WITH CHECK (false);
