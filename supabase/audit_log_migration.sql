-- ============================================================
-- MEDIBOOK — Audit Logs Table
-- Security event logging for production monitoring.
-- Run in: Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event       TEXT NOT NULL,
    details     JSONB,
    ip_address  TEXT,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.audit_logs IS 'Security audit log for monitoring login attempts, tamper detection, rate limiting, and other security events.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON public.audit_logs(event);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_event ON public.audit_logs(user_id, event);

-- RLS — Admin-only read, insert allowed for security logging
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

CREATE POLICY "audit_logs_insert" ON public.audit_logs
    FOR INSERT WITH CHECK (true);

-- ============================================================
-- DONE! Audit logs table ready. 📊
-- ============================================================
