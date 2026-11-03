import { useEffect, useState } from 'react';
import {
  type Movement,
  type MovementWithLines,
  createAndProcessMovement,
  getMovementById,
  getMovements,
} from '../services/movements';

export function useMovements(limit = 100) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMovements = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMovements(limit);
      setMovements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar movimentações');
      console.error('Erro ao carregar movimentações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMovements();
  }, [limit]);

  return { movements, loading, error, refresh: loadMovements };
}

export function useMovement(id: string | null) {
  const [movement, setMovement] = useState<MovementWithLines | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMovement = async () => {
    if (!id) {
      setMovement(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMovement(await getMovementById(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar movimentação');
      console.error('Erro ao carregar movimentação:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMovement();
  }, [id]);

  return { movement, loading, error, refresh: loadMovement };
}

export function useCreateMovement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMovement = async (params: {
    movement_type: Exclude<Movement['movement_type'], 'count'>;
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
      return await createAndProcessMovement(params);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar movimentação';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createMovement, loading, error };
}
