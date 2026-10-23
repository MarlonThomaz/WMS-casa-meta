import { useState, useEffect } from 'react';
import { Search, Filter, Plus, Edit2, Trash2, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Product } from '../types';
import { products as demoProducts } from '../data';
import { useProducts } from '../hooks/useProducts';
import { useAuth } from '../contexts/AuthContext';

export default function Inventory() {
  const { user } = useAuth();
  const { products: supabaseProducts, loading: supabaseLoading, error: supabaseError, refresh, addProduct, editProduct, removeProduct } = useProducts();
  
  // Usar dados do Supabase se disponíveis, senão usar dados de demonstração
  const [products, setProducts] = useState<Product[]>(demoProducts);
  const [usingSupabase, setUsingSupabase] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Tentar carregar do Supabase
  useEffect(() => {
    if (!supabaseLoading && supabaseProducts.length > 0) {
      // Converter formato do Supabase para formato do frontend
      const convertedProducts: Product[] = supabaseProducts.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category || 'Geral',
        quantity: 0, // Será calculado pelo estoque
        unit: p.unit_base,
        location: 'N/A', // Será calculado pelo estoque
        minStock: p.min_stock,
        maxStock: p.max_stock || 0,
        lastUpdate: p.updated_at.split('T')[0],
      }));
      setProducts(convertedProducts);
      setUsingSupabase(true);
    }
  }, [supabaseProducts, supabaseLoading]);

  const categories = [...new Set(products.map(p => p.category))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    
    try {
      if (usingSupabase) {
        await removeProduct(id);
      } else {
        setProducts(products.filter(p => p.id !== id));
      }
    } catch (error) {
      alert('Erro ao excluir produto: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setShowModal(true);
  };

  const handleSave = async (product: Product) => {
    try {
      if (usingSupabase) {
        if (editingProduct) {
          await editProduct(product.id, {
            sku: product.sku,
            name: product.name,
            category: product.category,
            unit_base: product.unit,
            min_stock: product.minStock,
            max_stock: product.maxStock,
          });
        } else {
          await addProduct({
            sku: product.sku,
            name: product.name,
            category: product.category,
            unit_base: product.unit,
            min_stock: product.minStock,
            max_stock: product.maxStock,
            active: true,
          });
        }
        await refresh();
      } else {
        if (editingProduct) {
          setProducts(products.map(p => p.id === product.id ? product : p));
        } else {
          setProducts([...products, { ...product, id: String(Date.now()) }]);
        }
      }
      setShowModal(false);
    } catch (error) {
      alert('Erro ao salvar produto: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventário</h1>
          <p className="text-slate-500">
            {products.length} produtos cadastrados
            {usingSupabase && (
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                Conectado ao Supabase
              </span>
            )}
            {!usingSupabase && !supabaseLoading && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Modo demonstração
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${supabaseLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Produto
          </button>
        </div>
      </div>

      {/* Error message */}
      {supabaseError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Usando dados de demonstração</p>
            <p className="text-xs text-amber-700 mt-1">
              Não foi possível conectar ao Supabase: {supabaseError}. Configure o arquivo .env e execute as migrations.
            </p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {supabaseLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-600">Carregando produtos...</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white"
          >
            <option value="all">Todas Categorias</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Produto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Categoria</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Qtd</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Localização</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const isLowStock = product.quantity <= product.minStock;
                return (
                  <tr key={product.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-slate-600">{product.sku}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-800">{product.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">{product.category}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-semibold ${isLowStock ? 'text-red-600' : 'text-slate-800'}`}>
                        {product.quantity} {product.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600 font-mono">{product.location}</span>
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
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        </div>
        {filteredProducts.length === 0 && !supabaseLoading && (
          <div className="p-8 text-center text-slate-400">
            Nenhum produto encontrado.
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <ProductModal
          product={editingProduct}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

interface ProductModalProps {
  product: Product | null;
  onSave: (product: Product) => void;
  onClose: () => void;
}

function ProductModal({ product, onSave, onClose }: ProductModalProps) {
  const [formData, setFormData] = useState<Product>(
    product || {
      id: '',
      sku: '',
      name: '',
      category: '',
      quantity: 0,
      unit: 'un',
      location: '',
      minStock: 0,
      maxStock: 0,
      lastUpdate: new Date().toISOString().split('T')[0],
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">
            {product ? 'Editar Produto' : 'Novo Produto'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Produto</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Mín.</label>
              <input
                type="number"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Máx.</label>
              <input
                type="number"
                value={formData.maxStock}
                onChange={(e) => setFormData({ ...formData, maxStock: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Localização</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ex: A-01-03-02"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {product ? 'Salvar Alterações' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
