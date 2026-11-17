import { useCallback, useEffect, useState } from 'react';
import {useRequest} from './useRequest';
import {
  type Movement,
  type MovementWithLines,
  createAndProcessMovement,
  getMovementById,
  getMovementsPage,
  getMovementsCounts,
} from '../services/movements';

export function useMovements(page=1,type='all',status='all',term='') {
  const request=useCallback(async()=>{
    const [result,summary]=await Promise.all([getMovementsPage(page,type,status,term),getMovementsCounts()]);
    return {result,summary};
  },[page,type,status,term]);
  const {value,loading,error,refresh}=useRequest(JSON.stringify([page,type,status,term]),request);
  return {movements:value?.result.items??[],total:value?.result.total??0,summary:value?.summary,loading,error,refresh};
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
