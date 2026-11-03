import { useState } from 'react';
import {
  BookOpen,
  Box,
  ClipboardCheck,
  FileSearch,
  HelpCircle,
  KeyRound,
  MapPin,
  Package,
  ScanLine,
  ShieldCheck,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';

type Section =
  | 'overview'
  | 'roles'
  | 'inventory'
  | 'receiving'
  | 'shipping'
  | 'counting'
  | 'scanner'
  | 'admin';

const sections = [
  { id: 'overview' as Section, label: 'Visão geral', icon: BookOpen },
  { id: 'roles' as Section, label: 'Perfis e acesso', icon: KeyRound },
  { id: 'inventory' as Section, label: 'Estoque e endereços', icon: Package },
  { id: 'receiving' as Section, label: 'Recebimento', icon: Warehouse },
  { id: 'shipping' as Section, label: 'Expedição', icon: Truck },
  { id: 'counting' as Section, label: 'Contagem física', icon: ClipboardCheck },
  { id: 'scanner' as Section, label: 'Código de barras', icon: ScanLine },
  { id: 'admin' as Section, label: 'Administração', icon: ShieldCheck },
];

export default function Help() {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <HelpCircle className="w-7 h-7 text-blue-600" />
          Ajuda — WMS Casa Meta
        </h1>
        <p className="text-slate-500">Guia do piloto web controlado e dos fluxos já disponíveis.</p>
      </div>

      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900">
        Esta versão está em estabilização para piloto. PWA instalável, APK/Android, iOS, Electron/Windows e operação offline não fazem parte do escopo pronto desta fase.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-4 lg:sticky lg:top-6">
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left ${
                      activeSection === section.id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-6">
          {activeSection === 'overview' && <Overview />}
          {activeSection === 'roles' && <Roles />}
          {activeSection === 'inventory' && <Inventory />}
          {activeSection === 'receiving' && <Receiving />}
          {activeSection === 'shipping' && <Shipping />}
          {activeSection === 'counting' && <Counting />}
          {activeSection === 'scanner' && <Scanner />}
          {activeSection === 'admin' && <Administration />}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">{icon}{children}</h2>;
}

function Info({ children }: { children: React.ReactNode }) {
  return <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">{children}</div>;
}

function Overview() {
  return (
    <div className="space-y-4 text-slate-700">
      <SectionTitle icon={<Box className="w-5 h-5 text-blue-600" />}>Escopo atual</SectionTitle>
      <p>O WMS Casa Meta controla produtos, endereços, saldo físico, recebimentos, expedições, movimentações, contagens, códigos de barras e auditoria.</p>
      <Info>
        Alterações de saldo são processadas pelo banco através de funções transacionais. A tela não deve editar o saldo diretamente.
      </Info>
      <p>Para o piloto, use um projeto Supabase de homologação e usuários reais. O modo demo serve somente para explorar a interface e não valida RLS, persistência ou autenticação real.</p>
    </div>
  );
}

function Roles() {
  return (
    <div className="space-y-4 text-slate-700">
      <SectionTitle icon={<Users className="w-5 h-5 text-blue-600" />}>Perfis e permissões</SectionTitle>
      <div className="grid md:grid-cols-2 gap-3">
        <Info><strong>Admin:</strong> operação completa, usuários, permissões e auditoria.</Info>
        <Info><strong>Manager:</strong> operação completa, endereços e auditoria, sem administrar papéis.</Info>
        <Info><strong>Operator:</strong> executa os fluxos operacionais permitidos e trabalha principalmente com registros próprios.</Info>
        <Info><strong>Viewer:</strong> somente leitura. Botões de mutação ficam desabilitados e o banco também bloqueia escrita.</Info>
      </div>
      <p>Novas contas criadas no Supabase Auth nascem como <strong>viewer/inativas</strong>. Um administrador deve ativá-las na tela <strong>Usuários</strong>.</p>
    </div>
  );
}

function Inventory() {
  return (
    <div className="space-y-4 text-slate-700">
      <SectionTitle icon={<MapPin className="w-5 h-5 text-blue-600" />}>Produtos, estoque e endereços</SectionTitle>
      <p>Em <strong>Inventário</strong>, cadastre a identidade do SKU, categoria, unidade e limites de estoque. O saldo é consequência das movimentações.</p>
      <p>Em <strong>Localizações</strong>, admin e manager mantêm código, zona, corredor, estrutura, nível, capacidade, tipo e status.</p>
      <p>A tela <strong>Movimentações</strong> permite lançar entrada, saída, transferência e ajuste. Saídas e transferências consideram apenas estoque disponível, sem consumir unidades já reservadas para expedição.</p>
    </div>
  );
}

function Receiving() {
  return (
    <div className="space-y-4 text-slate-700">
      <SectionTitle icon={<Warehouse className="w-5 h-5 text-blue-600" />}>Recebimento</SectionTitle>
      <p>Crie a ordem com fornecedor, produtos, quantidades esperadas e endereços de destino. Durante a conferência, informe a quantidade efetivamente recebida.</p>
      <Info>
        Recebimentos parciais são permitidos. O banco mantém <code>processed_quantity</code> e processa somente o delta novo, evitando duplicar estoque em retry.
      </Info>
      <p>Quando todas as linhas atingem a quantidade esperada, o recebimento passa para concluído; caso contrário permanece parcial.</p>
    </div>
  );
}

function Shipping() {
  return (
    <div className="space-y-4 text-slate-700">
      <SectionTitle icon={<Truck className="w-5 h-5 text-blue-600" />}>Expedição</SectionTitle>
      <p>Crie a expedição informando cliente, produto, quantidade e endereço de origem. Ao iniciar a separação, o sistema reserva o estoque disponível.</p>
      <p>No picking, registre quanto foi realmente separado. A confirmação consome apenas a quantidade separada e libera toda reserva não utilizada, inclusive linhas com quantidade separada igual a zero.</p>
      <p>Depois do picking a operação passa para <strong>Embalado</strong>; o despacho final muda para <strong>Enviado</strong>.</p>
    </div>
  );
}

function Counting() {
  return (
    <div className="space-y-4 text-slate-700">
      <SectionTitle icon={<ClipboardCheck className="w-5 h-5 text-blue-600" />}>Contagem física</SectionTitle>
      <p>A abertura cria um snapshot do saldo. Inicie a contagem, registre as quantidades físicas e conclua quando terminar.</p>
      <Info>
        Na reconciliação, movimentos legítimos ocorridos depois do instante em que a linha foi contada são preservados. O sistema ajusta a divergência da contagem sem apagar entradas ou saídas posteriores.
      </Info>
      <p>As métricas de precisão do piloto consideram somente contagens concluídas.</p>
    </div>
  );
}

function Scanner() {
  return (
    <div className="space-y-4 text-slate-700">
      <SectionTitle icon={<ScanLine className="w-5 h-5 text-blue-600" />}>Código de barras</SectionTitle>
      <p>O módulo aceita câmera, arquivo de imagem, entrada manual e leitores USB HID que se comportam como teclado.</p>
      <p>O cadastro por código de barras pode criar produto, barcode principal e estoque inicial numa única operação transacional.</p>
      <Info>
        Câmera em celular deve ser homologada em navegador com HTTPS. O leitor USB também deve ser testado fisicamente no equipamento que será usado no galpão.
      </Info>
    </div>
  );
}

function Administration() {
  return (
    <div className="space-y-4 text-slate-700">
      <SectionTitle icon={<FileSearch className="w-5 h-5 text-blue-600" />}>Usuários e auditoria</SectionTitle>
      <p><strong>Usuários</strong> é exclusivo de admin e permite ativar/desativar perfis e alterar papéis. A criação da credencial continua no Supabase Auth para não expor chaves privilegiadas no navegador.</p>
      <p><strong>Auditoria</strong> está disponível para admin e manager. Ela consulta eventos autoritativos gravados pelo banco em operações e mudanças de catálogo.</p>
      <Info>
        A aplicação não possui permissão para fabricar eventos de auditoria diretamente; os eventos são emitidos por RPCs e triggers confiáveis.
      </Info>
    </div>
  );
}
