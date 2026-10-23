import { useState, useEffect } from 'react';
import { Movement, MovementWithLines, getMovements, getMovementById, getMovementsByType, getMovementsByStatus, createAndProcessMovement } from '../services/movements';

export function useMovements(filters?: {
  type?: Movement['movement_type'];
  status?: Movement['status'];
  limit?: number;
}) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMovements = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let data: Movement[];
      
      if (filters?.type) {
        data = await getMovementsByType(filters.type);
      } else if (filters?.status) {
        data = await getMovementsByStatus(filters.status);
      } else {
        data = await getMovements(filters?.limit || 100);
      }
      
      setMovements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar movimentações');
      console.error('Erro ao carregar movimentações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [filters?.type, filters?.status, filters?.limit]);

  const refresh = async () => {
    await loadMovements();
  };

  return {
    movements,
    loading,
    error,
    refresh,
  };
}

export function useMovement(id: string | null) {
  const [movement, setMovement] = useState<MovementWithLines | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setMovement(null);
      return;
    }

    const loadMovement = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMovementById(id);
        setMovement(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar movimentação');
        console.error('Erro ao carregar movimentação:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMovement();
  }, [id]);

  return { movement, loading, error };
}

export function useCreateMovement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMovement = async (params: {
    movement_type: Movement['movement_type'];
    operator_id?: string;
    source_reference?: string;
    notes?: string;
    lines: Array<{
      product_id: string;
      from_location_id?: string;
      to_location_id?: string;
      quantity: number;
      unit?: string;
      notes?: string;
    }>;
  }) => {
    try {
      setLoading(true);
      setError(null);
      const result = await createAndProcessMovement(params);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar movimentação';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    createMovement,
    loading,
    error,
  };
}
