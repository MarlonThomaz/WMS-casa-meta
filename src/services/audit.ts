import { supabase } from '../lib/supabase';

export type AuditEvent = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  user_id?: string;
  user_email?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
};

// Registrar evento de auditoria
export async function logAuditEvent(params: {
  event_type: string;
  entity_type: string;
  entity_id: string;
  user_id?: string;
  details?: any;
}): Promise<void> {
  try {
    // Capturar informações do navegador
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
    
    // Inserir evento (tabela audit_events deve ser criada no banco)
    // Por enquanto, vamos apenas logar no console
    console.log('Audit Event:', {
      ...params,
      user_agent: userAgent,
      created_at: new Date().toISOString(),
    });

    // Tentar inserir no banco (se tabela existir)
    const { error } = await supabase
      .from('audit_events')
      .insert([{
        ...params,
        user_agent: userAgent,
      }]);

    if (error) {
      console.warn('Falha ao registrar evento de auditoria:', error.message);
    }
  } catch (error) {
    console.error('Erro ao registrar evento de auditoria:', error);
  }
}

// Buscar eventos de auditoria
export async function getAuditEvents(params?: {
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  event_type?: string;
  limit?: number;
}): Promise<AuditEvent[]> {
  let query = supabase
    .from('audit_events')
    .select('*')
    .order('created_at', { ascending: false });

  if (params?.entity_type) {
    query = query.eq('entity_type', params.entity_type);
  }

  if (params?.entity_id) {
    query = query.eq('entity_id', params.entity_id);
  }

  if (params?.user_id) {
    query = query.eq('user_id', params.user_id);
  }

  if (params?.event_type) {
    query = query.eq('event_type', params.event_type);
  }

  if (params?.limit) {
    query = query.limit(params.limit);
  } else {
    query = query.limit(100);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('Falha ao buscar eventos de auditoria:', error.message);
    return [];
  }

  return (data || []) as AuditEvent[];
}

// Buscar eventos por entidade
export async function getEntityHistory(
  entityType: string,
  entityId: string,
  limit = 50
): Promise<AuditEvent[]> {
  return getAuditEvents({
    entity_type: entityType,
    entity_id: entityId,
    limit,
  });
}

// Buscar eventos por usuário
export async function getUserActivity(
  userId: string,
  limit = 50
): Promise<AuditEvent[]> {
  return getAuditEvents({
    user_id: userId,
    limit,
  });
}

// Estatísticas de auditoria
export async function getAuditStats() {
  const { data, error } = await supabase
    .from('audit_events')
    .select('event_type, entity_type, user_id');

  if (error) {
    console.warn('Falha ao buscar estatísticas de auditoria:', error.message);
    return {
      byEventType: {},
      byEntityType: {},
      byUser: {},
      total: 0,
    };
  }

  const byEventType: Record<string, number> = {};
  const byEntityType: Record<string, number> = {};
  const byUser: Record<string, number> = {};

  (data || []).forEach((event: any) => {
    byEventType[event.event_type] = (byEventType[event.event_type] || 0) + 1;
    byEntityType[event.entity_type] = (byEntityType[event.entity_type] || 0) + 1;
    if (event.user_id) {
      byUser[event.user_id] = (byUser[event.user_id] || 0) + 1;
    }
  });

  return {
    byEventType,
    byEntityType,
    byUser,
    total: data?.length || 0,
  };
}

// Tipos de eventos comuns
export const AUDIT_EVENT_TYPES = {
  // Produtos
  PRODUCT_CREATED: 'product_created',
  PRODUCT_UPDATED: 'product_updated',
  PRODUCT_DELETED: 'product_deleted',
  
  // Estoque
  STOCK_ADJUSTED: 'stock_adjusted',
  STOCK_TRANSFERRED: 'stock_transferred',
  STOCK_RECEIVED: 'stock_received',
  STOCK_SHIPPED: 'stock_shipped',
  
  // Contagens
  COUNT_CREATED: 'count_created',
  COUNT_STARTED: 'count_started',
  COUNT_COMPLETED: 'count_completed',
  COUNT_CANCELLED: 'count_cancelled',
  
  // Localizações
  LOCATION_CREATED: 'location_created',
  LOCATION_UPDATED: 'location_updated',
  
  // Usuários
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  
  // Sistema
  BACKUP_CREATED: 'backup_created',
  BACKUP_RESTORED: 'backup_restored',
  SETTINGS_UPDATED: 'settings_updated',
} as const;

// Entidades comuns
export const AUDIT_ENTITY_TYPES = {
  PRODUCT: 'product',
  LOCATION: 'location',
  MOVEMENT: 'movement',
  RECEIPT: 'receipt',
  SHIPMENT: 'shipment',
  STOCK_COUNT: 'stock_count',
  USER: 'user',
  SYSTEM: 'system',
} as const;
