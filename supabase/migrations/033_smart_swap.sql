-- ═══════════════════════════════════════════════════════════════
-- 033 — PEER-TO-PEER "SMART SWAP" SLOT EXCHANGE
--
-- Patients no-show / hold slots they don't urgently need while others wait.
-- Smart Swap is an ANONYMOUS slot exchange: a patient offers to give up their
-- (earlier) slot; another patient who holds a LATER slot with the same doctor
-- accepts and moves earlier. The giver moves to the later slot and earns a
-- co-pay discount (the hospital's incentive to keep the schedule optimized).
--
-- Mechanic: instead of moving slot times (which would fight the active-slot
-- unique index), we ATOMICALLY SWAP the two appointments' patient_id (+ reason).
-- Slots stay put; the people holding them exchange. The giver's appointment
-- gets a swap_discount_percent that request_appointment_payment applies.
--
-- Anonymity: the offers table is readable only by its owner; everyone else
-- discovers eligible offers through list_swap_offers(), which returns doctor /
-- time / discount but NEVER the offerer's identity.
--
-- Idempotent / safe to re-run. Depends on: 001, 013, 018, 022.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 0. Notification types + discount column
-- ─────────────────────────────────────────────
ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check CHECK (type IN (
        'APPOINTMENT_BOOKED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_CANCELLED',
        'REMINDER_24H', 'REMINDER_1H', 'APPOINTMENT_COMPLETED', 'SYSTEM',
        'SLOT_AVAILABLE', 'QUEUE_ETA_SHIFT', 'SWAP_MATCHED'
    ));

-- The reward the giver earns for moving to a later slot (percent off co-pay).
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS swap_discount_percent INT NOT NULL DEFAULT 0
    CHECK (swap_discount_percent BETWEEN 0 AND 100);

-- ─────────────────────────────────────────────
-- 1. OFFERS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.slot_swap_offers (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    appointment_id       BIGINT NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    offered_by           UUID   NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    doctor_id            BIGINT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    offer_date           DATE   NOT NULL,      -- denormalized from the appointment
    offer_slot_start     TIME   NOT NULL,
    discount_percent     INT    NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
    note                 TEXT,
    status               TEXT   NOT NULL DEFAULT 'OPEN'
                            CHECK (status IN ('OPEN','COMPLETED','CANCELLED','EXPIRED')),
    matched_appointment_id BIGINT REFERENCES public.appointments(id) ON DELETE SET NULL,
    matched_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.slot_swap_offers IS
    'Anonymous peer-to-peer slot swap offers. Owner gives up an earlier slot; a taker with a later slot accepts.';

-- At most one OPEN offer per appointment.
CREATE UNIQUE INDEX IF NOT EXISTS uq_swap_open_per_appt
    ON public.slot_swap_offers(appointment_id) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_swap_doctor_open
    ON public.slot_swap_offers(doctor_id, offer_date, status);
CREATE INDEX IF NOT EXISTS idx_swap_offered_by ON public.slot_swap_offers(offered_by);

DROP TRIGGER IF EXISTS set_swap_offers_updated_at ON public.slot_swap_offers;
CREATE TRIGGER set_swap_offers_updated_at
    BEFORE UPDATE ON public.slot_swap_offers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─────────────────────────────────────────────
-- 2. RLS — the owner sees their own offers; everyone else uses the
--    anonymized list_swap_offers() RPC. (No blanket public SELECT so the
--    exchange stays anonymous.)
-- ─────────────────────────────────────────────
ALTER TABLE public.slot_swap_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "swap_select_own" ON public.slot_swap_offers;
CREATE POLICY "swap_select_own" ON public.slot_swap_offers
    FOR SELECT USING (offered_by = auth.uid());

DROP POLICY IF EXISTS "swap_admin_all" ON public.slot_swap_offers;
CREATE POLICY "swap_admin_all" ON public.slot_swap_offers
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- Writes go through the SECURITY DEFINER RPCs below.

-- ─────────────────────────────────────────────
-- 3. create_swap_offer — owner offers up an active, future, unpaid slot.
--    The discount is a SERVER-SET policy value (patients can't pick their own).
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_swap_offer(p_appointment_id BIGINT, p_note TEXT DEFAULT NULL)
RETURNS public.slot_swap_offers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    SWAP_DISCOUNT_PERCENT CONSTANT INT := 10;  -- hospital incentive policy
    v_apt   public.appointments;
    v_offer public.slot_swap_offers;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
    END IF;

    SELECT * INTO v_apt FROM public.appointments WHERE id = p_appointment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment not found.' USING ERRCODE = 'P0001';
    END IF;
    IF v_apt.patient_id <> auth.uid() THEN
        RAISE EXCEPTION 'You can only offer your own appointment.' USING ERRCODE = '42501';
    END IF;
    IF v_apt.status NOT IN ('PENDING','CONFIRMED') THEN
        RAISE EXCEPTION 'Only active appointments can be offered for swap.' USING ERRCODE = 'P0001';
    END IF;
    IF v_apt.appointment_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'This appointment is in the past.' USING ERRCODE = 'P0001';
    END IF;
    -- Don't allow swapping something already paid for (keeps payments consistent).
    IF EXISTS (SELECT 1 FROM public.payments WHERE appointment_id = p_appointment_id AND status = 'PAID') THEN
        RAISE EXCEPTION 'This appointment is already paid and cannot be swapped.' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.slot_swap_offers
        (appointment_id, offered_by, doctor_id, offer_date, offer_slot_start, discount_percent, note, status)
    VALUES
        (p_appointment_id, auth.uid(), v_apt.doctor_id, v_apt.appointment_date, v_apt.slot_start_time,
         SWAP_DISCOUNT_PERCENT, NULLIF(btrim(p_note), ''), 'OPEN')
    ON CONFLICT (appointment_id) WHERE status = 'OPEN'
        DO UPDATE SET note = EXCLUDED.note, updated_at = NOW()
    RETURNING * INTO v_offer;

    RETURN v_offer;
END;
$$;

-- ─────────────────────────────────────────────
-- 4. cancel_swap_offer — owner withdraws an OPEN offer.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_swap_offer(p_offer_id BIGINT)
RETURNS public.slot_swap_offers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_offer public.slot_swap_offers;
BEGIN
    SELECT * INTO v_offer FROM public.slot_swap_offers WHERE id = p_offer_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Offer not found.' USING ERRCODE = 'P0001';
    END IF;
    IF v_offer.offered_by <> auth.uid() THEN
        RAISE EXCEPTION 'You can only cancel your own offer.' USING ERRCODE = '42501';
    END IF;
    IF v_offer.status <> 'OPEN' THEN
        RETURN v_offer;
    END IF;

    UPDATE public.slot_swap_offers SET status = 'CANCELLED' WHERE id = p_offer_id
    RETURNING * INTO v_offer;
    RETURN v_offer;
END;
$$;

-- ─────────────────────────────────────────────
-- 5. list_swap_offers — ANONYMIZED, eligibility-filtered discovery.
--    Returns OPEN offers for doctors where the caller holds a LATER active
--    appointment they could give up, plus that suggested "give-up" appointment.
--    Never exposes the offerer's identity.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_swap_offers()
RETURNS TABLE (
    offer_id             BIGINT,
    doctor_id            BIGINT,
    doctor_name          TEXT,
    specialization       TEXT,
    offer_date           DATE,
    offer_slot_start     TIME,
    discount_percent     INT,
    note                 TEXT,
    my_appointment_id    BIGINT,
    my_appointment_date  DATE,
    my_slot_start        TIME
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT DISTINCT ON (o.id)
        o.id, o.doctor_id, pr.name, d.specialization,
        o.offer_date, o.offer_slot_start, o.discount_percent, o.note,
        mine.id, mine.appointment_date, mine.slot_start_time
    FROM public.slot_swap_offers o
    JOIN public.doctors d  ON d.id = o.doctor_id
    JOIN public.profiles pr ON pr.id = d.user_id
    JOIN public.appointments mine
        ON mine.doctor_id = o.doctor_id
       AND mine.patient_id = auth.uid()
       AND mine.status IN ('PENDING','CONFIRMED')
       -- caller's appointment must be LATER than the offered (earlier) slot
       AND (mine.appointment_date, mine.slot_start_time) > (o.offer_date, o.offer_slot_start)
       -- and not itself already paid
       AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.appointment_id = mine.id AND p.status = 'PAID')
    WHERE o.status = 'OPEN'
      AND o.offered_by <> auth.uid()
      AND o.offer_date >= CURRENT_DATE
    ORDER BY o.id, mine.appointment_date ASC, mine.slot_start_time ASC;
$$;

-- ─────────────────────────────────────────────
-- 6. accept_swap_offer — the atomic exchange.
--    Swaps patient_id (+ reason) between the offered (earlier) appointment and
--    the caller's chosen LATER appointment. The giver (offerer) ends up on the
--    later slot WITH the co-pay discount. Fully serialized per doctor.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_swap_offer(p_offer_id BIGINT, p_taker_appointment_id BIGINT)
RETURNS public.slot_swap_offers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_uid      UUID := auth.uid();
    v_offer    public.slot_swap_offers;
    v_early    public.appointments;   -- offerer's earlier slot (A)
    v_late     public.appointments;   -- taker's later slot (B)
    v_doc_name TEXT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
    END IF;

    SELECT * INTO v_offer FROM public.slot_swap_offers WHERE id = p_offer_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Offer not found.' USING ERRCODE = 'P0001';
    END IF;

    -- Serialize all swaps/queue changes for this doctor.
    PERFORM pg_advisory_xact_lock(hashtextextended('swap:' || v_offer.doctor_id::TEXT, 0));

    IF v_offer.status <> 'OPEN' THEN
        RAISE EXCEPTION 'This offer is no longer available.' USING ERRCODE = 'P0002';
    END IF;
    IF v_offer.offered_by = v_uid THEN
        RAISE EXCEPTION 'You cannot accept your own offer.' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_early FROM public.appointments WHERE id = v_offer.appointment_id;
    SELECT * INTO v_late  FROM public.appointments WHERE id = p_taker_appointment_id;

    IF v_early.id IS NULL OR v_late.id IS NULL THEN
        RAISE EXCEPTION 'One of the appointments no longer exists.' USING ERRCODE = 'P0001';
    END IF;
    IF v_late.patient_id <> v_uid THEN
        RAISE EXCEPTION 'You can only swap using your own appointment.' USING ERRCODE = '42501';
    END IF;
    IF v_early.patient_id <> v_offer.offered_by THEN
        RAISE EXCEPTION 'The offered slot changed hands. Please refresh.' USING ERRCODE = 'P0002';
    END IF;
    IF v_early.doctor_id <> v_late.doctor_id THEN
        RAISE EXCEPTION 'Both appointments must be with the same doctor.' USING ERRCODE = 'P0001';
    END IF;
    IF v_early.status NOT IN ('PENDING','CONFIRMED') OR v_late.status NOT IN ('PENDING','CONFIRMED') THEN
        RAISE EXCEPTION 'Both appointments must be active.' USING ERRCODE = 'P0001';
    END IF;
    -- Taker must genuinely be moving EARLIER.
    IF (v_late.appointment_date, v_late.slot_start_time) <= (v_early.appointment_date, v_early.slot_start_time) THEN
        RAISE EXCEPTION 'Your appointment is not later than the offered slot.' USING ERRCODE = 'P0001';
    END IF;
    -- Neither side may be already paid.
    IF EXISTS (SELECT 1 FROM public.payments WHERE appointment_id IN (v_early.id, v_late.id) AND status = 'PAID') THEN
        RAISE EXCEPTION 'One of the appointments is already paid.' USING ERRCODE = 'P0001';
    END IF;

    -- ── The swap: exchange who holds each slot (patient_id + reason). ──
    UPDATE public.appointments
       SET patient_id = v_late.patient_id, reason = v_late.reason
     WHERE id = v_early.id;                    -- earlier slot → taker

    UPDATE public.appointments
       SET patient_id = v_early.patient_id, reason = v_early.reason,
           swap_discount_percent = v_offer.discount_percent
     WHERE id = v_late.id;                     -- later slot → offerer (+ discount)

    UPDATE public.slot_swap_offers
       SET status = 'COMPLETED', matched_appointment_id = v_late.id, matched_at = NOW()
     WHERE id = p_offer_id
    RETURNING * INTO v_offer;

    -- Any other OPEN offers on these two appointments are now void.
    UPDATE public.slot_swap_offers SET status = 'EXPIRED'
     WHERE status = 'OPEN' AND appointment_id IN (v_early.id, v_late.id) AND id <> p_offer_id;

    -- ── Notify both parties ──
    SELECT pr.name INTO v_doc_name
    FROM public.doctors d JOIN public.profiles pr ON pr.id = d.user_id
    WHERE d.id = v_offer.doctor_id;

    -- Giver (offerer) → moved later, earns discount.
    INSERT INTO public.notifications (user_id, title, body, type, reference_id)
    VALUES (
        v_offer.offered_by,
        'Slot swap complete',
        'Your slot was swapped. You are now booked with Dr. ' || COALESCE(v_doc_name, 'your doctor')
            || ' on ' || to_char(v_late.appointment_date, 'Mon DD') || ' at ' || to_char(v_late.slot_start_time, 'HH12:MI AM')
            || '. You earned ' || v_offer.discount_percent || '% off your co-pay for helping out.',
        'SWAP_MATCHED',
        v_late.id
    );

    -- Taker → moved earlier.
    INSERT INTO public.notifications (user_id, title, body, type, reference_id)
    VALUES (
        v_uid,
        'You moved to an earlier slot',
        'Swap successful! You are now booked with Dr. ' || COALESCE(v_doc_name, 'your doctor')
            || ' on ' || to_char(v_early.appointment_date, 'Mon DD') || ' at ' || to_char(v_early.slot_start_time, 'HH12:MI AM') || '.',
        'SWAP_MATCHED',
        v_early.id
    );

    RETURN v_offer;
END;
$$;

-- ─────────────────────────────────────────────
-- 7. Apply the swap discount when the doctor requests payment.
--    Re-creates request_appointment_payment (from 022) to reduce the co-pay by
--    the appointment's swap_discount_percent. Additive: default 0 → no change.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_appointment_payment(
    p_appointment_id BIGINT,
    p_amount_paise   BIGINT
)
RETURNS public.payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_apt      public.appointments;
    v_doctor   BIGINT;
    v_payment  public.payments;
    v_discount INT;
    v_amount   BIGINT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
    END IF;
    IF p_amount_paise < 100 THEN
        RAISE EXCEPTION 'Amount must be at least ₹1 (100 paise).' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_apt FROM public.appointments WHERE id = p_appointment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment not found.' USING ERRCODE = 'P0001';
    END IF;

    SELECT id INTO v_doctor FROM public.doctors WHERE id = v_apt.doctor_id AND user_id = auth.uid();
    IF v_doctor IS NULL THEN
        RAISE EXCEPTION 'Only the assigned doctor can request payment.' USING ERRCODE = '42501';
    END IF;
    IF v_apt.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Cannot request payment for a cancelled appointment.' USING ERRCODE = 'P0001';
    END IF;

    v_discount := COALESCE(v_apt.swap_discount_percent, 0);
    v_amount := GREATEST(100, ROUND(p_amount_paise * (100 - v_discount) / 100.0))::BIGINT;

    INSERT INTO public.payments (appointment_id, patient_id, doctor_id, amount_paise, status)
    VALUES (p_appointment_id, v_apt.patient_id, v_apt.doctor_id, v_amount, 'PENDING')
    ON CONFLICT (appointment_id) DO UPDATE
        SET amount_paise = EXCLUDED.amount_paise,
            patient_id = EXCLUDED.patient_id,   -- keep in sync if the slot was swapped
            status = CASE WHEN public.payments.status = 'PAID' THEN 'PAID' ELSE 'PENDING' END,
            updated_at = NOW()
    RETURNING * INTO v_payment;

    RETURN v_payment;
END;
$$;

-- ─────────────────────────────────────────────
-- 8. GRANTS
-- ─────────────────────────────────────────────
DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.create_swap_offer(BIGINT, TEXT) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.cancel_swap_offer(BIGINT) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.list_swap_offers() FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.accept_swap_offer(BIGINT, BIGINT) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.request_appointment_payment(BIGINT, BIGINT) FROM PUBLIC';
END $$;

GRANT EXECUTE ON FUNCTION public.create_swap_offer(BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_swap_offer(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_swap_offers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_swap_offer(BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_appointment_payment(BIGINT, BIGINT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- DONE. Smart Swap slot exchange ready. 🔁
-- ═══════════════════════════════════════════════════════════════
