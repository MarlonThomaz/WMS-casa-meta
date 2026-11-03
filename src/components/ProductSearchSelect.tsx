import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { searchProductsPage } from '../services/products';
import type { ProductWithStock } from '../types';

type ProductSearchSelectProps = {
  value: ProductWithStock | null;
  onChange: (product: ProductWithStock | null) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function ProductSearchSelect({
  value,
  onChange,
  placeholder = 'Buscar SKU ou produto...',
  disabled = false,
}: ProductSearchSelectProps) {
  const selectedLabel = useMemo(
    () => (value ? `${value.sku} — ${value.name}` : ''),
    [value]
  );
  const [query, setQuery] = useState(selectedLabel);
  const [results, setResults] = useState<ProductWithStock[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    if (!open || disabled) return;

    if (value && query === selectedLabel) {
      setResults([value]);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await searchProductsPage(query, 20, 0);
        if (requestId !== requestIdRef.current) return;
        setResults(result.items);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setResults([]);
        setError(err instanceof Error ? err.message : 'Erro ao buscar produtos');
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [disabled, open, query, selectedLabel, value]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            if (value && next !== selectedLabel) onChange(null);
          }}
          className="w-full border rounded-lg pl-8 pr-8 py-2 bg-white disabled:bg-slate-100"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {error && <div className="px-3 py-2 text-xs text-red-600">{error}</div>}
          {!error && !loading && results.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-400">Nenhum produto encontrado.</div>
          )}
          {results.map((product) => (
            <button
              key={product.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(product);
                setQuery(`${product.sku} — ${product.name}`);
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-slate-100 last:border-b-0"
            >
              <div className="text-sm font-medium text-slate-800">{product.sku} — {product.name}</div>
              <div className="text-xs text-slate-500">
                {product.category || 'Sem categoria'} · saldo {product.total_stock} {product.unit_base}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
