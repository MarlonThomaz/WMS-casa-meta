import { useCallback } from 'react';
import {useRequest} from './useRequest';
import {
  getStockCountsPage, getStockCountById, getStockCountLinesPage, getStockCountProgress,
  type StockCount, type StockCountPage, type StockCountLinePage, type CountProgress,
} from '../services/stockCounts';

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
