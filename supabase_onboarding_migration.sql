-- ============================================================
-- MEDIBOOK — ONBOARDING & CONSENT MIGRATION
-- Run in: Supabase SQL Editor (AFTER supabase_migration.sql)
-- Version: 1.0.0
-- Tables: onboarding_progress, user_preferences, user_consents
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. ONBOARDING PROGRESS TABLE
-- Tracks which onboarding steps each user has completed.
-- Steps: 'welcome', 'profile_details', 'preferences', 'consent', 'completed'
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_progress (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    step_key        TEXT NOT NULL CHECK (step_key IN (
                        'welcome', 'profile_details', 'preferences', 'consent', 'completed'
                    )),
    metadata        JSONB DEFAULT '{}',
    completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_onboarding_user_step UNIQUE (user_id, step_key)
);

COMMENT ON TABLE public.onboarding_progress IS 'Tracks onboarding wizard completion per user. One row per step per user.';

-- ─────────────────────────────────────────────
-- 2. USER PREFERENCES TABLE
-- Stores notification/language/timezone preferences.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_preferences (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id               UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    notification_channel  TEXT NOT NULL DEFAULT 'EMAIL'
                          CHECK (notification_channel IN ('EMAIL', 'SMS', 'WHATSAPP', 'ALL')),
    language              TEXT NOT NULL DEFAULT 'en',
    timezone              TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    appointment_reminder  BOOLEAN NOT NULL DEFAULT TRUE,
    marketing_emails      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_preferences IS 'User notification/language/timezone preferences. 1:1 with profiles.';

-- Auto-update updated_at
CREATE TRIGGER set_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─────────────────────────────────────────────
-- 3. USER CONSENTS TABLE (GDPR / Audit-Grade)
-- Immutable consent records with versioning.
-- Insert-only: users cannot update or delete consent rows.
-- Revocation = new row with granted=FALSE.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_consents (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    consent_type    TEXT NOT NULL CHECK (consent_type IN (
                        'TERMS_OF_SERVICE', 'PRIVACY_POLICY',
                        'MARKETING_EMAILS', 'DATA_PROCESSING',
                        'WHATSAPP_NOTIFICATIONS'
                    )),
    version         TEXT NOT NULL DEFAULT '1.0',
    granted         BOOLEAN NOT NULL DEFAULT TRUE,
    ip_address      INET,
    user_agent      TEXT,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

COMMENT ON TABLE public.user_consents IS 'Immutable audit log of user consent grants/revocations. Insert-only for compliance.';

-- ─────────────────────────────────────────────
-- 4. PERFORMANCE INDEXES
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_onboarding_user ON public.onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_user_step ON public.onboarding_progress(user_id, step_key);

CREATE INDEX IF NOT EXISTS idx_preferences_user ON public.user_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_consents_user ON public.user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_consents_user_type ON public.user_consents(user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_consents_type_version ON public.user_consents(consent_type, version);

-- ─────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Onboarding Progress: users can read/write their own
CREATE POLICY "onboarding_select_own" ON public.onboarding_progress
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "onboarding_insert_own" ON public.onboarding_progress
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "onboarding_admin_select" ON public.onboarding_progress
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- User Preferences: users can read/write their own
CREATE POLICY "preferences_select_own" ON public.user_preferences
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "preferences_insert_own" ON public.user_preferences
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "preferences_update_own" ON public.user_preferences
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "preferences_admin_select" ON public.user_preferences
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- User Consents: insert-only for users, admin can read all
CREATE POLICY "consents_select_own" ON public.user_consents
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "consents_insert_own" ON public.user_consents
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "consents_admin_select" ON public.user_consents
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );
-- Note: No UPDATE or DELETE policies for users — consents are immutable

-- ─────────────────────────────────────────────
-- 6. HELPER FUNCTION: Check Onboarding Status
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_onboarding_complete(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.onboarding_progress
        WHERE user_id = p_user_id AND step_key = 'completed'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- DONE! Onboarding schema ready. 🎉
-- Run this AFTER supabase_migration.sql + supabase_profile_management.sql
-- ============================================================
