import { useEffect, useRef, useState } from 'react';
import { accessCopy, searchCopy, type OfflineCopy } from '../offline/storage';
import { syncCopy } from '../offline/sync';

export default function OfflineCatalog({ online, userId, onBack }: {
  online: boolean;
  userId?: string;
  onBack?: () => void;
}) {
  const [copy, setCopy] = useState<OfflineCopy | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    accessCopy().then(value => {
      if (active) setCopy(value && (!userId || value.userId === userId) ? value : null);
    }).catch(() => { if (active) setError('O navegador não permitiu acessar a cópia local.'); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; controller.current?.abort(); };
  }, [userId]);

  async function update() {
    if (!userId) return;
    const current = new AbortController();
    controller.current = current;
    const timeout = window.setTimeout(() => current.abort(), 60000);
    setBusy(true);
    setError('');
    try {
      setCopy(await syncCopy(userId, current.signal));
    } catch (err) {
      setError(current.signal.aborted ? 'A atualização foi interrompida. Tente novamente com conexão.'
        : err instanceof Error ? err.message : 'Falha ao atualizar a cópia.');
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }

  async function remove() {
    controller.current?.abort();
    try { await accessCopy(null); setCopy(null); }
    catch { setError('Não foi possível apagar a cópia local.'); }
  }

  const results = copy ? searchCopy(copy, query) : [];
  const locations = new Map(copy?.locations.map(l => [l.id, l]));
  return (
    <main className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Consulta offline</h1>
      <p className="text-slate-600">Consulte produtos e endereços salvos neste aparelho. Os saldos são uma referência da última atualização. Movimentações precisam de conexão.</p>
      {onBack && <button onClick={onBack} className="text-blue-700 underline">Voltar ao sistema</button>}
      {online && !userId && <p>Conexão restabelecida. Entre novamente para atualizar os dados.</p>}
      {online && userId && <div className="space-y-2">
        <p className="text-sm">Ao salvar, você permite consultar estes dados neste navegador sem internet. Use um aparelho de confiança. A atualização pode acompanhar mudanças feitas durante a coleta.</p>
        <button disabled={busy} onClick={() => void update()} className="bg-blue-700 text-white rounded-lg px-4 py-2 disabled:opacity-50">{busy ? 'Atualizando…' : 'Salvar / atualizar cópia offline'}</button>
      </div>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {!loaded && <p>Carregando cópia…</p>}
      {loaded && !copy && <p>Este navegador ainda não tem uma cópia disponível. Conecte-se, entre no sistema e salve o catálogo para consulta offline.</p>}
      {copy && <>
        <p role="status" className="bg-amber-100 p-3 rounded-lg">Cópia de {new Date(copy.savedAt).toLocaleString('pt-BR')} · {copy.products.length} produtos · {copy.locations.length} endereços</p>
        <label className="block">SKU, produto, código de barras ou endereço
          <input value={query} onChange={e => setQuery(e.target.value)} className="block w-full border rounded-lg p-3 mt-1" placeholder="Digite ou use o leitor USB" />
        </label>
        {query.trim() && <p>{results.length} produto(s). Exibindo até 100.</p>}
        {results.slice(0,100).map(product => {
          const balances = copy.balances.filter(b => b.product_id === product.id && Number(b.quantity) > 0);
          return <article key={product.id} className="bg-white border rounded-lg p-4 space-y-2">
            <h2 className="font-semibold">{product.sku} — {product.name}</h2>
            <p className="text-sm break-all">Códigos: {copy.barcodes.filter(b => b.product_id === product.id).map(b => b.barcode).join(', ') || 'Sem código cadastrado'}</p>
            {balances.length === 0 && <p>Sem saldo físico positivo na cópia.</p>}
            {balances.map(b => <p key={b.id}>{locations.get(b.location_id)?.code || 'Endereço indisponível'} · Físico {b.quantity} · Reservado {b.reserved_quantity} · Disponível {b.available_quantity}</p>)}
          </article>;
        })}
        <button disabled={busy} onClick={() => void remove()} className="text-red-700 underline">Apagar cópia deste aparelho</button>
      </>}
    </main>
  );
}
