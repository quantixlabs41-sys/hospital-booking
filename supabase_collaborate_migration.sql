-- ============================================================
-- MEDIBOOK — COLLABORATE SYSTEM MIGRATION
-- Run in: Supabase SQL Editor (AFTER supabase_migration.sql)
-- Version: 1.0.0
-- Tables: collaboration_applications
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. COLLABORATION APPLICATIONS TABLE
-- Stores doctor/hospital applications for admin review.
-- Status flow: PENDING → UNDER_REVIEW → APPROVED / REJECTED
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.collaboration_applications (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Application Type
    application_type    TEXT NOT NULL CHECK (application_type IN ('DOCTOR', 'HOSPITAL')),
    status              TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')),

    -- Applicant Details (common)
    applicant_name      TEXT NOT NULL,
    applicant_email     TEXT NOT NULL,
    applicant_phone     TEXT NOT NULL,

    -- Doctor-specific fields
    specialization      TEXT,
    qualification       TEXT,
    experience_years    INTEGER CHECK (experience_years >= 0),
    consultation_fee    DECIMAL(10,2) CHECK (consultation_fee >= 0),

    -- Shared professional fields
    registration_number TEXT,
    department_id       BIGINT REFERENCES public.departments(id) ON DELETE SET NULL,
    bio                 TEXT,
    documents_url       TEXT,

    -- Hospital-specific fields
    hospital_name       TEXT,
    hospital_address    TEXT,
    hospital_city       TEXT,
    hospital_state      TEXT,
    hospital_pincode    TEXT,
    hospital_type       TEXT CHECK (hospital_type IN ('GOVERNMENT', 'PRIVATE', 'CLINIC', 'MULTI_SPECIALTY')),
    bed_count           INTEGER CHECK (bed_count >= 0),

    -- Admin review fields
    reviewed_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    admin_notes         TEXT,

    -- Link to created user after approval
    created_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.collaboration_applications IS
    'Stores doctor and hospital collaboration applications for admin review and approval. Status: PENDING → UNDER_REVIEW → APPROVED/REJECTED.';

-- ─────────────────────────────────────────────
-- 2. AUTO-UPDATE updated_at TRIGGER
-- ─────────────────────────────────────────────

CREATE TRIGGER set_collaboration_applications_updated_at
    BEFORE UPDATE ON public.collaboration_applications
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─────────────────────────────────────────────
-- 3. PERFORMANCE INDEXES
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_collab_apps_status
    ON public.collaboration_applications(status);

CREATE INDEX IF NOT EXISTS idx_collab_apps_type
    ON public.collaboration_applications(application_type);

CREATE INDEX IF NOT EXISTS idx_collab_apps_email
    ON public.collaboration_applications(applicant_email);

CREATE INDEX IF NOT EXISTS idx_collab_apps_status_type
    ON public.collaboration_applications(status, application_type);

CREATE INDEX IF NOT EXISTS idx_collab_apps_created_at
    ON public.collaboration_applications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collab_apps_reviewed_by
    ON public.collaboration_applications(reviewed_by)
    WHERE reviewed_by IS NOT NULL;

-- Partial unique index: prevent duplicate PENDING/UNDER_REVIEW applications for same email
CREATE UNIQUE INDEX IF NOT EXISTS idx_collab_apps_active_email
    ON public.collaboration_applications(applicant_email)
    WHERE status IN ('PENDING', 'UNDER_REVIEW');

-- ─────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────

ALTER TABLE public.collaboration_applications ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including anonymous) to INSERT new applications
CREATE POLICY "collab_apps_public_insert"
    ON public.collaboration_applications
    FOR INSERT
    WITH CHECK (true);

-- Only admins can SELECT applications
CREATE POLICY "collab_apps_admin_select"
    ON public.collaboration_applications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Only admins can UPDATE applications (status changes, review notes)
CREATE POLICY "collab_apps_admin_update"
    ON public.collaboration_applications
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- No DELETE policy — applications are never deleted (audit trail)

-- ─────────────────────────────────────────────
-- 5. STORAGE BUCKET FOR APPLICATION DOCUMENTS
-- ─────────────────────────────────────────────

-- Create bucket for application documents (medical licenses, certificates)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'collaborate-docs',
    'collaborate-docs',
    FALSE,
    5242880,  -- 5MB max
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload documents (for application submissions)
CREATE POLICY "collab_docs_public_upload" ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'collaborate-docs');

-- Only admins can view uploaded documents
CREATE POLICY "collab_docs_admin_read" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'collaborate-docs'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- ─────────────────────────────────────────────
-- 6. HELPER VIEW: Application Summary
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_collaboration_summary AS
SELECT
    ca.id,
    ca.application_type,
    ca.status,
    ca.applicant_name,
    ca.applicant_email,
    ca.applicant_phone,
    ca.specialization,
    ca.hospital_name,
    ca.hospital_type,
    ca.created_at,
    ca.reviewed_at,
    p.name AS reviewer_name,
    dep.name AS department_name
FROM public.collaboration_applications ca
LEFT JOIN public.profiles p ON p.id = ca.reviewed_by
LEFT JOIN public.departments dep ON dep.id = ca.department_id
ORDER BY ca.created_at DESC;

-- ============================================================
-- DONE! Collaborate schema ready. 🎉
-- Run this AFTER supabase_migration.sql
-- ============================================================
