-- ═══════════════════════════════════════════════════════════════
-- 034 — REJECT PAST TIME SLOTS ON THE BOOKING DAY
-- ───────────────────────────────────────────────────────────────
-- Migration 017 only rejected past *dates* (p_date < CURRENT_DATE). A slot
-- earlier today (e.g. a 09:00 morning slot booked at 21:00) still passed.
--
-- This re-creates both booking RPCs so that when the requested date is TODAY,
-- any slot whose start time has already passed is rejected.
--
-- Timezone: slots are defined in India Standard Time. Supabase Postgres runs
-- in UTC, so we evaluate "now" as (now() AT TIME ZONE 'Asia/Kolkata') and
-- compare its date/time components against the requested slot.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. book_appointment (strict one-per-slot path — used by the app)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.book_appointment(
    p_doctor_id   BIGINT,
    p_date        DATE,
    p_start_time  TIME,
    p_reason      TEXT DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
AS $$
DECLARE
    v_patient_id   UUID := auth.uid();
    v_duration     INT;
    v_end_time     TIME;
    v_day          TEXT;
    v_is_active    BOOLEAN;
    v_now_ist      TIMESTAMP := (now() AT TIME ZONE 'Asia/Kolkata');
    v_new_row      public.appointments;
BEGIN
    -- Must be authenticated
    IF v_patient_id IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to book an appointment.'
            USING ERRCODE = '28000';
    END IF;

    -- No past dates
    IF p_date < v_now_ist::date THEN
        RAISE EXCEPTION 'Cannot book appointments in the past.'
            USING ERRCODE = 'P0001';
    END IF;

    -- No past time slots on today's date
    IF p_date = v_now_ist::date AND p_start_time <= v_now_ist::time THEN
        RAISE EXCEPTION 'This time slot has already passed. Please pick a later slot.'
            USING ERRCODE = 'P0001';
    END IF;

    -- Doctor must exist and be active
    SELECT is_active INTO v_is_active
    FROM public.doctors WHERE id = p_doctor_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Doctor not found.' USING ERRCODE = 'P0001';
    END IF;
    IF v_is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'This doctor is currently unavailable.'
            USING ERRCODE = 'P0001';
    END IF;

    -- Derive slot duration from the doctor's availability for that weekday
    v_day := CASE EXTRACT(DOW FROM p_date)::INT
        WHEN 0 THEN 'SUN' WHEN 1 THEN 'MON' WHEN 2 THEN 'TUE'
        WHEN 3 THEN 'WED' WHEN 4 THEN 'THU' WHEN 5 THEN 'FRI'
        WHEN 6 THEN 'SAT' END;

    SELECT slot_duration_mins INTO v_duration
    FROM public.doctor_availability
    WHERE doctor_id = p_doctor_id AND day_of_week = v_day
    LIMIT 1;

    v_duration := COALESCE(v_duration, 30);
    v_end_time := p_start_time + (v_duration || ' minutes')::INTERVAL;

    -- ── The atomic part ──
    -- The unique index makes this INSERT the single source of truth.
    BEGIN
        INSERT INTO public.appointments (
            patient_id, doctor_id, appointment_date,
            slot_start_time, slot_end_time, reason, status
        )
        VALUES (
            v_patient_id, p_doctor_id, p_date,
            p_start_time, v_end_time, NULLIF(p_reason, ''), 'PENDING'
        )
        RETURNING * INTO v_new_row;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'This time slot was just booked by someone else. Please pick another slot.'
                USING ERRCODE = 'P0002';
    END;

    RETURN v_new_row;
END;
$$;

REVOKE ALL ON FUNCTION public.book_appointment(BIGINT, DATE, TIME, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_appointment(BIGINT, DATE, TIME, TEXT) TO authenticated;

-- ─────────────────────────────────────────────
-- 2. book_appointment_with_capacity (multi-seat path)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.book_appointment_with_capacity(
    p_doctor_id   BIGINT,
    p_date        DATE,
    p_start_time  TIME,
    p_reason      TEXT DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
AS $$
DECLARE
    v_patient_id  UUID := auth.uid();
    v_capacity    INT;
    v_taken       INT;
    v_duration    INT;
    v_end_time    TIME;
    v_day         TEXT;
    v_lock_key    BIGINT;
    v_now_ist     TIMESTAMP := (now() AT TIME ZONE 'Asia/Kolkata');
    v_new_row     public.appointments;
BEGIN
    IF v_patient_id IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to book an appointment.' USING ERRCODE = '28000';
    END IF;
    IF p_date < v_now_ist::date THEN
        RAISE EXCEPTION 'Cannot book appointments in the past.' USING ERRCODE = 'P0001';
    END IF;
    IF p_date = v_now_ist::date AND p_start_time <= v_now_ist::time THEN
        RAISE EXCEPTION 'This time slot has already passed. Please pick a later slot.' USING ERRCODE = 'P0001';
    END IF;

    v_day := CASE EXTRACT(DOW FROM p_date)::INT
        WHEN 0 THEN 'SUN' WHEN 1 THEN 'MON' WHEN 2 THEN 'TUE'
        WHEN 3 THEN 'WED' WHEN 4 THEN 'THU' WHEN 5 THEN 'FRI'
        WHEN 6 THEN 'SAT' END;

    SELECT slot_duration_mins, slot_capacity
      INTO v_duration, v_capacity
    FROM public.doctor_availability
    WHERE doctor_id = p_doctor_id AND day_of_week = v_day
    LIMIT 1;

    v_duration := COALESCE(v_duration, 30);
    v_capacity := COALESCE(v_capacity, 1);
    v_end_time := p_start_time + (v_duration || ' minutes')::INTERVAL;

    -- Serialize concurrent callers for THIS exact slot only.
    v_lock_key := hashtextextended(
        p_doctor_id::TEXT || ':' || p_date::TEXT || ':' || p_start_time::TEXT, 0);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT COUNT(*) INTO v_taken
    FROM public.appointments
    WHERE doctor_id = p_doctor_id
      AND appointment_date = p_date
      AND slot_start_time = p_start_time
      AND status IN ('PENDING', 'CONFIRMED');

    IF v_taken >= v_capacity THEN
        RAISE EXCEPTION 'This slot is full. Please choose another time.' USING ERRCODE = 'P0003';
    END IF;

    INSERT INTO public.appointments (
        patient_id, doctor_id, appointment_date,
        slot_start_time, slot_end_time, reason, status
    )
    VALUES (
        v_patient_id, p_doctor_id, p_date,
        p_start_time, v_end_time, NULLIF(p_reason, ''), 'PENDING'
    )
    RETURNING * INTO v_new_row;

    RETURN v_new_row;
END;
$$;

REVOKE ALL ON FUNCTION public.book_appointment_with_capacity(BIGINT, DATE, TIME, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_appointment_with_capacity(BIGINT, DATE, TIME, TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- DONE. Past time slots on the current day are now rejected server-side. ⏰
-- ═══════════════════════════════════════════════════════════════
