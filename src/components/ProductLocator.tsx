import { AlertCircle, Loader2, MapPin, PackageSearch, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { searchStockLocations, type StockBalanceWithDetails } from '../services/stock';

export default function ProductLocator() {
  const [search, setSearch] = useState('');
  const [balances, setBalances] = useState<StockBalanceWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = search.trim();

  useEffect(() => {
    if (normalized.length < 2) {
      setBalances([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await searchStockLocations(normalized, 100);
        if (!cancelled) setBalances(result);
      } catch (err) {
        if (!cancelled) {
          setBalances([]);
          setError(err instanceof Error ? err.message : 'Erro ao localizar estoque');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [normalized]);

  const totalFound = balances.reduce((sum, balance) => sum + Number(balance.quantity || 0), 0);

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <PackageSearch className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Localizar produto</h1>
            <p className="text-slate-500">Descubra rapidamente em quais endereços físicos cada mercadoria está armazenada.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
        <label htmlFor="stock-locator-search" className="block text-sm font-medium text-slate-700 mb-2">
          Produto ou endereço
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            id="stock-locator-search"
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Digite SKU, nome, categoria, zona ou endereço (ex.: SKU-005 ou B-02-01-01)"
            className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Digite ao menos 2 caracteres. A busca é executada no servidor e retorna até 100 posições com saldo físico positivo.
        </p>
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Pesquisando posições de estoque...
        </div>
      ) : normalized.length < 2 ? (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center">
          <PackageSearch className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="font-medium text-slate-700">Comece digitando um produto ou endereço.</p>
          <p className="text-sm text-slate-500 mt-1">Você pode procurar SKU, nome, categoria, zona ou posição física.</p>
        </div>
      ) : balances.length === 0 && !error ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
          Nenhuma mercadoria com saldo foi encontrada para “{search}”.
        </div>
      ) : balances.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm text-slate-500">Resultados</p>
              <p className="font-semibold text-slate-800">{balances.length} posição(ões) encontrada(s)</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Quantidade física nas posições exibidas</p>
              <p className="text-xl font-bold text-slate-800">{totalFound.toLocaleString('pt-BR')}</p>
            </div>
          </div>

          <div className="grid gap-3">
            {balances.map((balance) => {
              const product = balance.products;
              const location = balance.locations;

              return (
                <article key={balance.id} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-blue-700">{product?.sku || 'SKU desconhecido'}</span>
                        {product?.category && (
                          <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">{product.category}</span>
                        )}
                      </div>
                      <h2 className="text-lg font-semibold text-slate-800 mt-1">{product?.name || 'Produto não identificado'}</h2>
                    </div>

                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 min-w-[220px]">
                      <MapPin className="w-6 h-6 text-blue-700 shrink-0" />
                      <div>
                        <p className="text-xs text-blue-700/70">Endereço físico</p>
                        <p className="font-mono font-bold text-blue-900 text-lg">{location?.code || '—'}</p>
                        <p className="text-xs text-blue-800">Zona {location?.zone || '—'} · {location?.location_type || '—'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 pt-4 border-t border-slate-100">
                    <Quantity label="Físico" value={Number(balance.quantity || 0)} />
                    <Quantity label="Reservado" value={Number(balance.reserved_quantity || 0)} />
                    <Quantity label="Disponível" value={Number(balance.available_quantity || 0)} />
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Quantity({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-800">{value.toLocaleString('pt-BR')}</p>
    </div>
  );
}
