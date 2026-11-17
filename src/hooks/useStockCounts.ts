import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getStockCountsPage, getStockCountById, getStockCountLinesPage, getStockCountProgress,
  type StockCount, type StockCountPage, type StockCountLinePage, type CountProgress,
} from '../services/stockCounts';

// Discard late results when switching page, query or count. Never expose data
// from a previous key as if it belonged to the newly selected page.
function useRequest<T>(key: string, request: () => Promise<T>) {
  const [result, setResult] = useState<{key:string;value:T} | null>(null);
  const [failure, setFailure] = useState<{key:string;message:string} | null>(null);
  const [pending, setPending] = useState(true);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++generation.current;
    setPending(true);
    setFailure(null);
    try {
      const value = await request();
      if (id === generation.current) setResult({key,value});
    } catch (err) {
      if (id === generation.current) {
        setResult(null);
        setFailure({key,message:err instanceof Error ? err.message : 'Erro ao carregar dados'});
      }
    } finally {
      if (id === generation.current) setPending(false);
    }
  }, [key,request]);
  useEffect(() => {
    void refresh();
    return () => { generation.current++; };
  }, [refresh]);
  const value = result?.key === key ? result.value : null;
  const error = failure?.key === key ? failure.message : null;
  return {value,loading:pending || (!result && !failure) || (value === null && !error && result?.key !== key),error,refresh};
}

export function useStockCounts(page = 1, pageSize = 50) {
  const request = useCallback(() => getStockCountsPage(page,pageSize),[page,pageSize]);
  const {value,loading,error,refresh} = useRequest<StockCountPage>(`${page}/${pageSize}`,request);
  return {counts:value?.items ?? [],total:value?.total ?? 0,loading,error,refresh};
}
export function useStockCount(countId: string) {
  const request = useCallback(() => getStockCountById(countId),[countId]);
  const {value,loading,error,refresh} = useRequest<StockCount | null>(countId,request);
  return {count:value,loading,error,refresh};
}
export function useStockCountLines(countId: string, query: string, page:number, pageSize = 50) {
  const request = useCallback(async () => {
    const [lines,progress] = await Promise.all([
      getStockCountLinesPage(countId,query,page,pageSize),getStockCountProgress(countId),
    ]);
    return {lines,progress};
  },[countId,query,page,pageSize]);
  const {value,loading,error,refresh} = useRequest<{lines:StockCountLinePage;progress:CountProgress}>(JSON.stringify([countId,query,page,pageSize]),request);
  return {lines:value?.lines.items ?? [],total:value?.lines.total ?? 0,progress:value?.progress ?? null,loading,error,refresh};
}
