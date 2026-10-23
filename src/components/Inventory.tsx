import { FormEvent, useState } from 'react';
import {
  AlertTriangle,
  Edit2,
  Loader2,
  Plus,
  Search,
  XCircle,
} from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { useAuth } from '../contexts/AuthContext';
import type { DBProduct, ProductWithStock } from '../types';

export default function Inventory() {
  const { user, isDemo } = useAuth();
  const {
    products,
    loading,
    error,
    addProduct,
    editProduct,
    removeProduct,
  } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<ProductWithStock | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const canMaintainProducts = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeactivate = async (product: ProductWithStock) => {
    if (!window.confirm(`Desativar o produto ${product.sku} — ${product.name}?`)) return;

    try {
      await removeProduct(product.id);
    } catch (err) {
      alert(`Erro ao desativar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventário</h1>
          <p className="text-slate-500">
            {products.length} produtos ativos cadastrados
            {isDemo && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Modo demonstração
              </span>
            )}
          </p>
        </div>

        {canMaintainProducts && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Novo produto
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nome, SKU ou categoria..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Produto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Categoria</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Saldo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Mínimo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Situação</th>
                {canMaintainProducts && (
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product) => {
                const isLowStock = Number(product.total_stock) <= Number(product.min_stock);

                return (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{product.sku}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-800">{product.name}</div>
                      {product.description && (
                        <div className="text-xs text-slate-500 max-w-md truncate">{product.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{product.category || '—'}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">
                      {product.total_stock} {product.unit_base}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">
                      {product.min_stock} {product.unit_base}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isLowStock ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> Baixo
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                          Normal
                        </span>
                      )}
                    </td>
                    {canMaintainProducts && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingProduct(product)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg"
                            title="Editar produto"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeactivate(product)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                            title="Desativar produto"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="p-8 text-center text-slate-400">Nenhum produto encontrado.</div>
        )}
      </div>

      {showCreate && (
        <ProductModal
          title="Novo produto"
          onClose={() => setShowCreate(false)}
          onSubmit={async (values) => {
            await addProduct({ ...values, active: true });
            setShowCreate(false);
          }}
        />
      )}

      {editingProduct && (
        <ProductModal
          title={`Editar ${editingProduct.sku}`}
          initial={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSubmit={async (values) => {
            await editProduct(editingProduct.id, values);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}

type ProductFormValues = Pick<
  DBProduct,
  'sku' | 'name' | 'description' | 'category' | 'unit_base' | 'min_stock' | 'max_stock'
>;

function ProductModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: ProductWithStock;
  onClose: () => void;
  onSubmit: (values: ProductFormValues) => Promise<void>;
}) {
  const [sku, setSku] = useState(initial?.sku || '');
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [unitBase, setUnitBase] = useState(initial?.unit_base || 'un');
  const [minStock, setMinStock] = useState(String(initial?.min_stock ?? 0));
  const [maxStock, setMaxStock] = useState(initial?.max_stock == null ? '' : String(initial.max_stock));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const min = Number(minStock);
    const max = maxStock.trim() === '' ? undefined : Number(maxStock);

    if (!sku.trim() || !name.trim()) {
      setError('SKU e nome são obrigatórios.');
      return;
    }

    if (!Number.isFinite(min) || min < 0) {
      setError('Estoque mínimo precisa ser zero ou maior.');
      return;
    }

    if (max !== undefined && (!Number.isFinite(max) || max < min)) {
      setError('Estoque máximo precisa ser maior ou igual ao mínimo.');
      return;
    }

    try {
      setSaving(true);
      await onSubmit({
        sku: sku.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        unit_base: unitBase.trim() || 'un',
        min_stock: min,
        max_stock: max,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{title}</h2>
            <p className="text-sm text-slate-500">Cadastre a identidade do SKU; saldo é alterado somente por movimentações.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500">Fechar</button>
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="SKU">
              <input required value={sku} onChange={(e) => setSku(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </Field>
            <Field label="Nome">
              <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </Field>
            <Field label="Categoria">
              <input value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </Field>
            <Field label="Unidade base">
              <input value={unitBase} onChange={(e) => setUnitBase(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="un" />
            </Field>
            <Field label="Estoque mínimo">
              <input type="number" min={0} step="any" value={minStock} onChange={(e) => setMinStock(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </Field>
            <Field label="Estoque máximo (opcional)">
              <input type="number" min={0} step="any" value={maxStock} onChange={(e) => setMaxStock(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </Field>
          </div>

          <Field label="Descrição">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2" />
          </Field>
        </div>

        <div className="p-5 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar produto'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
