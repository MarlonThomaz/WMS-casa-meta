import { useEffect, useState } from 'react';
import {
  Receipt,
  ReceiptWithLines,
  getReceipts,
  getReceiptById,
  getReceiptsByStatus,
  createReceiptWithLines,
  updateReceivedQuantity,
  confirmReceipt,
  cancelReceipt,
} from '../services/receiving';

export function useReceipts(filters?: {
  status?: Receipt['status'];
  limit?: number;
}) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = filters?.status
        ? await getReceiptsByStatus(filters.status, filters.limit || 100)
        : await getReceipts(filters?.limit || 100);

      setReceipts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar recebimentos');
      console.error('Erro ao carregar recebimentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReceipts();
  }, [filters?.status, filters?.limit]);

  return {
    receipts,
    loading,
    error,
    refresh: loadReceipts,
  };
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
