-- ═══════════════════════════════════════════════════════════════
-- MFA STEP-UP (aal2) DATA-LAYER GATING  —  OPT-IN / INERT BY DEFAULT
--
-- ⚠️ SAFETY: This migration DOES NOT change any existing policy or behaviour.
-- It only creates a reusable helper, `public.jwt_is_aal2()`. The actual
-- enforcement policies are provided as COMMENTED, ready-to-run blocks at the
-- bottom. Nothing is gated until you deliberately uncomment and run them.
--
-- WHY GRADUAL: requiring aal2 in RLS will DENY data access to any session that
-- has not completed an MFA step-up. Enable it ONLY after:
--   1. TOTP is enabled in the Supabase dashboard,
--   2. the affected users have enrolled, and
--   3. you have validated the enroll + step-up flow in staging.
-- Enable one table at a time and keep this file as the audit trail.
--
-- Idempotent / safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- Returns TRUE only when the CURRENT session's JWT carries aal = 'aal2'.
-- The claim value is authoritative (per the requirements): a token that is not
-- aal2 is treated as not-stepped-up regardless of anything else.
CREATE OR REPLACE FUNCTION public.jwt_is_aal2()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        current_setting('request.jwt.claims', true)::jsonb ->> 'aal',
        'aal1'
    ) = 'aal2';
$$;

REVOKE ALL ON FUNCTION public.jwt_is_aal2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jwt_is_aal2() TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- OPT-IN ENFORCEMENT  (uncomment ONE table at a time, then run)
--
-- Pattern: add a RESTRICTIVE policy so it ANDs with the existing permissive
-- policies — existing access rules are preserved, but every request must ALSO
-- come from an aal2 session. Restrictive policies never widen access, so if you
-- later drop them you are exactly back to today's behaviour.
--
-- ── Payments ──────────────────────────────────────────────────
-- ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "payments_require_aal2" ON public.payments;
-- CREATE POLICY "payments_require_aal2" ON public.payments
--     AS RESTRICTIVE FOR ALL
--     USING (public.jwt_is_aal2())
--     WITH CHECK (public.jwt_is_aal2());
--
-- ── Medical history + documents (patient PHI) ────────────────
-- ALTER TABLE public.medical_history ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "medical_history_require_aal2" ON public.medical_history;
-- CREATE POLICY "medical_history_require_aal2" ON public.medical_history
--     AS RESTRICTIVE FOR ALL
--     USING (public.jwt_is_aal2())
--     WITH CHECK (public.jwt_is_aal2());
--
-- ALTER TABLE public.medical_documents ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "medical_documents_require_aal2" ON public.medical_documents;
-- CREATE POLICY "medical_documents_require_aal2" ON public.medical_documents
--     AS RESTRICTIVE FOR ALL
--     USING (public.jwt_is_aal2())
--     WITH CHECK (public.jwt_is_aal2());
--
-- ── Complaints ────────────────────────────────────────────────
-- ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "complaints_require_aal2" ON public.complaints;
-- CREATE POLICY "complaints_require_aal2" ON public.complaints
--     AS RESTRICTIVE FOR ALL
--     USING (public.jwt_is_aal2())
--     WITH CHECK (public.jwt_is_aal2());
--
-- ROLLBACK (instant, restores today's behaviour):
-- DROP POLICY IF EXISTS "payments_require_aal2"           ON public.payments;
-- DROP POLICY IF EXISTS "medical_history_require_aal2"    ON public.medical_history;
-- DROP POLICY IF EXISTS "medical_documents_require_aal2"  ON public.medical_documents;
-- DROP POLICY IF EXISTS "complaints_require_aal2"         ON public.complaints;
-- ═══════════════════════════════════════════════════════════════
