-- ============================================================
-- FIX: Row Level Security for collaboration_applications
-- 
-- Problem: "new row violates row-level security policy for 
--           table collaboration_applications"
-- 
-- This happens when the INSERT policy is missing or incorrect.
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor).
-- ============================================================

-- Step 1: Drop all existing policies on the table (clean slate)
DROP POLICY IF EXISTS "collab_apps_public_insert"    ON public.collaboration_applications;
DROP POLICY IF EXISTS "collab_apps_admin_select"     ON public.collaboration_applications;
DROP POLICY IF EXISTS "collab_apps_admin_update"     ON public.collaboration_applications;
DROP POLICY IF EXISTS "collab_apps_anon_insert"      ON public.collaboration_applications;
DROP POLICY IF EXISTS "collab_apps_public_select"    ON public.collaboration_applications;
DROP POLICY IF EXISTS "Enable insert for anon"       ON public.collaboration_applications;
DROP POLICY IF EXISTS "Enable insert for all"        ON public.collaboration_applications;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.collaboration_applications ENABLE ROW LEVEL SECURITY;

-- Step 3: Allow ANYONE (anon + authenticated) to INSERT new applications
-- The key is targeting both 'anon' and 'authenticated' roles explicitly
CREATE POLICY "collab_apps_public_insert"
    ON public.collaboration_applications
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Step 4: Allow ANYONE to SELECT (needed for the email-exists check)
CREATE POLICY "collab_apps_public_select"
    ON public.collaboration_applications
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Step 5: Only admins can UPDATE applications (status changes, reviews)
CREATE POLICY "collab_apps_admin_update"
    ON public.collaboration_applications
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- ============================================================
-- VERIFICATION: Run this query to confirm policies are active
-- ============================================================
-- SELECT policyname, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename = 'collaboration_applications';
