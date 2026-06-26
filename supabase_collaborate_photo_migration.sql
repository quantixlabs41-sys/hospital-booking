-- ============================================================
-- MEDIBOOK — COLLABORATE PHOTO MIGRATION
-- Run in: Supabase SQL Editor (AFTER supabase_collaborate_migration.sql)
-- Adds: photo_url column + collaborate-photos storage bucket
-- ============================================================

-- 1. Add photo_url column to collaboration_applications
ALTER TABLE public.collaboration_applications
ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN public.collaboration_applications.photo_url IS
    'URL/path to the applicant photo (mandatory for doctors). Stored in collaborate-photos bucket.';

-- 2. Create storage bucket for applicant photos (2MB max, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'collaborate-photos',
    'collaborate-photos',
    TRUE,
    2097152,  -- 2MB max
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Allow anyone to upload photos (for application submissions)
CREATE POLICY "collab_photos_public_upload" ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'collaborate-photos');

-- 4. Allow anyone to read photos (public bucket for display)
CREATE POLICY "collab_photos_public_read" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'collaborate-photos');

-- ============================================================
-- DONE! Photo support added. 🎉
-- ============================================================
