-- ============================================================
-- MEDIBOOK — Chat Sessions & Messages
-- Persists AI chat conversations per user.
-- Run in: Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. CHAT SESSIONS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT 'New Chat',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.chat_sessions IS 'Stores AI chatbot conversation sessions per user.';

-- ─────────────────────────────────────────────
-- 2. CHAT MESSAGES TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id  BIGINT NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.chat_messages IS 'Individual messages within a chat session.';

-- ─────────────────────────────────────────────
-- 3. INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON public.chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at ASC);

-- ─────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Sessions: users can manage their own
CREATE POLICY "chat_sessions_select_own" ON public.chat_sessions
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "chat_sessions_insert_own" ON public.chat_sessions
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "chat_sessions_update_own" ON public.chat_sessions
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "chat_sessions_delete_own" ON public.chat_sessions
    FOR DELETE USING (user_id = auth.uid());

-- Messages: users can access messages in their own sessions
CREATE POLICY "chat_messages_select_own" ON public.chat_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = chat_messages.session_id AND user_id = auth.uid())
    );
CREATE POLICY "chat_messages_insert_own" ON public.chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.chat_sessions WHERE id = chat_messages.session_id AND user_id = auth.uid())
    );

-- ─────────────────────────────────────────────
-- 5. AUTO-UPDATE updated_at TRIGGER
-- ─────────────────────────────────────────────
CREATE TRIGGER set_chat_sessions_updated_at
    BEFORE UPDATE ON public.chat_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- DONE! Chat session tables ready. 💬
-- ============================================================
