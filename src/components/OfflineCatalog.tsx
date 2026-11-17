import { searchCopy, type OfflineCopy } from '../offline/storage';

export default function OfflineCatalog({ copy, loaded, query, onQueryChange }: {
  copy: OfflineCopy | null;
  loaded: boolean;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const results = copy ? searchCopy(copy, query) : [];
  const locations = new Map(copy?.locations.map(l => [l.id, l]));
  return (
    <main className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Localizar produto</h1>
      <p className="text-slate-600">Continue pesquisando os produtos e endereços disponíveis neste aparelho. Movimentações precisam de conexão.</p>
      {!loaded && <p>Carregando produtos…</p>}
      {loaded && !copy && <p>A preparação automática ainda não foi concluída. Conecte-se e entre no sistema; os dados serão preparados sem precisar clicar em nada.</p>}
      {copy && <>
        <p role="status" className="bg-amber-100 p-3 rounded-lg">Cópia de {new Date(copy.savedAt).toLocaleString('pt-BR')} · {copy.products.length} produtos · {copy.locations.length} endereços</p>
        <label className="block">SKU, produto, código de barras ou endereço
          <input value={query} onChange={e => onQueryChange(e.target.value)} className="block w-full border rounded-lg p-3 mt-1" placeholder="Digite ou use o leitor USB" />
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
      </>}
    </main>
  );
}
