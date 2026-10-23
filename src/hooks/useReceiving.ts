import { useState, useEffect } from 'react';
import { Receipt, ReceiptWithLines, getReceipts, getReceiptById, getReceiptsByStatus, createReceipt, addReceiptLine, updateReceivedQuantity, confirmReceipt, cancelReceipt } from '../services/receiving';

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
      
      let data: Receipt[];
      
      if (filters?.status) {
        data = await getReceiptsByStatus(filters.status);
      } else {
        data = await getReceipts(filters?.limit || 100);
      }
      
      setReceipts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar recebimentos');
      console.error('Erro ao carregar recebimentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, [filters?.status, filters?.limit]);

  const refresh = async () => {
    await loadReceipts();
  };

  return {
    receipts,
    loading,
    error,
    refresh,
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
      const data = await getReceiptById(id);
      setReceipt(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar recebimento');
      console.error('Erro ao carregar recebimento:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipt();
  }, [id]);

  const refresh = async () => {
    await loadReceipt();
  };

  return { receipt, loading, error, refresh };
}

export function useCreateReceipt() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createNewReceipt = async (params: {
    supplier_name: string;
    supplier_reference?: string;
    expected_date?: string;
    dock?: string;
    operator_id?: string;
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
      
      // Criar recebimento
      const receipt = await createReceipt({
        supplier_name: params.supplier_name,
        supplier_reference: params.supplier_reference,
        expected_date: params.expected_date,
        dock: params.dock,
        operator_id: params.operator_id,
        notes: params.notes,
      });

      // Adicionar linhas
      for (const line of params.lines) {
        await addReceiptLine({
          receipt_id: receipt.id,
          product_id: line.product_id,
          expected_quantity: line.expected_quantity,
          location_id: line.location_id,
          unit: line.unit,
          notes: line.notes,
        });
      }

      return receipt;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar recebimento';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    createNewReceipt,
    loading,
    error,
  };
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

  return {
    confirm,
    loading,
    error,
  };
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

  return {
    cancel,
    loading,
    error,
  };
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

  return {
    update,
    loading,
    error,
  };
}
