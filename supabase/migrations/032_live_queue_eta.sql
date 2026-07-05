-- ═══════════════════════════════════════════════════════════════
-- 032 — LIVE QUEUE ETA (Dynamic Queue Tokenization)
--
-- Adds an "Uber-style" live ETA layer on top of the slot-based
-- appointments table. Per doctor/day we materialize a live queue
-- (queue_entries) whose ETAs are recomputed from the doctor's ACTUAL
-- consultation pace (doctor_pace_stats). When a patient's ETA moves
-- beyond a threshold we drop an in-app notification (which already
-- streams over Realtime), and the queue-eta-notifier Edge Function
-- adds web push.
--
-- Design ref: .kiro/specs/live-queue-eta/design.md
-- Timezone: the app is India-based (₹ / +91); slot times are wall-clock
--           in 'Asia/Kolkata'. Change QUEUE_TZ occurrences if you relocate.
--
-- Idempotent / safe to re-run. Depends on: 001, 013 (notifications), 017.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 0. Allow the new in-app notification type
-- ─────────────────────────────────────────────
ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check CHECK (type IN (
        'APPOINTMENT_BOOKED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_CANCELLED',
        'REMINDER_24H', 'REMINDER_1H', 'APPOINTMENT_COMPLETED', 'SYSTEM',
        'QUEUE_ETA_SHIFT'
    ));

-- ─────────────────────────────────────────────
-- 1. TABLES
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.queue_entries (
    id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    appointment_id           BIGINT NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
    doctor_id                BIGINT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    patient_id               UUID   NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    queue_date               DATE   NOT NULL,
    scheduled_start_time     TIME   NOT NULL,
    position                 INT    NOT NULL DEFAULT 0,
    state                    TEXT   NOT NULL DEFAULT 'WAITING'
                               CHECK (state IN ('WAITING','CHECKED_IN','IN_CONSULTATION','COMPLETED','SKIPPED')),
    eta_at                   TIMESTAMPTZ,
    suggested_leave_at       TIMESTAMPTZ,
    consult_started_at       TIMESTAMPTZ,
    consult_completed_at     TIMESTAMPTZ,
    actual_duration_minutes  INT CHECK (actual_duration_minutes IS NULL OR actual_duration_minutes > 0),
    last_notified_eta_at     TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.queue_entries IS
    'Live per-doctor/day queue projected from appointments. Owns ordering, lifecycle state and ETA.';

CREATE TABLE IF NOT EXISTS public.doctor_pace_stats (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doctor_id              BIGINT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    stat_date              DATE   NOT NULL,
    rolling_avg_minutes    NUMERIC(6,2) NOT NULL DEFAULT 30 CHECK (rolling_avg_minutes > 0),
    sample_size            INT    NOT NULL DEFAULT 0 CHECK (sample_size >= 0),
    manual_delay_minutes   INT    NOT NULL DEFAULT 0,
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pace_doctor_day UNIQUE (doctor_id, stat_date)
);

COMMENT ON TABLE public.doctor_pace_stats IS
    'Rolling consultation-pace estimate per doctor/day, plus cumulative manual delay.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_queue_doctor_date_pos ON public.queue_entries(doctor_id, queue_date, position);
CREATE INDEX IF NOT EXISTS idx_queue_patient ON public.queue_entries(patient_id);
CREATE INDEX IF NOT EXISTS idx_queue_doctor_date_state ON public.queue_entries(doctor_id, queue_date, state);

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS set_queue_entries_updated_at ON public.queue_entries;
CREATE TRIGGER set_queue_entries_updated_at
    BEFORE UPDATE ON public.queue_entries
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- At most one IN_CONSULTATION per doctor/day
CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_one_active
    ON public.queue_entries(doctor_id, queue_date)
    WHERE state = 'IN_CONSULTATION';

-- ─────────────────────────────────────────────
-- 2. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_pace_stats ENABLE ROW LEVEL SECURITY;

-- queue_entries reads: patient sees own; doctor sees their queue; admin all.
DROP POLICY IF EXISTS "queue_select_patient" ON public.queue_entries;
CREATE POLICY "queue_select_patient" ON public.queue_entries
    FOR SELECT USING (patient_id = auth.uid());

DROP POLICY IF EXISTS "queue_select_doctor" ON public.queue_entries;
CREATE POLICY "queue_select_doctor" ON public.queue_entries
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "queue_admin_all" ON public.queue_entries;
CREATE POLICY "queue_admin_all" ON public.queue_entries
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- Writes flow through SECURITY DEFINER RPCs below, which re-verify ownership.

-- pace stats: doctor reads own, admin all.
DROP POLICY IF EXISTS "pace_select_doctor" ON public.doctor_pace_stats;
CREATE POLICY "pace_select_doctor" ON public.doctor_pace_stats
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "pace_admin_all" ON public.doctor_pace_stats;
CREATE POLICY "pace_admin_all" ON public.doctor_pace_stats
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- ─────────────────────────────────────────────
-- 3. HELPERS
-- ─────────────────────────────────────────────

-- Absolute instant of a slot's wall-clock time (India timezone).
CREATE OR REPLACE FUNCTION public.queue_slot_ts(p_date DATE, p_time TIME)
RETURNS TIMESTAMPTZ
LANGUAGE sql IMMUTABLE
AS $$
    SELECT (p_date + p_time) AT TIME ZONE 'Asia/Kolkata';
$$;

-- Does the caller own this doctor row?
CREATE OR REPLACE FUNCTION public.caller_owns_doctor(p_doctor_id BIGINT)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.doctors d
        WHERE d.id = p_doctor_id AND d.user_id = auth.uid()
    );
