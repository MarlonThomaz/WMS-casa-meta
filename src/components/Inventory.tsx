import { useProducts } from '../hooks/useProducts';
import { Search, Plus, Edit2, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Inventory() {
  const { isDemo } = useAuth();
  const { products, loading, error, addProduct, removeProduct } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      await removeProduct(id);
    } catch (err) {
      alert('Erro ao excluir: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventário</h1>
          <p className="text-slate-500">
            {products.length} produtos cadastrados
            {isDemo && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Modo demonstração</span>}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Novo Produto
        </button>
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
          placeholder="Buscar por nome ou SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">SKU</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Produto</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Qtd</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => {
              const isLowStock = product.total_stock <= product.min_stock;
              return (
                <tr key={product.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-mono text-slate-600">{product.sku}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{product.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-semibold ${isLowStock ? 'text-red-600' : 'text-slate-800'}`}>
                      {product.total_stock} {product.unit_base}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isLowStock ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Baixo
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Normal</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredProducts.length === 0 && (
          <div className="p-8 text-center text-slate-400">Nenhum produto encontrado.</div>
        )}
      </div>
    </div>
  );
}
