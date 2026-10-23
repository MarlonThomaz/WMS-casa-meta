import { supabase, isSupabaseConfigured } from '../lib/supabase';

export async function logAuditEvent(params: {
  event_type: string;
  entity_type: string;
  entity_id?: string;
  details?: any;
}): Promise<void> {
  if (!isSupabaseConfigured) {
    console.log('Audit Event (demo):', params);
    return;
  }
  
  const { error } = await supabase.rpc('log_audit_event', {
    p_event_type: params.event_type,
    p_entity_type: params.entity_type,
    p_entity_id: params.entity_id || null,
    p_details: params.details || null,
  });

  if (error) {
    console.warn('Falha ao registrar evento de auditoria:', error.message);
  }
}

export async function getAuditEvents(limit = 100) {
  if (!isSupabaseConfigured) return [];
  
  const { data, error } = await supabase
    .from('audit_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('Falha ao buscar eventos de auditoria:', error.message);
    return [];
  }
  return data || [];
}
