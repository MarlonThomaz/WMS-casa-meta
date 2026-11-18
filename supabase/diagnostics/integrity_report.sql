-- Diagnostic report only. Do not "fix" anomalies by editing stock_balances.
-- Run as an authorized DBA on a read replica or in an isolated restore.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT 'products' AS entity,count(*) FROM public.products
UNION ALL SELECT 'barcodes',count(*) FROM public.product_barcodes
UNION ALL SELECT 'locations',count(*) FROM public.locations
UNION ALL SELECT 'balances',count(*) FROM public.stock_balances
UNION ALL SELECT 'receipts',count(*) FROM public.receipts
UNION ALL SELECT 'shipments',count(*) FROM public.shipments
UNION ALL SELECT 'movements',count(*) FROM public.movements
UNION ALL SELECT 'stock_counts',count(*) FROM public.stock_counts
UNION ALL SELECT 'audit_events',count(*) FROM public.audit_events;
SELECT id,product_id,location_id,quantity,reserved_quantity,available_quantity
FROM public.stock_balances
WHERE quantity<0 OR reserved_quantity<0 OR reserved_quantity>quantity
  OR available_quantity IS DISTINCT FROM quantity-reserved_quantity;
-- Picking reservations versus balance; findings need human review and an audit trail.
WITH expected AS(
  SELECT l.product_id,l.from_location_id location_id,sum(l.requested_quantity) expected
  FROM public.shipment_lines l JOIN public.shipments s ON s.id=l.shipment_id
  WHERE s.status='picking' AND NOT l.reservations_released
  GROUP BY l.product_id,l.from_location_id
)
SELECT coalesce(e.product_id,b.product_id) product_id,coalesce(e.location_id,b.location_id) location_id,
  coalesce(e.expected,0) expected,coalesce(b.reserved_quantity,0) reserved
FROM expected e FULL JOIN public.stock_balances b ON b.product_id=e.product_id AND b.location_id=e.location_id
WHERE coalesce(e.expected,0) IS DISTINCT FROM coalesce(b.reserved_quantity,0);
SELECT l.id,l.receipt_id,l.received_quantity,l.processed_quantity FROM public.receipt_lines l
WHERE processed_quantity<0 OR processed_quantity>received_quantity;
SELECT l.id,l.shipment_id,l.requested_quantity,l.picked_quantity,l.reservations_released,s.status
FROM public.shipment_lines l JOIN public.shipments s ON s.id=l.shipment_id
WHERE picked_quantity<0 OR picked_quantity>requested_quantity OR (s.status IN ('packed','shipped') AND NOT l.reservations_released);
SELECT c.id,c.count_number,count(*) FILTER(WHERE l.counted_at IS NULL) unconfirmed
FROM public.stock_counts c JOIN public.stock_count_lines l ON l.stock_count_id=c.id
WHERE c.status='completed' GROUP BY c.id,c.count_number HAVING count(*) FILTER(WHERE l.counted_at IS NULL)>0;
ROLLBACK;
