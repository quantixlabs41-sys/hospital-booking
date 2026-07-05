-- ============================================================
-- MEDIBOOK — HOSPITAL REVIEWS & RATINGS MIGRATION
-- Run in: Supabase SQL Editor (after 028_mfa_aal2_gating.sql)
-- Version: 1.0.0
--
-- Lets patients (any authenticated user) leave a star rating and
-- written opinion about a hospital. Powers:
--   • the public "Top Rated Hospitals" ranking on the landing page
--   • the rating badges on the hospital map / nearby list
--
-- One review per user per hospital (editable). Reviewer name is
-- denormalized into the row so the public directory never needs to
-- read another user's PII-restricted profile.
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. HOSPITAL REVIEWS TABLE
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hospital_reviews (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hospital_id     BIGINT NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    user_id         UUID   NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewer_name   TEXT,                              -- denormalized snapshot for public display
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT CHECK (comment IS NULL OR char_length(comment) <= 1000),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hospital_review UNIQUE (hospital_id, user_id)
);

COMMENT ON TABLE public.hospital_reviews IS
    'Patient ratings & written opinions about hospitals. One review per user per hospital.';

CREATE TRIGGER set_hospital_reviews_updated_at
    BEFORE UPDATE ON public.hospital_reviews
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_hospital_reviews_hospital ON public.hospital_reviews(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_reviews_user     ON public.hospital_reviews(user_id);

-- ─────────────────────────────────────────────
-- 2. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

ALTER TABLE public.hospital_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can read reviews — they are public.
CREATE POLICY "hospital_reviews_public_select"
    ON public.hospital_reviews FOR SELECT
    USING (true);

-- An authenticated user can create their own review.
CREATE POLICY "hospital_reviews_author_insert"
    ON public.hospital_reviews FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- An author can update their own review.
CREATE POLICY "hospital_reviews_author_update"
    ON public.hospital_reviews FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- An author can delete their own review.
CREATE POLICY "hospital_reviews_author_delete"
    ON public.hospital_reviews FOR DELETE
    USING (user_id = auth.uid());

-- Admins have full access (moderation).
CREATE POLICY "hospital_reviews_admin_all"
    ON public.hospital_reviews FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- ─────────────────────────────────────────────
-- 3. AGGREGATE STATS VIEW (public, read-only)
--    Exposes average rating + review count per hospital for ranking.
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW public.hospital_review_stats AS
SELECT
    hospital_id,
    ROUND(AVG(rating)::numeric, 2) AS avg_rating,
    COUNT(*)::int                  AS review_count
FROM public.hospital_reviews
GROUP BY hospital_id;

COMMENT ON VIEW public.hospital_review_stats IS
    'Per-hospital average rating and review count. Backs the Top Rated ranking.';

GRANT SELECT ON public.hospital_review_stats TO anon, authenticated;

-- ============================================================
-- DONE! Hospital reviews & ratings ready. ⭐
-- ============================================================
