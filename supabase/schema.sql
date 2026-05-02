-- =============================================
-- WPP BOT - Schema do Banco de Dados
-- Execute no Supabase SQL Editor
-- =============================================

-- Instancias do WhatsApp
CREATE TABLE IF NOT EXISTS instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  evolution_instance_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting', 'qr_code')),
  qr_code TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grupos do WhatsApp
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_jid TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  participant_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT FALSE,
  welcome_message TEXT,
  followup_message TEXT,
  followup_media_url TEXT,
  followup_media_type TEXT DEFAULT 'none' CHECK (followup_media_type IN ('image', 'video', 'none')),
  followup_links TEXT[] DEFAULT '{}',
  delay_between_messages INTEGER DEFAULT 10,
  followup_delay INTEGER DEFAULT 60,
  batch_size INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relação grupo <-> instancias (até 5 por grupo)
CREATE TABLE IF NOT EXISTS group_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 1,
  messages_sent_in_batch INTEGER DEFAULT 0,
  is_current BOOLEAN DEFAULT FALSE,
  UNIQUE(group_id, instance_id),
  UNIQUE(group_id, position)
);

-- Fila de disparos
CREATE TABLE IF NOT EXISTS dispatch_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  participant_phone TEXT NOT NULL,
  assigned_instance_id UUID REFERENCES instances(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rastreamento de follow-up
CREATE TABLE IF NOT EXISTS followup_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES dispatch_queue(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  participant_phone TEXT NOT NULL,
  instance_id UUID NOT NULL REFERENCES instances(id),
  first_message_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reply_received_at TIMESTAMPTZ,
  followup_scheduled_at TIMESTAMPTZ,
  followup_sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'waiting_reply' CHECK (status IN ('waiting_reply', 'replied', 'followup_sent', 'ignored')),
  UNIQUE(participant_phone, group_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dispatch_queue_status_scheduled ON dispatch_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_dispatch_queue_group_status ON dispatch_queue(group_id, status);
CREATE INDEX IF NOT EXISTS idx_followup_tracking_phone ON followup_tracking(participant_phone, status);
CREATE INDEX IF NOT EXISTS idx_followup_tracking_scheduled ON followup_tracking(followup_scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_group_instances_group ON group_instances(group_id);
CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER instances_updated_at
  BEFORE UPDATE ON instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