$$;

-- Rolling pace: mean of the last 5 completed consult durations for the
-- doctor/day. Falls back to the booked slot duration for that weekday, else 30.
CREATE OR REPLACE FUNCTION public.estimate_pace(p_doctor_id BIGINT, p_date DATE)
RETURNS TABLE (avg_minutes NUMERIC, sample_size INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_avg    NUMERIC;
    v_count  INT;
    v_slot   INT;
    v_day    TEXT;
BEGIN
    SELECT AVG(d.actual_duration_minutes), COUNT(*)
      INTO v_avg, v_count
    FROM (
        SELECT actual_duration_minutes
        FROM public.queue_entries
        WHERE doctor_id = p_doctor_id
          AND queue_date = p_date
          AND state = 'COMPLETED'
          AND actual_duration_minutes IS NOT NULL
        ORDER BY consult_completed_at DESC
        LIMIT 5
    ) d;

    IF v_count IS NULL OR v_count = 0 THEN
        v_day := CASE EXTRACT(DOW FROM p_date)::INT
            WHEN 0 THEN 'SUN' WHEN 1 THEN 'MON' WHEN 2 THEN 'TUE'
            WHEN 3 THEN 'WED' WHEN 4 THEN 'THU' WHEN 5 THEN 'FRI'
            WHEN 6 THEN 'SAT' END;
        SELECT slot_duration_mins INTO v_slot
        FROM public.doctor_availability
        WHERE doctor_id = p_doctor_id AND day_of_week = v_day
        LIMIT 1;
        RETURN QUERY SELECT COALESCE(v_slot, 30)::NUMERIC, 0;
    ELSE
        RETURN QUERY SELECT ROUND(v_avg, 2), v_count;
    END IF;
END;
$$;

-- ─────────────────────────────────────────────
-- 4. CORE: recompute ETAs for a doctor/day
--    Serialized per doctor/day via a transaction advisory lock.
--    Also emits in-app QUEUE_ETA_SHIFT notifications past the threshold.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_queue_etas(p_doctor_id BIGINT, p_date DATE)
RETURNS SETOF public.queue_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    NOTIFY_THRESHOLD_MIN CONSTANT INT := 15;
    TRAVEL_BUFFER_MIN    CONSTANT INT := 20;
    v_pace       NUMERIC;
    v_delay      INT := 0;
    v_lock_key   BIGINT;
    v_active     public.queue_entries;
    v_cursor     TIMESTAMPTZ;
    v_pos        INT;
    v_slot_ts    TIMESTAMPTZ;
    v_eta        TIMESTAMPTZ;
    v_elapsed    NUMERIC;
    r            public.queue_entries;
    v_delta_min  NUMERIC;
    v_pat_name   TEXT;
BEGIN
    -- Serialize concurrent mutations for this doctor/day.
    v_lock_key := hashtextextended(p_doctor_id::TEXT || ':' || p_date::TEXT, 0);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT avg_minutes INTO v_pace FROM public.estimate_pace(p_doctor_id, p_date);
    v_pace := COALESCE(v_pace, 30);

    SELECT manual_delay_minutes INTO v_delay
    FROM public.doctor_pace_stats
    WHERE doctor_id = p_doctor_id AND stat_date = p_date;
    v_delay := COALESCE(v_delay, 0);

    -- Anchor the cursor to when the doctor is next free.
    SELECT * INTO v_active
    FROM public.queue_entries
    WHERE doctor_id = p_doctor_id AND queue_date = p_date AND state = 'IN_CONSULTATION'
    LIMIT 1;

    IF v_active.id IS NOT NULL THEN
        v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_active.consult_started_at)) / 60.0;
        v_cursor := NOW() + (GREATEST(0, v_pace - v_elapsed) || ' minutes')::INTERVAL;
        v_pos := v_active.position;
    ELSE
        SELECT MIN(public.queue_slot_ts(queue_date, scheduled_start_time)) INTO v_slot_ts
        FROM public.queue_entries
        WHERE doctor_id = p_doctor_id AND queue_date = p_date
          AND state IN ('WAITING','CHECKED_IN');
        v_cursor := GREATEST(NOW(), COALESCE(v_slot_ts, NOW())) + (v_delay || ' minutes')::INTERVAL;
        v_pos := 0;
    END IF;

    -- Walk the waiting queue in slot order, projecting each ETA.
    FOR r IN
        SELECT * FROM public.queue_entries
        WHERE doctor_id = p_doctor_id AND queue_date = p_date
          AND state IN ('CHECKED_IN','WAITING')
        ORDER BY scheduled_start_time ASC, id ASC
    LOOP
        v_slot_ts := public.queue_slot_ts(r.queue_date, r.scheduled_start_time);
        v_eta := GREATEST(v_cursor, v_slot_ts);      -- never before the booked slot
        v_pos := v_pos + 1;

        -- Decide whether this move is worth notifying about.
        IF r.last_notified_eta_at IS NOT NULL THEN
            v_delta_min := ABS(EXTRACT(EPOCH FROM (v_eta - r.last_notified_eta_at)) / 60.0);
        ELSE
            v_delta_min := 0;
        END IF;

        UPDATE public.queue_entries
        SET eta_at = v_eta,
            suggested_leave_at = v_eta - (TRAVEL_BUFFER_MIN || ' minutes')::INTERVAL,
            position = v_pos,
            last_notified_eta_at = CASE
                WHEN last_notified_eta_at IS NULL THEN v_eta            -- seed baseline, don't push
                WHEN v_delta_min >= NOTIFY_THRESHOLD_MIN THEN v_eta      -- advance baseline on notify
                ELSE last_notified_eta_at
            END
        WHERE id = r.id;

        -- In-app notification (streams to the patient over Realtime) on a real shift.
        IF r.last_notified_eta_at IS NOT NULL AND v_delta_min >= NOTIFY_THRESHOLD_MIN THEN
            INSERT INTO public.notifications (user_id, title, body, type, reference_id)
            VALUES (
                r.patient_id,
                'Updated arrival time',
                'Your estimated visit time is now '
                    || to_char(v_eta AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM')
                    || '. You are #' || v_pos || ' in the queue. '
                    || 'Suggested leave-by: '
                    || to_char((v_eta - (TRAVEL_BUFFER_MIN || ' minutes')::INTERVAL) AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM')
                    || '.',
                'QUEUE_ETA_SHIFT',
                r.appointment_id
            );
        END IF;

        v_cursor := v_eta + (v_pace || ' minutes')::INTERVAL;
    END LOOP;

    RETURN QUERY
        SELECT * FROM public.queue_entries
        WHERE doctor_id = p_doctor_id AND queue_date = p_date
        ORDER BY
            CASE state WHEN 'IN_CONSULTATION' THEN 0 WHEN 'CHECKED_IN' THEN 1
                       WHEN 'WAITING' THEN 2 ELSE 3 END,
            position ASC, scheduled_start_time ASC, id ASC;
END;
$$;

-- ─────────────────────────────────────────────
-- 5. seed_queue — idempotently project appointments into queue_entries
--    for a doctor/day, then recompute ETAs.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_queue(p_doctor_id BIGINT, p_date DATE)
RETURNS SETOF public.queue_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
    END IF;

    -- Create a queue entry for every active appointment not already queued.
    INSERT INTO public.queue_entries
        (appointment_id, doctor_id, patient_id, queue_date, scheduled_start_time, state)
    SELECT a.id, a.doctor_id, a.patient_id, a.appointment_date, a.slot_start_time, 'WAITING'
    FROM public.appointments a
    WHERE a.doctor_id = p_doctor_id
      AND a.appointment_date = p_date
      AND a.status IN ('PENDING','CONFIRMED')
      AND NOT EXISTS (SELECT 1 FROM public.queue_entries q WHERE q.appointment_id = a.id)
    ON CONFLICT (appointment_id) DO NOTHING;

    -- Ensure a pace-stats row exists.
    INSERT INTO public.doctor_pace_stats (doctor_id, stat_date, rolling_avg_minutes, sample_size)
    SELECT p_doctor_id, p_date, avg_minutes, sample_size FROM public.estimate_pace(p_doctor_id, p_date)
    ON CONFLICT (doctor_id, stat_date) DO NOTHING;

    RETURN QUERY SELECT * FROM public.recompute_queue_etas(p_doctor_id, p_date);
END;
$$;

-- ─────────────────────────────────────────────
-- 6. Rolling-pace update on completion
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_rolling_pace(p_doctor_id BIGINT, p_date DATE)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_avg NUMERIC;
    v_cnt INT;
BEGIN
    SELECT avg_minutes, sample_size INTO v_avg, v_cnt FROM public.estimate_pace(p_doctor_id, p_date);
    INSERT INTO public.doctor_pace_stats (doctor_id, stat_date, rolling_avg_minutes, sample_size)
    VALUES (p_doctor_id, p_date, GREATEST(v_avg, 1), v_cnt)
    ON CONFLICT (doctor_id, stat_date)
    DO UPDATE SET rolling_avg_minutes = GREATEST(EXCLUDED.rolling_avg_minutes, 1),
                  sample_size = EXCLUDED.sample_size,
                  updated_at = NOW();
END;
$$;

-- ─────────────────────────────────────────────
-- 7. advance_queue — doctor advances one entry's lifecycle.
--    Legal transitions:
--      WAITING→CHECKED_IN, WAITING→SKIPPED,
--      CHECKED_IN→IN_CONSULTATION, CHECKED_IN→SKIPPED,
--      IN_CONSULTATION→COMPLETED, SKIPPED→WAITING
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.advance_queue(p_entry_id BIGINT, p_next_state TEXT)
RETURNS SETOF public.queue_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_entry public.queue_entries;
    v_ok    BOOLEAN;
BEGIN
    SELECT * INTO v_entry FROM public.queue_entries WHERE id = p_entry_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Queue entry not found.' USING ERRCODE = 'P0001';
    END IF;

    IF NOT public.caller_owns_doctor(v_entry.doctor_id) THEN
        RAISE EXCEPTION 'Only the treating doctor can update the queue.' USING ERRCODE = '42501';
    END IF;

    v_ok := (v_entry.state, p_next_state) IN (
        ('WAITING','CHECKED_IN'), ('WAITING','SKIPPED'),
        ('CHECKED_IN','IN_CONSULTATION'), ('CHECKED_IN','SKIPPED'),
        ('IN_CONSULTATION','COMPLETED'), ('SKIPPED','WAITING')
    );
    IF NOT v_ok THEN
        RAISE EXCEPTION 'Illegal queue transition % → %.', v_entry.state, p_next_state
            USING ERRCODE = 'P0001';
    END IF;

    -- Serialize with recompute for this doctor/day.
    PERFORM pg_advisory_xact_lock(hashtextextended(v_entry.doctor_id::TEXT || ':' || v_entry.queue_date::TEXT, 0));

    IF p_next_state = 'IN_CONSULTATION' THEN
        IF EXISTS (
            SELECT 1 FROM public.queue_entries
            WHERE doctor_id = v_entry.doctor_id AND queue_date = v_entry.queue_date
              AND state = 'IN_CONSULTATION' AND id <> v_entry.id
        ) THEN
            RAISE EXCEPTION 'Another patient is already in consultation.' USING ERRCODE = 'P0001';
        END IF;
        UPDATE public.queue_entries
        SET state = 'IN_CONSULTATION', consult_started_at = NOW()
        WHERE id = v_entry.id;

    ELSIF p_next_state = 'COMPLETED' THEN
        UPDATE public.queue_entries
        SET state = 'COMPLETED',
            consult_completed_at = NOW(),
            actual_duration_minutes = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(consult_started_at, NOW()))) / 60.0))::INT
        WHERE id = v_entry.id;
        PERFORM public.update_rolling_pace(v_entry.doctor_id, v_entry.queue_date);

    ELSE
        UPDATE public.queue_entries SET state = p_next_state WHERE id = v_entry.id;
    END IF;

    RETURN QUERY SELECT * FROM public.recompute_queue_etas(v_entry.doctor_id, v_entry.queue_date);
