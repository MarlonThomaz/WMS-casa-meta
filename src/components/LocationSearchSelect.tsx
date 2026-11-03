import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import {
  searchLocations,
  searchProductSourceLocations,
  type LocationSearchOption,
} from '../services/locationSearch';

type LocationSearchSelectProps = {
  value: LocationSearchOption | null;
  onChange: (location: LocationSearchOption | null) => void;
  mode: 'source' | 'destination' | 'any';
  productId?: string;
  placeholder?: string;
  disabled?: boolean;
  excludeIds?: string[];
};

function secondaryLabel(location: LocationSearchOption): string {
  const parts = [
    `Zona ${location.zone}`,
    location.aisle ? `Corredor ${location.aisle}` : null,
    location.rack ? `Estante ${location.rack}` : null,
    location.level ? `Nível ${location.level}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

export default function LocationSearchSelect({
  value,
  onChange,
  mode,
  productId,
  placeholder,
  disabled = false,
  excludeIds = [],
}: LocationSearchSelectProps) {
  const selectedLabel = value?.code || '';
  const sourceUnavailable = mode === 'source' && !productId;
  const effectiveDisabled = disabled || sourceUnavailable;
  const [query, setQuery] = useState(selectedLabel);
  const [results, setResults] = useState<LocationSearchOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const excludeKey = useMemo(() => [...new Set(excludeIds)].sort().join('|'), [excludeIds]);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    if (!open || effectiveDisabled) return;

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
        const found = mode === 'source'
          ? await searchProductSourceLocations(productId || '', query, 20)
          : await searchLocations(query, 20, mode === 'destination');

        if (requestId !== requestIdRef.current) return;
        const excluded = excludeKey ? new Set(excludeKey.split('|')) : new Set<string>();
        setResults(found.filter((location) => !excluded.has(location.id)));
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setResults([]);
        setError(err instanceof Error ? err.message : 'Erro ao buscar endereços');
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [effectiveDisabled, excludeKey, mode, open, productId, query, selectedLabel, value]);

  const resolvedPlaceholder = sourceUnavailable
    ? 'Selecione o produto primeiro'
    : placeholder || (
      mode === 'source'
        ? 'Buscar endereço de origem...'
        : mode === 'destination'
          ? 'Buscar endereço de destino...'
          : 'Buscar endereço...'
    );

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          disabled={effectiveDisabled}
          placeholder={resolvedPlaceholder}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            if (value && next !== selectedLabel) onChange(null);
          }}
          className="w-full border rounded-lg pl-8 pr-8 py-2 bg-white disabled:bg-slate-100 disabled:text-slate-400"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
        )}
      </div>

      {open && !effectiveDisabled && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {error && <div className="px-3 py-2 text-xs text-red-600">{error}</div>}
          {!error && !loading && results.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-400">
              {mode === 'source'
                ? 'Nenhum endereço com saldo disponível para este produto.'
                : mode === 'destination'
                  ? 'Nenhum endereço disponível encontrado.'
                  : 'Nenhum endereço encontrado.'}
            </div>
          )}
          {results.map((location) => (
            <button
              key={location.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(location);
                setQuery(location.code);
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-slate-100 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-semibold text-slate-800 truncate">{location.code}</span>
                </div>
                {mode === 'source' && location.available_quantity !== undefined && (
                  <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full shrink-0">
                    disp. {location.available_quantity}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 ml-6">
                {secondaryLabel(location)}
                {mode !== 'source' && location.total_quantity !== undefined
                  ? ` · armazenado ${location.total_quantity}`
                  : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
