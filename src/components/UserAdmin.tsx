import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, Shield, UserCog, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getProfiles, updateProfileAccess } from '../services/users';
import type { DBProfile, Role } from '../types';

const roleLabel: Record<Role, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  operator: 'Operador',
  viewer: 'Visualizador',
};

export default function UserAdmin() {
  const { user, isDemo } = useAuth();
  const [profiles, setProfiles] = useState<DBProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      setError(null);
      setProfiles(await getProfiles());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfiles();
  }, []);

  const stats = useMemo(() => ({
    total: profiles.length,
    active: profiles.filter((profile) => profile.active).length,
    operators: profiles.filter((profile) => profile.role === 'operator' && profile.active).length,
    admins: profiles.filter((profile) => profile.role === 'admin' && profile.active).length,
  }), [profiles]);

  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="max-w-xl p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          Somente administradores podem alterar papéis e ativação de usuários.
        </div>
      </div>
    );
  }

  const updateProfile = async (profile: DBProfile, patch: { role?: Role; active?: boolean }) => {
    if (profile.id === user.id) {
      setError('Por segurança, o usuário conectado não pode alterar o próprio papel ou se desativar nesta tela.');
      return;
    }

    try {
      setSavingId(profile.id);
      setError(null);
      const updated = await updateProfileAccess(profile.id, patch);
      setProfiles((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar usuário');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="w-7 h-7 text-blue-600" />
          Usuários e permissões
        </h1>
        <p className="text-slate-500">
          Ative contas já criadas no Supabase Auth e defina o papel operacional de cada pessoa.
        </p>
      </div>

      {isDemo && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          Ambiente demo: as alterações abaixo existem apenas em memória e são descartadas ao recarregar.
        </div>
      )}

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900">
        <strong>Provisionamento:</strong> por segurança, esta tela não cria contas de autenticação usando a chave pública do navegador.
        Para o piloto, crie a conta no Supabase Auth; ela nascerá como <strong>viewer/inativa</strong> e então poderá ser ativada aqui.
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Perfis" value={stats.total} />
        <Stat label="Ativos" value={stats.active} />
        <Stat label="Operadores" value={stats.operators} />
        <Stat label="Administradores" value={stats.admins} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full mobile-cards">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Usuário</th>
                <th className="px-4 py-3 text-left">Papel</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left">Atualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map((profile) => {
                const isSelf = profile.id === user.id;
                const saving = savingId === profile.id;

                return (
                  <tr key={profile.id} className="hover:bg-slate-50">
                    <td data-label="Usuário" className="px-4 py-3">
                      <div className="font-medium text-slate-800 flex items-center gap-2">
                        <UserCog className="w-4 h-4 text-slate-400" />
                        {profile.full_name || profile.email}
                        {isSelf && <span className="text-xs text-blue-600">(você)</span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{profile.email}</div>
                    </td>
                    <td data-label="Papel" className="px-4 py-3">
                      <select
                        value={profile.role}
                        disabled={saving || isSelf}
                        onChange={(event) => void updateProfile(profile, { role: event.target.value as Role })}
                        className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm disabled:bg-slate-100"
                      >
                        {(Object.keys(roleLabel) as Role[]).map((role) => (
                          <option key={role} value={role}>{roleLabel[role]}</option>
                        ))}
                      </select>
                    </td>
                    <td data-label="Status" className="px-4 py-3 text-center">
                      <button
                        type="button"
                        disabled={saving || isSelf}
                        onClick={() => void updateProfile(profile, { active: !profile.active })}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50 ${
                          profile.active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {saving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : profile.active ? (
                          <CheckCircle className="w-3.5 h-3.5" />
                        ) : (
                          <Shield className="w-3.5 h-3.5" />
                        )}
                        {profile.active ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td data-label="Atualizado" className="px-4 py-3 text-sm text-slate-500">
                      {new Date(profile.updated_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                );
              })}
              {!loading && profiles.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-slate-400">Nenhum perfil encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="p-8 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando usuários...
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
    </div>
  );
}
