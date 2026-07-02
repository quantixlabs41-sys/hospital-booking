-- ═══════════════════════════════════════════════════════════════
-- MFA RECOVERY CODES  (additive — does not touch any existing flow)
--
-- Single-use backup codes so a user who loses their authenticator can reset
-- their own MFA (via the mfa-recovery-reset edge function) instead of being
-- locked out. Codes are stored ONLY as SHA-256 hashes; the plaintext is shown
-- once at generation and never stored.
--
-- Access model: RLS is enabled with NO client policies, so the table is
-- unreadable/unwritable directly. All access goes through the SECURITY DEFINER
-- functions below, each scoped to auth.uid(). Nothing else in the app reads or
-- writes this table, so this migration cannot affect current behaviour.
--
-- Idempotent / safe to re-run. Depends on: 001 (profiles), pgcrypto.
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.mfa_recovery_codes (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    code_hash   TEXT NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_recovery_user ON public.mfa_recovery_codes(user_id);

ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies: clients never touch this table directly. The
-- SECURITY DEFINER functions below (owned by the migration role) bypass RLS.

-- ─────────────────────────────────────────────
-- Generate a fresh set of 10 single-use recovery codes for the caller.
-- Invalidates any previous codes. Returns the plaintext codes ONCE.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mfa_generate_recovery_codes()
RETURNS TEXT[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_uid   UUID := auth.uid();
    v_codes TEXT[] := ARRAY[]::TEXT[];
    v_code  TEXT;
    i       INT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
    END IF;

    -- Replace any existing codes.
    DELETE FROM public.mfa_recovery_codes WHERE user_id = v_uid;

    FOR i IN 1..10 LOOP
        -- 10 hex chars, shown grouped as xxxxx-xxxxx; stored hashed + normalized.
        v_code := encode(gen_random_bytes(5), 'hex');
        INSERT INTO public.mfa_recovery_codes (user_id, code_hash)
        VALUES (v_uid, encode(digest(lower(v_code), 'sha256'), 'hex'));
        v_codes := array_append(
            v_codes,
            substr(v_code, 1, 5) || '-' || substr(v_code, 6, 5)
        );
    END LOOP;

    RETURN v_codes;
END;
$$;

REVOKE ALL ON FUNCTION public.mfa_generate_recovery_codes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mfa_generate_recovery_codes() TO authenticated;

-- ─────────────────────────────────────────────
-- How many unused recovery codes the caller has left.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mfa_recovery_codes_remaining()
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT COUNT(*)::INT
    FROM public.mfa_recovery_codes
    WHERE user_id = auth.uid() AND consumed_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.mfa_recovery_codes_remaining() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mfa_recovery_codes_remaining() TO authenticated;

-- ─────────────────────────────────────────────
-- Consume one recovery code for the caller. Returns TRUE if a valid unused
-- code matched (and is now marked used), FALSE otherwise. Constant-ish: always
-- hashes the input before comparing. Used by the mfa-recovery-reset function.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mfa_consume_recovery_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_uid  UUID := auth.uid();
    v_hash TEXT;
    v_id   BIGINT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
    END IF;

    -- Normalize: strip spaces/dashes, lowercase.
    v_hash := encode(digest(lower(regexp_replace(COALESCE(p_code, ''), '[^a-zA-Z0-9]', '', 'g')), 'sha256'), 'hex');

    SELECT id INTO v_id
    FROM public.mfa_recovery_codes
    WHERE user_id = v_uid AND code_hash = v_hash AND consumed_at IS NULL
    LIMIT 1;

    IF v_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.mfa_recovery_codes SET consumed_at = NOW() WHERE id = v_id;
    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.mfa_consume_recovery_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mfa_consume_recovery_code(TEXT) TO authenticated;
