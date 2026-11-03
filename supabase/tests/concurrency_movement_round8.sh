#!/usr/bin/env bash
set -euo pipefail

OPERATOR_ID='10000000-0000-0000-0000-000000000002'
REF_A='TEST-R8-CONCURRENT-MOVE-A'
REF_B='TEST-R8-CONCURRENT-MOVE-B'
REF_CLEANUP='TEST-R8-CONCURRENT-MOVE-CLEANUP'

PRODUCT_ID="$(psql -Atqc "SELECT id FROM public.products WHERE sku = 'SKU-005' LIMIT 1")"
ORIGIN_ID="$(psql -Atqc "SELECT id FROM public.locations WHERE code = 'PICK-02' LIMIT 1")"
DESTINATION_ID="$(psql -Atqc "SELECT id FROM public.locations WHERE id <> '$ORIGIN_ID'::uuid AND status IN ('available','occupied') ORDER BY code LIMIT 1")"
AVAILABLE="$(psql -Atqc "SELECT available_quantity FROM public.stock_balances WHERE product_id = '$PRODUCT_ID'::uuid AND location_id = '$ORIGIN_ID'::uuid")"

if [[ -z "$PRODUCT_ID" || -z "$ORIGIN_ID" || -z "$DESTINATION_ID" || -z "$AVAILABLE" ]]; then
  echo 'CONCURRENCY-8.2: fixture de produto/localização/saldo não encontrada' >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF $AVAILABLE::numeric <= 0 THEN
    RAISE EXCEPTION 'CONCURRENCY-8.2: saldo disponível da fixture precisa ser positivo';
  END IF;
END
\$\$;
SQL

# A primeira conexão transfere todo o saldo disponível e mantém a transação aberta,
# preservando o row lock da origem enquanto a segunda conexão tenta usar o mesmo saldo.
(
  psql -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '$OPERATOR_ID', 'role', 'authenticated')::text,
  true
);
SELECT set_config('wms.internal_status_transition', 'off', true);
SELECT public.create_and_process_movement(
  'transfer',
  '$REF_A',
  'Regressão de transferência concorrente A',
  jsonb_build_array(
    jsonb_build_object(
      'product_id', '$PRODUCT_ID',
      'from_location_id', '$ORIGIN_ID',
      'to_location_id', '$DESTINATION_ID',
      'quantity', $AVAILABLE::numeric,
      'unit', 'un'
    )
  )
);
SELECT pg_sleep(3);
COMMIT;
SQL
) >/tmp/annona-movement-a.log 2>&1 &
PID_A=$!

sleep 0.6

# A segunda conexão deve aguardar o lock e, após o commit de A,
# rejeitar a mesma transferência por saldo disponível insuficiente.
set +e
psql -v ON_ERROR_STOP=1 <<SQL >/tmp/annona-movement-b.log 2>&1
BEGIN;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '$OPERATOR_ID', 'role', 'authenticated')::text,
  true
);
SELECT set_config('wms.internal_status_transition', 'off', true);
SELECT public.create_and_process_movement(
  'transfer',
  '$REF_B',
  'Regressão de transferência concorrente B',
  jsonb_build_array(
    jsonb_build_object(
      'product_id', '$PRODUCT_ID',
      'from_location_id', '$ORIGIN_ID',
      'to_location_id', '$DESTINATION_ID',
      'quantity', $AVAILABLE::numeric,
      'unit', 'un'
    )
  )
);
COMMIT;
SQL
STATUS_B=$?
set -e

wait "$PID_A"

if [[ "$STATUS_B" -eq 0 ]]; then
  echo 'CONCURRENCY-8.2: segunda transferência concorrente foi aceita indevidamente' >&2
  cat /tmp/annona-movement-a.log >&2 || true
  cat /tmp/annona-movement-b.log >&2 || true
  exit 1
fi

if ! grep -qi 'Estoque disponível insuficiente' /tmp/annona-movement-b.log; then
  echo 'CONCURRENCY-8.2: segunda conexão falhou por motivo inesperado' >&2
  cat /tmp/annona-movement-b.log >&2 || true
  exit 1
fi

psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE
  v_origin_quantity NUMERIC;
  v_origin_reserved NUMERIC;
  v_origin_available NUMERIC;
  v_a_count INTEGER;
  v_b_count INTEGER;
BEGIN
  SELECT quantity, reserved_quantity, available_quantity
    INTO v_origin_quantity, v_origin_reserved, v_origin_available
    FROM public.stock_balances
   WHERE product_id = '$PRODUCT_ID'::uuid
     AND location_id = '$ORIGIN_ID'::uuid;

  SELECT COUNT(*) INTO v_a_count
    FROM public.movements
   WHERE source_reference = '$REF_A'
     AND status = 'completed';

  SELECT COUNT(*) INTO v_b_count
    FROM public.movements
   WHERE source_reference = '$REF_B';

  IF v_a_count <> 1 THEN
    RAISE EXCEPTION 'CONCURRENCY-8.2: primeira transferência não concluiu exatamente uma vez';
  END IF;

  IF v_b_count <> 0 THEN
    RAISE EXCEPTION 'CONCURRENCY-8.2: tentativa concorrente rejeitada deixou movimento órfão';
  END IF;

  IF v_origin_quantity < 0 OR v_origin_reserved > v_origin_quantity OR v_origin_available < 0 THEN
    RAISE EXCEPTION 'CONCURRENCY-8.2: saldo inválido após disputa: quantity %, reserved %, available %',
      v_origin_quantity, v_origin_reserved, v_origin_available;
  END IF;
END
\$\$;

-- Restaura a fixture para os testes seguintes, movendo exatamente a quantidade
-- que a primeira conexão transferiu.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '$OPERATOR_ID', 'role', 'authenticated')::text,
  false
);
SELECT set_config('wms.internal_status_transition', 'off', false);
SELECT public.create_and_process_movement(
  'transfer',
  '$REF_CLEANUP',
  'Restauração da fixture após teste concorrente',
  jsonb_build_array(
    jsonb_build_object(
      'product_id', '$PRODUCT_ID',
      'from_location_id', '$DESTINATION_ID',
      'to_location_id', '$ORIGIN_ID',
      'quantity', $AVAILABLE::numeric,
      'unit', 'un'
    )
  )
);
SQL

echo 'CONCURRENCY-8.2: movimentação física concorrente serializada sem saldo negativo ou órfão.'
