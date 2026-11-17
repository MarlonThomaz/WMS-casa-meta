import { isDemoMode, isSupabaseConfigured, supabase } from '../lib/supabase';
import type { DBAuditEvent } from '../types';
import {historyPage,localHistoryPage} from './history';

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

export async function getAuditEventsPage(page=1,entity='',term=''){
  if(isDemoMode)return localHistoryPage(demoAuditEvents.filter(row=>(!entity||row.entity_type===entity)&&(!term.trim()||[row.event_type,row.entity_type,row.user_email,row.entity_id].some(v=>v?.toLowerCase().includes(term.trim().toLowerCase())))),page);
  return historyPage<DBAuditEvent>('audit_events',page,{entity_type:entity},{columns:['event_type','entity_type','user_email'],term,uuidColumn:'entity_id'});
}
