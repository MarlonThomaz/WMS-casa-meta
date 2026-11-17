import { useCallback,useEffect,useRef,useState } from 'react';

// Discard late results when switching page, query or count. Never expose data
// from a previous key as if it belonged to the newly selected page.
export function useRequest<T>(key: string, request: () => Promise<T>) {
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

