-- ============================================================
-- MEDIBOOK — REVIEWS FOR ANY HOSPITAL ("PLACES") MIGRATION
-- Run in: Supabase SQL Editor (after 029_hospital_reviews.sql)
-- Version: 1.0.0
--
-- Extends hospital_reviews so patients can review ANY hospital —
-- both hospitals registered on MediBook AND external hospitals
-- discovered from OpenStreetMap (that are not in our collaboration).
--
-- Each review now targets a "place" identified by a canonical
-- `place_key`:
--    • MediBook hospital  → 'db:<hospital_id>'
--    • External (OSM)     → 'osm:<type>/<id>'   e.g. 'osm:node/12345'
--
-- External places carry their own name / city / coordinates so the
-- ranking + map can display them without a hospitals row.
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. SCHEMA CHANGES
-- ─────────────────────────────────────────────

-- hospital_id becomes optional (external places have none).
ALTER TABLE public.hospital_reviews
    ALTER COLUMN hospital_id DROP NOT NULL;

-- Canonical place identifier + denormalized place metadata for externals.
ALTER TABLE public.hospital_reviews
    ADD COLUMN IF NOT EXISTS place_key  TEXT,
    ADD COLUMN IF NOT EXISTS place_name TEXT,
    ADD COLUMN IF NOT EXISTS place_city TEXT,
    ADD COLUMN IF NOT EXISTS place_lat  DECIMAL(10,8),
    ADD COLUMN IF NOT EXISTS place_lng  DECIMAL(11,8);

-- Back-fill place_key for existing MediBook-hospital reviews.
UPDATE public.hospital_reviews
    SET place_key = 'db:' || hospital_id
    WHERE place_key IS NULL AND hospital_id IS NOT NULL;

-- Ensure a place_key is always present (trigger fills DB rows automatically).
CREATE OR REPLACE FUNCTION public.set_review_place_key()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.place_key IS NULL AND NEW.hospital_id IS NOT NULL THEN
        NEW.place_key := 'db:' || NEW.hospital_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_hospital_reviews_place_key ON public.hospital_reviews;
CREATE TRIGGER set_hospital_reviews_place_key
    BEFORE INSERT OR UPDATE ON public.hospital_reviews
    FOR EACH ROW EXECUTE FUNCTION public.set_review_place_key();

ALTER TABLE public.hospital_reviews
    ALTER COLUMN place_key SET NOT NULL;

-- Integrity: a 'db:' key must have a hospital_id; an 'osm:' key must not.
ALTER TABLE public.hospital_reviews
    DROP CONSTRAINT IF EXISTS chk_review_place;
ALTER TABLE public.hospital_reviews
    ADD CONSTRAINT chk_review_place CHECK (
        (place_key LIKE 'db:%'  AND hospital_id IS NOT NULL) OR
        (place_key LIKE 'osm:%' AND hospital_id IS NULL)
    );

-- One review per user per place (replaces the old hospital-scoped unique).
ALTER TABLE public.hospital_reviews
    DROP CONSTRAINT IF EXISTS uq_hospital_review;
ALTER TABLE public.hospital_reviews
    DROP CONSTRAINT IF EXISTS uq_place_review;
ALTER TABLE public.hospital_reviews
    ADD CONSTRAINT uq_place_review UNIQUE (user_id, place_key);

CREATE INDEX IF NOT EXISTS idx_hospital_reviews_place ON public.hospital_reviews(place_key);

-- ─────────────────────────────────────────────
-- 2. UNIFIED STATS VIEW (keyed by place_key)
--    One row per reviewed place — MediBook or external — with the
--    aggregates and (for externals) the place metadata needed to
--    render and rank it.
-- ─────────────────────────────────────────────

DROP VIEW IF EXISTS public.hospital_review_stats;

CREATE OR REPLACE VIEW public.place_review_stats AS
SELECT
    place_key,
    MAX(hospital_id)                         AS hospital_id,
    ROUND(AVG(rating)::numeric, 2)           AS avg_rating,
    COUNT(*)::int                            AS review_count,
    -- Denormalized place metadata (externals only; NULL for db hospitals).
    (ARRAY_AGG(place_name ORDER BY created_at DESC) FILTER (WHERE place_name IS NOT NULL))[1] AS place_name,
    (ARRAY_AGG(place_city ORDER BY created_at DESC) FILTER (WHERE place_city IS NOT NULL))[1] AS place_city,
    (ARRAY_AGG(place_lat  ORDER BY created_at DESC) FILTER (WHERE place_lat  IS NOT NULL))[1] AS place_lat,
    (ARRAY_AGG(place_lng  ORDER BY created_at DESC) FILTER (WHERE place_lng  IS NOT NULL))[1] AS place_lng
FROM public.hospital_reviews
GROUP BY place_key;

COMMENT ON VIEW public.place_review_stats IS
    'Per-place (MediBook or external) rating aggregates. Backs the ranking algorithm.';

GRANT SELECT ON public.place_review_stats TO anon, authenticated;

-- Backwards-compatible alias so any older query keeps working.
CREATE OR REPLACE VIEW public.hospital_review_stats AS
SELECT hospital_id, avg_rating, review_count
FROM public.place_review_stats
WHERE hospital_id IS NOT NULL;

GRANT SELECT ON public.hospital_review_stats TO anon, authenticated;

-- ============================================================
-- DONE! Reviews now cover every hospital, on-platform or not. ⭐🌍
-- ============================================================
