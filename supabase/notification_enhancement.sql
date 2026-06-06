-- ============================================================
-- MEDIBOOK — Notification System Enhancement
-- Adds: notifications, push_subscriptions, notification_preferences
-- Updates: notification_logs type constraint
-- Run in: Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. NOTIFICATIONS TABLE (in-app bell)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    body         TEXT NOT NULL,
    type         TEXT NOT NULL CHECK (type IN (
        'APPOINTMENT_BOOKED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_CANCELLED',
        'REMINDER_24H', 'REMINDER_1H', 'APPOINTMENT_COMPLETED', 'SYSTEM'
    )),
    reference_id BIGINT,
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notifications IS 'In-app notifications for the bell icon and notification center.';

-- ─────────────────────────────────────────────
-- 2. PUSH SUBSCRIPTIONS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint     TEXT NOT NULL,
    p256dh       TEXT NOT NULL,
    auth         TEXT NOT NULL,
    device_info  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_push_endpoint UNIQUE (user_id, endpoint)
);

-- ─────────────────────────────────────────────
-- 3. NOTIFICATION PREFERENCES TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    email_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp_number  TEXT,
    whatsapp_verified BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_24h     BOOLEAN NOT NULL DEFAULT TRUE,
    reminder_1h      BOOLEAN NOT NULL DEFAULT TRUE,
    booking_alerts   BOOLEAN NOT NULL DEFAULT TRUE,
    cancel_alerts    BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notification_preferences IS 'Per-user notification channel preferences including WhatsApp opt-in.';

-- ─────────────────────────────────────────────
-- 4. UPDATE notification_logs TYPE CONSTRAINT
-- ─────────────────────────────────────────────
ALTER TABLE public.notification_logs
    DROP CONSTRAINT IF EXISTS notification_logs_type_check;
ALTER TABLE public.notification_logs
    ADD CONSTRAINT notification_logs_type_check
    CHECK (type IN ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'));

-- ─────────────────────────────────────────────
-- 5. INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON public.notification_preferences(user_id);

-- ─────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Notifications: users see their own
CREATE POLICY "notifications_select_own" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifications_insert" ON public.notifications
    FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_admin" ON public.notifications
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- Push subscriptions: users manage their own
CREATE POLICY "push_subs_select_own" ON public.push_subscriptions
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "push_subs_insert_own" ON public.push_subscriptions
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_subs_delete_own" ON public.push_subscriptions
    FOR DELETE USING (user_id = auth.uid());

-- Notification preferences: users manage their own
CREATE POLICY "notif_prefs_select_own" ON public.notification_preferences
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notif_prefs_upsert_own" ON public.notification_preferences
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_prefs_update_own" ON public.notification_preferences
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notif_prefs_admin" ON public.notification_preferences
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- ─────────────────────────────────────────────
-- 7. TRIGGER: Auto-update updated_at
-- ─────────────────────────────────────────────
CREATE TRIGGER set_notif_prefs_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─────────────────────────────────────────────
-- 8. TRIGGER: Auto-notify on appointment status change
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_appointment_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_doctor_name TEXT;
    v_patient_name TEXT;
    v_doctor_user_id UUID;
    v_title TEXT;
    v_body TEXT;
BEGIN
    -- Get doctor name and user_id
    SELECT p.name, d.user_id INTO v_doctor_name, v_doctor_user_id
    FROM public.doctors d
    JOIN public.profiles p ON p.id = d.user_id
    WHERE d.id = NEW.doctor_id;

    -- Get patient name
    SELECT name INTO v_patient_name
    FROM public.profiles WHERE id = NEW.patient_id;

    -- New appointment booked
    IF TG_OP = 'INSERT' THEN
        -- Notify patient
        INSERT INTO public.notifications (user_id, title, body, type, reference_id)
        VALUES (
            NEW.patient_id,
            'Appointment Booked',
            'Your appointment with Dr. ' || COALESCE(v_doctor_name, 'Doctor') || ' on ' || NEW.appointment_date || ' at ' || NEW.slot_start_time::TEXT || ' has been booked.',
            'APPOINTMENT_BOOKED',
            NEW.id
        );
        -- Notify doctor
        IF v_doctor_user_id IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, title, body, type, reference_id)
            VALUES (
                v_doctor_user_id,
                'New Appointment',
                'New appointment from ' || COALESCE(v_patient_name, 'Patient') || ' on ' || NEW.appointment_date || ' at ' || NEW.slot_start_time::TEXT || '.',
                'APPOINTMENT_BOOKED',
                NEW.id
            );
        END IF;
    END IF;

    -- Status changed
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        IF NEW.status = 'CONFIRMED' THEN
            v_title := 'Appointment Confirmed';
            v_body := 'Your appointment with Dr. ' || COALESCE(v_doctor_name, 'Doctor') || ' on ' || NEW.appointment_date || ' has been confirmed.';
            INSERT INTO public.notifications (user_id, title, body, type, reference_id)
            VALUES (NEW.patient_id, v_title, v_body, 'APPOINTMENT_CONFIRMED', NEW.id);

        ELSIF NEW.status = 'CANCELLED' THEN
            v_title := 'Appointment Cancelled';
            v_body := 'Your appointment with Dr. ' || COALESCE(v_doctor_name, 'Doctor') || ' on ' || NEW.appointment_date || ' has been cancelled.';
            -- Notify patient
            INSERT INTO public.notifications (user_id, title, body, type, reference_id)
            VALUES (NEW.patient_id, v_title, v_body, 'APPOINTMENT_CANCELLED', NEW.id);
            -- Notify doctor
            IF v_doctor_user_id IS NOT NULL THEN
                INSERT INTO public.notifications (user_id, title, body, type, reference_id)
                VALUES (v_doctor_user_id, 'Appointment Cancelled',
                    'Appointment with ' || COALESCE(v_patient_name, 'Patient') || ' on ' || NEW.appointment_date || ' was cancelled.',
                    'APPOINTMENT_CANCELLED', NEW.id);
            END IF;

        ELSIF NEW.status = 'COMPLETED' THEN
            v_title := 'Appointment Completed';
            v_body := 'Your appointment with Dr. ' || COALESCE(v_doctor_name, 'Doctor') || ' has been marked as completed.';
            INSERT INTO public.notifications (user_id, title, body, type, reference_id)
            VALUES (NEW.patient_id, v_title, v_body, 'APPOINTMENT_COMPLETED', NEW.id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_appointment_change ON public.appointments;
CREATE TRIGGER on_appointment_change
    AFTER INSERT OR UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.handle_appointment_notification();

-- ─────────────────────────────────────────────
-- 9. ENABLE REALTIME for notifications table
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================================
-- DONE! Notification system tables ready. 🔔
-- ============================================================
