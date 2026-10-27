import { isDemoMode, isSupabaseConfigured, supabase } from '../lib/supabase';
import type { DBAuditEvent } from '../types';

const demoAuditEvents: DBAuditEvent[] = [
  {
    id: 'demo-audit-1',
    event_type: 'product_updated',
    entity_type: 'product',
    entity_id: 'demo-p1',
    user_id: 'demo-user-id',
    user_email: 'demo@casameta.local',
    details: { demo: true, message: 'Evento fictício para demonstrar a tela de auditoria.' },
    created_at: new Date().toISOString(),
  },
];

/**
 * Eventos autoritativos são gerados pelo banco (RPCs/triggers).
 * O navegador não possui permissão para fabricar eventos de auditoria.
 */
export async function logAuditEvent(): Promise<void> {
  console.warn('logAuditEvent é legado: eventos autoritativos são gerados pelo banco.');
}

export async function getAuditEvents(limit = 200): Promise<DBAuditEvent[]> {
  if (isDemoMode) return demoAuditEvents.map((event) => ({ ...event }));
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('audit_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as DBAuditEvent[];
}
