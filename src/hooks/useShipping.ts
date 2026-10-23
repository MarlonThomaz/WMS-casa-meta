import { useState, useEffect } from 'react';
import { Shipment, ShipmentWithLines, getShipments, getShipmentById, getShipmentsByStatus, getShipmentsByPriority, createShipment, addShipmentLine, startPicking, confirmPickedQuantity, confirmPacked, confirmShipped, cancelShipment } from '../services/shipping';

export function useShipments(filters?: {
  status?: Shipment['status'];
  priority?: Shipment['priority'];
  limit?: number;
}) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadShipments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let data: Shipment[];
      
      if (filters?.status) {
        data = await getShipmentsByStatus(filters.status);
      } else if (filters?.priority) {
        data = await getShipmentsByPriority(filters.priority);
      } else {
        data = await getShipments(filters?.limit || 100);
      }
      
      setShipments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar expedições');
      console.error('Erro ao carregar expedições:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipments();
  }, [filters?.status, filters?.priority, filters?.limit]);

  const refresh = async () => {
    await loadShipments();
  };

  return {
    shipments,
    loading,
    error,
    refresh,
  };
}

export function useShipment(id: string | null) {
  const [shipment, setShipment] = useState<ShipmentWithLines | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadShipment = async () => {
    if (!id) {
      setShipment(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getShipmentById(id);
      setShipment(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar expedição');
      console.error('Erro ao carregar expedição:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipment();
  }, [id]);

  const refresh = async () => {
    await loadShipment();
  };

  return { shipment, loading, error, refresh };
}

export function useCreateShipment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createNewShipment = async (params: {
    customer_name: string;
    customer_reference?: string;
    carrier?: string;
    priority?: Shipment['priority'];
    expected_date?: string;
    operator_id?: string;
    notes?: string;
    lines: Array<{
      product_id: string;
      requested_quantity: number;
      from_location_id?: string;
      unit?: string;
      notes?: string;
    }>;
  }) => {
    try {
      setLoading(true);
      setError(null);
      
      // Criar expedição
      const shipment = await createShipment({
        customer_name: params.customer_name,
        customer_reference: params.customer_reference,
        carrier: params.carrier,
        priority: params.priority,
        expected_date: params.expected_date,
        operator_id: params.operator_id,
        notes: params.notes,
      });

      // Adicionar linhas
      for (const line of params.lines) {
        await addShipmentLine({
          shipment_id: shipment.id,
          product_id: line.product_id,
          requested_quantity: line.requested_quantity,
          from_location_id: line.from_location_id,
          unit: line.unit,
          notes: line.notes,
        });
      }

      return shipment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar expedição';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    createNewShipment,
    loading,
    error,
  };
}

export function useStartPicking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (shipmentId: string) => {
    try {
      setLoading(true);
      setError(null);
      await startPicking(shipmentId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao iniciar separação';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    start,
    loading,
    error,
  };
}

export function useConfirmPacked() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async (shipmentId: string) => {
    try {
      setLoading(true);
      setError(null);
      await confirmPacked(shipmentId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao confirmar embalagem';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    confirm,
    loading,
    error,
  };
}

export function useConfirmShipped() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async (shipmentId: string) => {
    try {
      setLoading(true);
      setError(null);
      await confirmShipped(shipmentId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao confirmar despacho';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    confirm,
    loading,
    error,
  };
}

export function useCancelShipment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async (shipmentId: string) => {
    try {
      setLoading(true);
      setError(null);
      await cancelShipment(shipmentId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cancelar expedição';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    cancel,
    loading,
    error,
  };
}

export function useConfirmPickedQuantity() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (lineId: string, quantity: number) => {
    try {
      setLoading(true);
      setError(null);
      await confirmPickedQuantity(lineId, quantity);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar quantidade';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    update,
    loading,
    error,
  };
}
