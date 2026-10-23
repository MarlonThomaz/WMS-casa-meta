import { useState } from 'react';
import { 
  HelpCircle, 
  LayoutDashboard, 
  Package, 
  MapPin, 
  ArrowDown, 
  ArrowUp, 
  ArrowLeftRight, 
  Box,
  ChevronRight,
  BookOpen,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';

type Section = 'overview' | 'dashboard' | 'inventory' | 'locations' | 'receiving' | 'shipping' | 'movements' | 'barcode' | 'download';

export default function Help() {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  const sections = [
    { id: 'overview' as Section, label: 'Visão Geral', icon: BookOpen },
    { id: 'dashboard' as Section, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory' as Section, label: 'Inventário', icon: Package },
    { id: 'locations' as Section, label: 'Localizações', icon: MapPin },
    { id: 'receiving' as Section, label: 'Recebimento', icon: ArrowDown },
    { id: 'shipping' as Section, label: 'Expedição', icon: ArrowUp },
    { id: 'movements' as Section, label: 'Movimentações', icon: ArrowLeftRight },
    { id: 'barcode' as Section, label: 'Kit Código de Barras', icon: Box },
    { id: 'download' as Section, label: 'Download do Projeto', icon: Package },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <HelpCircle className="w-7 h-7 text-blue-600" />
          Manual do Usuário - WMS Pro
        </h1>
        <p className="text-slate-500">Guia completo de utilização do sistema de gerenciamento de armazém</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sticky top-6">
            <h3 className="font-semibold text-slate-700 mb-3 text-sm uppercase">Conteúdo</h3>
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            {activeSection === 'overview' && <OverviewSection />}
            {activeSection === 'dashboard' && <DashboardSection />}
            {activeSection === 'inventory' && <InventorySection />}
            {activeSection === 'locations' && <LocationsSection />}
            {activeSection === 'receiving' && <ReceivingSection />}
            {activeSection === 'shipping' && <ShippingSection />}
            {activeSection === 'movements' && <MovementsSection />}
            {activeSection === 'barcode' && <BarcodeSection />}
            {activeSection === 'download' && <DownloadSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewSection() {
  return (
    <div className="prose max-w-none">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-blue-600" />
        Visão Geral do Sistema
      </h2>

      <div className="space-y-4 text-slate-700">
        <p className="text-base">
          O <strong>WMS Pro</strong> é um sistema completo de gerenciamento de armazém (Warehouse Management System) 
          desenvolvido para otimizar operações logísticas, controlar estoque e gerenciar movimentações de produtos.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Info className="w-5 h-5" />
            Principais Funcionalidades
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
            <li><strong>Dashboard:</strong> Visão geral com KPIs e gráficos em tempo real</li>
            <li><strong>Inventário:</strong> Gestão completa de produtos com CRUD</li>
            <li><strong>Localizações:</strong> Mapa visual do armazém com endereçamento</li>
            <li><strong>Recebimento:</strong> Conferência de ordens de compra</li>
            <li><strong>Expedição:</strong> Fluxo de separação, embalagem e despacho</li>
            <li><strong>Movimentações:</strong> Histórico de todas as operações</li>
            <li><strong>Kit Código de Barras:</strong> Scanner para operações rápidas</li>
          </ul>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Como Começar
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-green-800">
            <li>Acesse o <strong>Dashboard</strong> para ter uma visão geral do armazém</li>
            <li>Cadastre produtos no menu <strong>Inventário</strong></li>
            <li>Configure as localizações no menu <strong>Localizações</strong></li>
            <li>Registre recebimentos e expedições conforme necessário</li>
            <li>Use o <strong>Kit Código de Barras</strong> para operações rápidas</li>
          </ol>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Dicas Importantes
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
            <li>Mantenha o estoque atualizado para evitar rupturas</li>
            <li>Use o scanner de código de barras para agilizar operações</li>
            <li>Monitore os alertas de estoque baixo no Dashboard</li>
            <li>Revise regularmente as movimentações pendentes</li>
            <li>Faça backup do sistema periodicamente</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function DashboardSection() {
  return (
    <div className="prose max-w-none">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <LayoutDashboard className="w-6 h-6 text-blue-600" />
        Dashboard
      </h2>

      <div className="space-y-4 text-slate-700">
        <p>
          O Dashboard é a página inicial do sistema e fornece uma visão completa do status do armazém 
          através de indicadores-chave de desempenho (KPIs) e gráficos interativos.
        </p>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Indicadores Principais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <h4 className="font-semibold text-slate-700 text-sm">Total de SKUs</h4>
            <p className="text-xs text-slate-600 mt-1">Número total de produtos diferentes cadastrados no sistema</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <h4 className="font-semibold text-slate-700 text-sm">Itens em Estoque</h4>
            <p className="text-xs text-slate-600 mt-1">Quantidade total de unidades em estoque (soma de todos os produtos)</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <h4 className="font-semibold text-slate-700 text-sm">Estoque Baixo</h4>
            <p className="text-xs text-slate-600 mt-1">Produtos com quantidade abaixo do estoque mínimo configurado</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <h4 className="font-semibold text-slate-700 text-sm">Localizações Ocupadas</h4>
            <p className="text-xs text-slate-600 mt-1">Percentual de ocupação das posições do armazém</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <h4 className="font-semibold text-slate-700 text-sm">Recebimentos Pendentes</h4>
            <p className="text-xs text-slate-600 mt-1">Ordens de recebimento aguardando conferência</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <h4 className="font-semibold text-slate-700 text-sm">Expedições Pendentes</h4>
            <p className="text-xs text-slate-600 mt-1">Ordens de expedição em processamento</p>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Gráficos</h3>
        <div className="space-y-3">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <h4 className="font-semibold text-slate-700 text-sm">Movimentações da Semana</h4>
            <p className="text-xs text-slate-600 mt-1">
              Gráfico de linhas mostrando entradas e saídas de produtos ao longo dos últimos 7 dias. 
              Útil para identificar padrões de movimentação.
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <h4 className="font-semibold text-slate-700 text-sm">Estoque por Categoria</h4>
            <p className="text-xs text-slate-600 mt-1">
              Gráfico de pizza mostrando a distribuição do estoque por categoria de produto.
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <h4 className="font-semibold text-slate-700 text-sm">Ocupação por Zona</h4>
            <p className="text-xs text-slate-600 mt-1">
              Gráfico de barras mostrando o percentual de ocupação de cada zona do armazém.
            </p>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Alertas de Estoque Baixo</h3>
        <p className="text-sm">
          Quando há produtos com estoque abaixo do mínimo configurado, um alerta amarelo aparece na parte 
          inferior do Dashboard listando todos os produtos críticos. Isso permite ação rápida para reposição.
        </p>
      </div>
    </div>
  );
}

function InventorySection() {
  return (
    <div className="prose max-w-none">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Package className="w-6 h-6 text-blue-600" />
        Inventário
      </h2>

      <div className="space-y-4 text-slate-700">
        <p>
          A página de Inventário permite gerenciar todos os produtos cadastrados no sistema, 
          incluindo criação, edição, exclusão e consulta de informações.
        </p>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Campos do Produto</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-slate-200 rounded-lg">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Campo</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Descrição</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Exemplo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="px-3 py-2 font-mono text-xs">SKU</td>
                <td className="px-3 py-2">Código único do produto</td>
                <td className="px-3 py-2 font-mono text-xs">SKU-001</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Nome</td>
                <td className="px-3 py-2">Nome descritivo do produto</td>
                <td className="px-3 py-2 text-xs">Notebook Dell Inspiron 15</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Categoria</td>
                <td className="px-3 py-2">Classificação do produto</td>
                <td className="px-3 py-2 text-xs">Eletrônicos</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Quantidade</td>
                <td className="px-3 py-2">Estoque atual em unidades</td>
                <td className="px-3 py-2 text-xs">45 un</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Localização</td>
                <td className="px-3 py-2">Endereço no armazém</td>
                <td className="px-3 py-2 font-mono text-xs">A-01-03-02</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Estoque Mínimo</td>
                <td className="px-3 py-2">Quantidade mínima para alerta</td>
                <td className="px-3 py-2 text-xs">10</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Estoque Máximo</td>
                <td className="px-3 py-2">Capacidade máxima de estoque</td>
                <td className="px-3 py-2 text-xs">100</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Como Cadastrar um Produto</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Clique no botão <strong>"Novo Produto"</strong> no canto superior direito</li>
          <li>Preencha todos os campos obrigatórios no formulário</li>
          <li>Defina o SKU (código único), nome e categoria</li>
          <li>Informe a quantidade inicial e a localização no armazém</li>
          <li>Configure os limites de estoque mínimo e máximo</li>
          <li>Clique em <strong>"Cadastrar"</strong> para salvar</li>
        </ol>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Filtros e Busca</h3>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>Busca por texto:</strong> Digite no campo de busca para filtrar por nome ou SKU</li>
            <li><strong>Filtro por categoria:</strong> Use o dropdown para filtrar por categoria específica</li>
            <li><strong>Status de estoque:</strong> Produtos com estoque baixo são destacados em vermelho</li>
          </ul>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Editar e Excluir</h3>
        <p className="text-sm">
          Cada produto na tabela possui dois botões de ação:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong>Editar (ícone de lápis):</strong> Abre o formulário para alterar os dados do produto</li>
          <li><strong>Excluir (ícone de lixeira):</strong> Remove o produto do sistema (com confirmação)</li>
        </ul>
      </div>
    </div>
  );
}

function LocationsSection() {
  return (
    <div className="prose max-w-none">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <MapPin className="w-6 h-6 text-blue-600" />
        Localizações
      </h2>

      <div className="space-y-4 text-slate-700">
        <p>
          A página de Localizações apresenta um mapa visual do armazém e permite gerenciar 
          os endereços onde os produtos estão armazenados.
        </p>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Estrutura de Endereçamento</h3>
        <p className="text-sm">
          Cada localização no armazém é identificada por um código composto por 4 elementos:
        </p>
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 font-mono text-center">
          <div className="text-2xl font-bold text-slate-800 mb-2">A-01-03-02</div>
          <div className="grid grid-cols-4 gap-2 text-xs text-slate-600">
            <div>
              <div className="font-bold text-blue-600">Zona</div>
              <div>A</div>
            </div>
            <div>
              <div className="font-bold text-blue-600">Corredor</div>
              <div>01</div>
            </div>
            <div>
              <div className="font-bold text-blue-600">Estante</div>
              <div>03</div>
            </div>
            <div>
              <div className="font-bold text-blue-600">Nível</div>
              <div>02</div>
            </div>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Status das Localizações</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="font-semibold text-green-800 text-sm">Disponível</span>
            </div>
            <p className="text-xs text-green-700">Posição vazia, pronta para receber produtos</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-blue-800 text-sm">Ocupada</span>
            </div>
            <p className="text-xs text-blue-700">Posição com produtos armazenados</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-4 h-4 text-amber-600" />
              <span className="font-semibold text-amber-800 text-sm">Reservada</span>
            </div>
            <p className="text-xs text-amber-700">Posição reservada para uso futuro</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="font-semibold text-red-800 text-sm">Manutenção</span>
            </div>
            <p className="text-xs text-red-700">Posição em manutenção, indisponível</p>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Mapa Visual</h3>
        <p className="text-sm">
          O mapa do armazém mostra todas as zonas e suas respectivas localizações. Cada caixa representa 
          uma posição e é colorida de acordo com seu status. A barra de progresso indica o percentual 
          de ocupação da posição.
        </p>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Tabela de Detalhes</h3>
        <p className="text-sm">
          Abaixo do mapa, uma tabela detalhada lista todas as localizações com informações completas: 
          código, zona, corredor, estante, nível, capacidade, ocupação e status.
        </p>
      </div>
    </div>
  );
}

function ReceivingSection() {
  return (
    <div className="prose max-w-none">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <ArrowDown className="w-6 h-6 text-blue-600" />
        Recebimento
      </h2>

      <div className="space-y-4 text-slate-700">
        <p>
          A página de Recebimento gerencia as ordens de recebimento de mercadorias, permitindo 
          conferir e registrar a entrada de produtos no armazém.
        </p>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Status das Ordens</h3>
        <div className="space-y-2">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-800 text-sm">Pendente</h4>
              <p className="text-xs text-amber-700">Ordem criada, aguardando chegada da mercadoria</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-800 text-sm">Parcial</h4>
              <p className="text-xs text-blue-700">Parte da mercadoria já foi recebida e conferida</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-green-800 text-sm">Concluído</h4>
              <p className="text-xs text-green-700">Toda a mercadoria foi recebida e o estoque atualizado</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-800 text-sm">Cancelado</h4>
              <p className="text-xs text-red-700">Ordem cancelada, mercadoria não será recebida</p>
            </div>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Como Receber uma Ordem</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Localize a ordem pendente na lista</li>
          <li>Verifique os itens esperados e a quantidade</li>
          <li>Conforme a mercadoria chega, atualize a quantidade recebida de cada item</li>
          <li>Quando todos os itens estiverem conferidos, clique em <strong>"Concluir Recebimento"</strong></li>
          <li>O sistema atualizará automaticamente o estoque dos produtos</li>
        </ol>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Barra de Progresso</h3>
        <p className="text-sm">
          Cada item da ordem possui uma barra de progresso que mostra visualmente quanto já foi recebido 
          em relação ao esperado. Verde indica 100% recebido, azul indica recebimento parcial.
        </p>
      </div>
    </div>
  );
}

function ShippingSection() {
  return (
    <div className="prose max-w-none">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <ArrowUp className="w-6 h-6 text-blue-600" />
        Expedição
      </h2>

      <div className="space-y-4 text-slate-700">
        <p>
          A página de Expedição gerencia o fluxo de saída de mercadorias, desde a separação 
          até o despacho para o cliente final.
        </p>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Fluxo de Expedição</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium">
            Pendente
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
          <div className="bg-amber-100 border border-amber-300 rounded-lg px-3 py-2 text-sm font-medium text-amber-800">
            Separação
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
          <div className="bg-blue-100 border border-blue-300 rounded-lg px-3 py-2 text-sm font-medium text-blue-800">
            Embalado
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
          <div className="bg-green-100 border border-green-300 rounded-lg px-3 py-2 text-sm font-medium text-green-800">
            Enviado
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Prioridades</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <div className="text-xs font-semibold text-red-700 mb-1">ALTA</div>
            <p className="text-xs text-red-600">Processamento urgente</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <div className="text-xs font-semibold text-amber-700 mb-1">MÉDIA</div>
            <p className="text-xs text-amber-600">Processamento normal</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <div className="text-xs font-semibold text-green-700 mb-1">BAIXA</div>
            <p className="text-xs text-green-600">Processamento padrão</p>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Como Processar uma Expedição</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li><strong>Pendente → Separação:</strong> Clique em "Iniciar Separação" para começar a picking</li>
          <li><strong>Separação → Embalado:</strong> Após separar todos os itens, clique em "Confirmar Embalagem"</li>
          <li><strong>Embalado → Enviado:</strong> Após despachar com a transportadora, clique em "Despachar"</li>
        </ol>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Informações da Ordem</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong>Número da ordem:</strong> Identificador único da expedição</li>
          <li><strong>Cliente:</strong> Nome do cliente destinatário</li>
          <li><strong>Transportadora:</strong> Empresa responsável pelo transporte</li>
          <li><strong>Itens:</strong> Lista de produtos e quantidades a serem expedidos</li>
        </ul>
      </div>
    </div>
  );
}

function MovementsSection() {
  return (
    <div className="prose max-w-none">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <ArrowLeftRight className="w-6 h-6 text-blue-600" />
        Movimentações
      </h2>

      <div className="space-y-4 text-slate-700">
        <p>
          A página de Movimentações apresenta o histórico completo de todas as operações realizadas 
          no armazém, permitindo auditoria e rastreamento de atividades.
        </p>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Tipos de Movimentação</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDown className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-blue-800 text-sm">Entrada</span>
            </div>
            <p className="text-xs text-blue-700">Produto entrando no armazém (recebimento)</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUp className="w-4 h-4 text-red-600" />
              <span className="font-semibold text-red-800 text-sm">Saída</span>
            </div>
            <p className="text-xs text-red-700">Produto saindo do armazém (expedição)</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <ArrowLeftRight className="w-4 h-4 text-purple-600" />
              <span className="font-semibold text-purple-800 text-sm">Transferência</span>
            </div>
            <p className="text-xs text-purple-700">Movimentação interna entre localizações</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-4 h-4 text-amber-600" />
              <span className="font-semibold text-amber-800 text-sm">Ajuste</span>
            </div>
            <p className="text-xs text-amber-700">Correção de inventário (positivo ou negativo)</p>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Filtros Disponíveis</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong>Busca por texto:</strong> Filtra por nome do produto, referência ou operador</li>
          <li><strong>Tipo de movimentação:</strong> Filtra por entrada, saída, transferência ou ajuste</li>
          <li><strong>Status:</strong> Filtra por concluído, pendente ou cancelado</li>
        </ul>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Informações da Movimentação</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong>Referência:</strong> Código único da movimentação</li>
          <li><strong>Tipo:</strong> Classificação da operação</li>
          <li><strong>Produto:</strong> Nome do produto movimentado</li>
          <li><strong>Quantidade:</strong> Quantidade movimentada (positivo para entrada, negativo para saída)</li>
          <li><strong>Origem/Destino:</strong> Localizações de origem e destino</li>
          <li><strong>Data/Hora:</strong> Timestamp da operação</li>
          <li><strong>Operador:</strong> Usuário que realizou a operação</li>
          <li><strong>Status:</strong> Situação atual da movimentação</li>
        </ul>
      </div>
    </div>
  );
}

function BarcodeSection() {
  return (
    <div className="prose max-w-none">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Box className="w-6 h-6 text-blue-600" />
        Kit Código de Barras
      </h2>

      <div className="space-y-4 text-slate-700">
        <p>
          O Kit de Código de Barras é uma ferramenta poderosa para agilizar operações no armazém, 
          permitindo escanear códigos para cadastro, transferência e localização de produtos.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Info className="w-5 h-5" />
            Formatos Suportados
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
            <li>QR Code</li>
            <li>EAN-13 e EAN-8</li>
            <li>Code 128, Code 39, Code 93</li>
            <li>UPC-A e UPC-E</li>
            <li>ITF (Interleaved 2 of 5)</li>
            <li>Codabar</li>
          </ul>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Modo 1: Cadastrar SKU</h3>
        <p className="text-sm">
          Use este modo para cadastrar novos produtos no sistema através do código de barras.
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Selecione o modo <strong>"Cadastrar SKU"</strong></li>
          <li>Escaneie o código de barras do produto</li>
          <li>O código será preenchido automaticamente no campo SKU</li>
          <li>Se o produto já existir, um alerta será exibido</li>
          <li>Preencha os demais campos (nome, categoria, quantidade, localização)</li>
          <li>Clique em <strong>"Cadastrar Produto"</strong></li>
        </ol>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Modo 2: Transferência</h3>
        <p className="text-sm">
          Use este modo para transferir produtos entre localizações do armazém.
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Selecione o modo <strong>"Transferência"</strong></li>
          <li>Escaneie o código do produto a ser transferido</li>
          <li>O sistema identificará automaticamente a localização atual</li>
          <li>Escaneie ou selecione a localização de destino</li>
          <li>Informe a quantidade a ser transferida</li>
          <li>Clique em <strong>"Confirmar Transferência"</strong></li>
        </ol>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Modo 3: Localizar Estoque</h3>
        <p className="text-sm">
          Use este modo para encontrar rapidamente onde um produto está armazenado.
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Selecione o modo <strong>"Localizar Estoque"</strong></li>
          <li>Escaneie o código de barras do produto</li>
          <li>O sistema exibirá todas as informações do produto</li>
          <li>A localização exata será destacada com instruções visuais</li>
          <li>O nível de estoque será mostrado com indicador visual</li>
        </ol>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Entrada Manual</h3>
        <p className="text-sm">
          Caso o scanner não funcione ou o código esteja danificado, você pode digitar o código 
          manualmente no campo de entrada abaixo do scanner.
        </p>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Upload de Imagem</h3>
        <p className="text-sm">
          Você também pode fazer upload de uma imagem contendo o código de barras. O sistema 
          tentará decodificar automaticamente.
        </p>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Histórico de Escaneamentos</h3>
        <p className="text-sm">
          Todos os códigos escaneados são registrados em um histórico na parte inferior da página, 
          permitindo revisar operações anteriores.
        </p>
      </div>
    </div>
  );
}

function DownloadSection() {
  return (
    <div className="prose max-w-none">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Package className="w-6 h-6 text-blue-600" />
        Download do Projeto
      </h2>

      <div className="space-y-4 text-slate-700">
        <p>
          O WMS Pro permite que você faça download de todo o código-fonte do projeto em um arquivo ZIP, 
          facilitando a instalação em ambiente local ou transferência para outros dispositivos.
        </p>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Como Fazer Download</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>No menu lateral, clique no botão <strong>"Baixar Projeto (.zip)"</strong></li>
          <li>O arquivo <code>wms-projeto.zip</code> será baixado automaticamente</li>
          <li>Extraia o conteúdo em uma pasta de sua escolha</li>
          <li>Abra o terminal na pasta extraída</li>
          <li>Execute <code className="bg-slate-100 px-2 py-1 rounded">npm install</code> para instalar as dependências</li>
          <li>Execute <code className="bg-slate-100 px-2 py-1 rounded">npm run dev</code> para iniciar o servidor de desenvolvimento</li>
          <li>Acesse <code className="bg-slate-100 px-2 py-1 rounded">http://localhost:3000</code> no navegador</li>
        </ol>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Requisitos do Sistema</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Node.js 18 ou superior</li>
          <li>npm 9 ou superior</li>
          <li>Navegador moderno (Chrome, Firefox, Edge, Safari)</li>
        </ul>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Comandos Disponíveis</h3>
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 font-mono text-sm space-y-2">
          <div>
            <div className="text-blue-600 font-semibold">npm run dev</div>
            <div className="text-xs text-slate-600">Inicia o servidor de desenvolvimento com hot reload</div>
          </div>
          <div>
            <div className="text-blue-600 font-semibold">npm run build</div>
            <div className="text-xs text-slate-600">Gera a build de produção otimizada</div>
          </div>
          <div>
            <div className="text-blue-600 font-semibold">npm run preview</div>
            <div className="text-xs text-slate-600">Visualiza a build de produção localmente</div>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mt-6">Estrutura do Projeto</h3>
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 font-mono text-xs space-y-1">
          <div>wms-projeto/</div>
          <div className="ml-4">├── index.html</div>
          <div className="ml-4">├── package.json</div>
          <div className="ml-4">├── tsconfig.json</div>
          <div className="ml-4">├── vite.config.js</div>
          <div className="ml-4">└── src/</div>
          <div className="ml-8">├── main.tsx</div>
          <div className="ml-8">├── App.tsx</div>
          <div className="ml-8">├── index.css</div>
          <div className="ml-8">├── types.ts</div>
          <div className="ml-8">├── data.ts</div>
          <div className="ml-8">└── components/</div>
          <div className="ml-12">├── Sidebar.tsx</div>
          <div className="ml-12">├── Dashboard.tsx</div>
          <div className="ml-12">├── Inventory.tsx</div>
          <div className="ml-12">├── Locations.tsx</div>
          <div className="ml-12">├── Receiving.tsx</div>
          <div className="ml-12">├── Shipping.tsx</div>
          <div className="ml-12">├── Movements.tsx</div>
          <div className="ml-12">├── BarcodeScanner.tsx</div>
          <div className="ml-12">└── BarcodeKit.tsx</div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
          <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Pronto para Usar!
          </h3>
          <p className="text-sm text-green-800">
            O projeto está pronto para ser executado. Após instalar as dependências e iniciar o servidor, 
            você terá acesso a todas as funcionalidades do WMS Pro em ambiente local.
          </p>
        </div>
      </div>
    </div>
  );
}
