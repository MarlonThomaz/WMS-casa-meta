-- Deterministic output used to compare source and isolated restore in CI.
SELECT 'auth.users|'||count(*) FROM auth.users
UNION ALL SELECT 'profiles|'||count(*) FROM public.profiles
UNION ALL SELECT 'products|'||count(*) FROM public.products
UNION ALL SELECT 'product_barcodes|'||count(*) FROM public.product_barcodes
UNION ALL SELECT 'locations|'||count(*) FROM public.locations
UNION ALL SELECT 'stock_balances|'||count(*) FROM public.stock_balances
UNION ALL SELECT 'movements|'||count(*) FROM public.movements
UNION ALL SELECT 'movement_lines|'||count(*) FROM public.movement_lines
UNION ALL SELECT 'receipts|'||count(*) FROM public.receipts
UNION ALL SELECT 'receipt_lines|'||count(*) FROM public.receipt_lines
UNION ALL SELECT 'shipments|'||count(*) FROM public.shipments
UNION ALL SELECT 'shipment_lines|'||count(*) FROM public.shipment_lines
UNION ALL SELECT 'stock_counts|'||count(*) FROM public.stock_counts
UNION ALL SELECT 'stock_count_lines|'||count(*) FROM public.stock_count_lines
UNION ALL SELECT 'audit_events|'||count(*) FROM public.audit_events ORDER BY 1;