END;
$$;

-- ─────────────────────────────────────────────
-- 8. flag_delay — push the rest of the day back by N minutes.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.flag_delay(p_doctor_id BIGINT, p_date DATE, p_delay_minutes INT, p_reason TEXT DEFAULT NULL)
RETURNS SETOF public.queue_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF NOT public.caller_owns_doctor(p_doctor_id) THEN
        RAISE EXCEPTION 'Only the treating doctor can flag a delay.' USING ERRCODE = '42501';
    END IF;
    IF p_delay_minutes IS NULL OR p_delay_minutes <= 0 OR p_delay_minutes > 480 THEN
        RAISE EXCEPTION 'Delay must be between 1 and 480 minutes.' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.doctor_pace_stats (doctor_id, stat_date, manual_delay_minutes)
    VALUES (p_doctor_id, p_date, p_delay_minutes)
    ON CONFLICT (doctor_id, stat_date)
    DO UPDATE SET manual_delay_minutes = public.doctor_pace_stats.manual_delay_minutes + p_delay_minutes,
                  updated_at = NOW();

    RETURN QUERY SELECT * FROM public.recompute_queue_etas(p_doctor_id, p_date);
END;
$$;

-- ─────────────────────────────────────────────
-- 9. Keep the queue in sync when an appointment is cancelled.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_queue_on_appointment_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.status = 'CANCELLED' AND OLD.status IS DISTINCT FROM 'CANCELLED' THEN
        UPDATE public.queue_entries
        SET state = 'SKIPPED'
        WHERE appointment_id = NEW.id AND state IN ('WAITING','CHECKED_IN');
        PERFORM public.recompute_queue_etas(NEW.doctor_id, NEW.appointment_date);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_appointment_queue_sync ON public.appointments;
