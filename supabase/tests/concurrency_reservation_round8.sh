#!/usr/bin/env bash
set -euo pipefail

OPERATOR_ID='10000000-0000-0000-0000-000000000002'
REF_A='TEST-R8-CONCURRENT-RES-A'
REF_B='TEST-R8-CONCURRENT-RES-B'

PRODUCT_ID="$(psql -Atqc "SELECT id FROM public.products WHERE sku = 'SKU-005' LIMIT 1")"
LOCATION_ID="$(psql -Atqc "SELECT id FROM public.locations WHERE code = 'PICK-02' LIMIT 1")"
AVAILABLE="$(psql -Atqc "SELECT available_quantity FROM public.stock_balances WHERE product_id = '$PRODUCT_ID'::uuid AND location_id = '$LOCATION_ID'::uuid")"

if [[ -z "$PRODUCT_ID" || -z "$LOCATION_ID" || -z "$AVAILABLE" ]]; then
  echo 'CONCURRENCY-8.1: fixture de produto/localização/saldo não encontrada' >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF $AVAILABLE::numeric <= 0 THEN
    RAISE EXCEPTION 'CONCURRENCY-8.1: saldo disponível da fixture precisa ser positivo';
  END IF;
END
\$\$;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '$OPERATOR_ID', 'role', 'authenticated')::text,
  false
);
SELECT set_config('wms.internal_status_transition', 'off', false);

SELECT public.create_shipment_with_lines(
  'Cliente concorrência A',
  '$REF_A',
  NULL,
  'medium',
  CURRENT_DATE,
  'Regressão de reserva concorrente A',
  jsonb_build_array(
    jsonb_build_object(
      'product_id', '$PRODUCT_ID',
      'requested_quantity', $AVAILABLE::numeric,
      'from_location_id', '$LOCATION_ID',
      'unit', 'un'
    )
  )
);

SELECT public.create_shipment_with_lines(
  'Cliente concorrência B',
  '$REF_B',
  NULL,
  'medium',
  CURRENT_DATE,
  'Regressão de reserva concorrente B',
  jsonb_build_array(
    jsonb_build_object(
      'product_id', '$PRODUCT_ID',
      'requested_quantity', $AVAILABLE::numeric,
      'from_location_id', '$LOCATION_ID',
      'unit', 'un'
    )
  )
);
SQL

SHIPMENT_A="$(psql -Atqc "SELECT id FROM public.shipments WHERE customer_reference = '$REF_A' ORDER BY created_at DESC LIMIT 1")"
SHIPMENT_B="$(psql -Atqc "SELECT id FROM public.shipments WHERE customer_reference = '$REF_B' ORDER BY created_at DESC LIMIT 1")"

if [[ -z "$SHIPMENT_A" || -z "$SHIPMENT_B" ]]; then
  echo 'CONCURRENCY-8.1: expedições de fixture não foram criadas' >&2
  exit 1
fi

# A primeira conexão reserva o saldo e mantém o row lock por alguns segundos.
(
  psql -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '$OPERATOR_ID', 'role', 'authenticated')::text,
  true
);
SELECT set_config('wms.internal_status_transition', 'off', true);
SELECT public.reserve_stock_for_shipment('$SHIPMENT_A'::uuid);
SELECT pg_sleep(3);
COMMIT;
SQL
) >/tmp/annona-concurrency-a.log 2>&1 &
PID_A=$!

# Dá tempo para A adquirir o lock de stock_balances.
sleep 0.6

# B deve bloquear até A commitar e então enxergar o saldo já reservado.
set +e
psql -v ON_ERROR_STOP=1 <<SQL >/tmp/annona-concurrency-b.log 2>&1
BEGIN;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '$OPERATOR_ID', 'role', 'authenticated')::text,
  true
);
SELECT set_config('wms.internal_status_transition', 'off', true);
SELECT public.reserve_stock_for_shipment('$SHIPMENT_B'::uuid);
COMMIT;
SQL
STATUS_B=$?
set -e

wait "$PID_A"

if [[ "$STATUS_B" -eq 0 ]]; then
  echo 'CONCURRENCY-8.1: segunda reserva concorrente foi aceita indevidamente' >&2
  cat /tmp/annona-concurrency-a.log >&2 || true
  cat /tmp/annona-concurrency-b.log >&2 || true
  exit 1
fi

if ! grep -qi 'Estoque insuficiente' /tmp/annona-concurrency-b.log; then
  echo 'CONCURRENCY-8.1: segunda conexão falhou por motivo inesperado' >&2
  cat /tmp/annona-concurrency-b.log >&2 || true
  exit 1
fi

psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE
  v_status_a TEXT;
  v_status_b TEXT;
  v_quantity NUMERIC;
  v_reserved NUMERIC;
  v_available NUMERIC;
BEGIN
  SELECT status INTO v_status_a FROM public.shipments WHERE id = '$SHIPMENT_A'::uuid;
  SELECT status INTO v_status_b FROM public.shipments WHERE id = '$SHIPMENT_B'::uuid;
  SELECT quantity, reserved_quantity, available_quantity
    INTO v_quantity, v_reserved, v_available
    FROM public.stock_balances
   WHERE product_id = '$PRODUCT_ID'::uuid
     AND location_id = '$LOCATION_ID'::uuid;

  IF v_status_a <> 'picking' THEN
    RAISE EXCEPTION 'CONCURRENCY-8.1: primeira expedição deveria estar picking, recebeu %', v_status_a;
  END IF;

  IF v_status_b <> 'pending' THEN
    RAISE EXCEPTION 'CONCURRENCY-8.1: segunda expedição deveria permanecer pending, recebeu %', v_status_b;
  END IF;

  IF v_reserved > v_quantity OR v_available < 0 THEN
    RAISE EXCEPTION 'CONCURRENCY-8.1: overbooking detectado: quantity %, reserved %, available %',
      v_quantity, v_reserved, v_available;
  END IF;
END
\$\$;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '$OPERATOR_ID', 'role', 'authenticated')::text,
  false
);
SELECT set_config('wms.internal_status_transition', 'off', false);
SELECT public.release_shipment_reservations('$SHIPMENT_A'::uuid);
SQL

echo 'CONCURRENCY-8.1: reserva concorrente protegida por row lock e saldo disponível.'
