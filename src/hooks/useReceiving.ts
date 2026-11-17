import { useCallback, useEffect, useState } from 'react';
import {useRequest} from './useRequest';
import {
  type Receipt,
  type ReceiptWithLines,
  getReceiptsPage,
  getReceiptsCounts,
  getReceiptById,
  createReceiptWithLines,
  updateReceivedQuantity,
  confirmReceipt,
  cancelReceipt,
} from '../services/receiving';

export function useReceipts(page=1,status='all') {
  const request=useCallback(async()=>{
    const [result,summary]=await Promise.all([getReceiptsPage(page,status),getReceiptsCounts()]);
    return {result,summary};
  },[page,status]);
  const {value,loading,error,refresh}=useRequest(JSON.stringify([page,status]),request);
  return {receipts:value?.result.items??[],total:value?.result.total??0,summary:value?.summary,loading,error,refresh};
}

export function useReceipt(id: string | null) {
  const [receipt, setReceipt] = useState<ReceiptWithLines | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReceipt = async () => {
    if (!id) {
      setReceipt(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setReceipt(await getReceiptById(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar recebimento');
      console.error('Erro ao carregar recebimento:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReceipt();
  }, [id]);

  return { receipt, loading, error, refresh: loadReceipt };
}

export function useCreateReceipt() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createNewReceipt = async (params: {
    supplier_name: string;
    supplier_reference?: string;
    expected_date?: string;
    dock?: string;
    notes?: string;
    lines: Array<{
      product_id: string;
      expected_quantity: number;
      location_id?: string;
      unit?: string;
      notes?: string;
    }>;
  }) => {
    try {
      setLoading(true);
      setError(null);
      return await createReceiptWithLines(params);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar recebimento';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createNewReceipt, loading, error };
}

export function useConfirmReceipt() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async (receiptId: string) => {
    try {
      setLoading(true);
      setError(null);
      await confirmReceipt(receiptId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao confirmar recebimento';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { confirm, loading, error };
}

export function useCancelReceipt() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async (receiptId: string) => {
    try {
      setLoading(true);
      setError(null);
      await cancelReceipt(receiptId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cancelar recebimento';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { cancel, loading, error };
}

export function useUpdateReceivedQuantity() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (lineId: string, quantity: number) => {
    try {
      setLoading(true);
      setError(null);
      await updateReceivedQuantity(lineId, quantity);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar quantidade';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { update, loading, error };
}