CREATE TRIGGER on_appointment_queue_sync
    AFTER UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.sync_queue_on_appointment_change();

-- ─────────────────────────────────────────────
-- 10. GRANTS — RPCs callable by signed-in users (they self-authorize).
-- ─────────────────────────────────────────────
DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.seed_queue(BIGINT, DATE) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.advance_queue(BIGINT, TEXT) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.flag_delay(BIGINT, DATE, INT, TEXT) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.recompute_queue_etas(BIGINT, DATE) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.estimate_pace(BIGINT, DATE) FROM PUBLIC';
END $$;

GRANT EXECUTE ON FUNCTION public.seed_queue(BIGINT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_queue(BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flag_delay(BIGINT, DATE, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_queue_etas(BIGINT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estimate_pace(BIGINT, DATE) TO authenticated;

-- ─────────────────────────────────────────────
-- 11. REALTIME — stream queue_entries row changes to clients.
-- ─────────────────────────────────────────────
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_entries;
EXCEPTION
    WHEN duplicate_object THEN NULL;   -- already added
    WHEN undefined_object THEN NULL;   -- publication missing (older projects)
END $$;

-- ═══════════════════════════════════════════════════════════════
-- DONE. Live Queue ETA schema ready. ⏱️
-- ═══════════════════════════════════════════════════════════════
