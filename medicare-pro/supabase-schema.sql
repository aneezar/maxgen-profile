-- ================================================================
-- MediCare Pro — Supabase Schema
-- Single-doctor Gynecology & Obstetrics EMR
-- Run in Supabase → SQL Editor → New Query
-- ================================================================

-- Auto-number sequences
CREATE SEQUENCE IF NOT EXISTS patient_seq  START 1001;
CREATE SEQUENCE IF NOT EXISTS invoice_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS rx_seq       START 1;

-- ── PATIENTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_no       TEXT UNIQUE,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  dob              DATE,
  phone            TEXT,
  phone_alt        TEXT,
  email            TEXT,
  address          TEXT,
  blood_group      TEXT,
  religion         TEXT,
  occupation       TEXT,
  marital_status   TEXT DEFAULT 'Married',
  husband_name     TEXT,
  emergency_name   TEXT,
  emergency_phone  TEXT,
  referral         TEXT,
  gravida          INT DEFAULT 0,
  para             INT DEFAULT 0,
  live_births      INT DEFAULT 0,
  abortions        INT DEFAULT 0,
  notes            TEXT,
  tags             TEXT[],
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── APPOINTMENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id       UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  date             DATE NOT NULL,
  time             TIME NOT NULL,
  duration_mins    INT DEFAULT 15,
  type             TEXT DEFAULT 'consultation',
  status           TEXT DEFAULT 'scheduled',
  notes            TEXT,
  reminder_sent    BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONSULTATIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id       UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  appointment_id   UUID REFERENCES appointments(id) ON DELETE SET NULL,
  date             DATE NOT NULL,
  visit_type       TEXT DEFAULT 'consultation',
  weight           NUMERIC,
  height           NUMERIC,
  bmi              NUMERIC,
  bp               TEXT,
  pulse            INT,
  temperature      NUMERIC,
  spo2             INT,
  chief_complaint  TEXT,
  history          TEXT,
  examination      TEXT,
  diagnosis        TEXT,
  plan             TEXT,
  next_visit       DATE,
  next_visit_notes TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── GYNECOLOGY HISTORY ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gyn_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id          UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL UNIQUE,
  menarche_age        INT,
  cycle_length        INT,
  cycle_duration      INT,
  cycle_regularity    TEXT DEFAULT 'Regular',
  lmp                 DATE,
  menopause           BOOLEAN DEFAULT FALSE,
  menopause_age       INT,
  contraception       TEXT,
  last_pap_smear      DATE,
  pap_smear_result    TEXT,
  gynec_surgeries     JSONB DEFAULT '[]',
  symptoms            JSONB DEFAULT '{}',
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── OBSTETRIC HISTORY ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS obs_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id            UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL UNIQUE,
  gravida               INT DEFAULT 0,
  para                  INT DEFAULT 0,
  live_births           INT DEFAULT 0,
  stillbirths           INT DEFAULT 0,
  abortions             INT DEFAULT 0,
  ectopic               INT DEFAULT 0,
  previous_pregnancies  JSONB DEFAULT '[]',
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── PREGNANCIES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pregnancies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id      UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  pregnancy_no    INT DEFAULT 1,
  lmp             DATE,
  edd             DATE,
  edd_by_us       DATE,
  status          TEXT DEFAULT 'active',
  outcome         TEXT,
  delivery_date   DATE,
  delivery_type   TEXT,
  baby_weight     NUMERIC,
  baby_sex        TEXT,
  complications   TEXT,
  risk_factors    JSONB DEFAULT '{}',
  blood_group     TEXT,
  booking_date    DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ANC VISITS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anc_visits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id      UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  pregnancy_id    UUID REFERENCES pregnancies(id) ON DELETE CASCADE NOT NULL,
  date            DATE NOT NULL,
  weeks           INT,
  days            INT DEFAULT 0,
  weight          NUMERIC,
  bp_systolic     INT,
  bp_diastolic    INT,
  pulse           INT,
  fundal_height   INT,
  fhr             INT,
  lie             TEXT,
  presentation    TEXT DEFAULT 'Cephalic',
  position        TEXT,
  descent         INT,
  engagement      TEXT,
  edema           TEXT DEFAULT 'Nil',
  urine_protein   TEXT DEFAULT 'Nil',
  urine_sugar     TEXT DEFAULT 'Nil',
  hemoglobin      NUMERIC,
  investigations  TEXT,
  remarks         TEXT,
  next_visit      DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ULTRASOUNDS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ultrasounds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id        UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  pregnancy_id      UUID REFERENCES pregnancies(id) ON DELETE SET NULL,
  date              DATE NOT NULL,
  type              TEXT DEFAULT 'obstetric',
  weeks_by_us       INT,
  bpd               NUMERIC,
  fl                NUMERIC,
  ac                NUMERIC,
  hc                NUMERIC,
  efw               NUMERIC,
  afi               NUMERIC,
  placenta          TEXT,
  cervical_length   NUMERIC,
  fhr               INT,
  findings          TEXT,
  impression        TEXT,
  recommendation    TEXT,
  done_by           TEXT,
  image_data        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── LAB RESULTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id    UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  pregnancy_id  UUID REFERENCES pregnancies(id) ON DELETE SET NULL,
  date          DATE NOT NULL,
  lab_name      TEXT,
  category      TEXT DEFAULT 'blood',
  tests         JSONB DEFAULT '[]',
  remarks       TEXT,
  report_data   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── PRESCRIPTIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id        UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  consultation_id   UUID REFERENCES consultations(id) ON DELETE SET NULL,
  prescription_no   TEXT UNIQUE,
  date              DATE NOT NULL,
  diagnosis         TEXT,
  drugs             JSONB DEFAULT '[]',
  advice            TEXT,
  next_visit        DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── INVOICES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id        UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  consultation_id   UUID REFERENCES consultations(id) ON DELETE SET NULL,
  invoice_no        TEXT UNIQUE,
  date              DATE NOT NULL,
  items             JSONB DEFAULT '[]',
  subtotal          NUMERIC DEFAULT 0,
  discount          NUMERIC DEFAULT 0,
  tax               NUMERIC DEFAULT 0,
  total             NUMERIC DEFAULT 0,
  paid              NUMERIC DEFAULT 0,
  balance           NUMERIC DEFAULT 0,
  payment_method    TEXT DEFAULT 'Cash',
  status            TEXT DEFAULT 'pending',
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── DOCUMENTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id    UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL,
  type          TEXT DEFAULT 'other',
  name          TEXT,
  mime_type     TEXT,
  data          TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUDIT LOG ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  timestamp   TIMESTAMPTZ DEFAULT NOW(),
  action      TEXT,
  table_name  TEXT,
  record_id   UUID,
  summary     TEXT
);

-- ── SETTINGS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  profile     JSONB DEFAULT '{}',
  clinic      JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patients_user       ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_name       ON patients(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_patients_phone      ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_appointments_date   ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_consultations_date  ON consultations(date);
CREATE INDEX IF NOT EXISTS idx_anc_pregnancy       ON anc_visits(pregnancy_id);
CREATE INDEX IF NOT EXISTS idx_pregnancies_patient ON pregnancies(patient_id);
CREATE INDEX IF NOT EXISTS idx_rx_patient          ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient    ON invoices(patient_id);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────
ALTER TABLE patients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyn_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE obs_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pregnancies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE anc_visits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ultrasounds    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results    ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings   ENABLE ROW LEVEL SECURITY;

-- Single-user RLS: you only see your own data
DO $$ BEGIN
  EXECUTE (SELECT string_agg(
    'CREATE POLICY IF NOT EXISTS own_data ON ' || t || ' FOR ALL USING (auth.uid() = user_id);',
    E'\n'
  ) FROM unnest(ARRAY[
    'patients','appointments','consultations','gyn_history','obs_history',
    'pregnancies','anc_visits','ultrasounds','lab_results','prescriptions',
    'invoices','documents','audit_log','app_settings'
  ]) AS t);
END $$;

-- ── AUTO PATIENT NUMBER ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION assign_patient_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.patient_no IS NULL THEN
    NEW.patient_no := 'MC-' || LPAD(nextval('patient_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patient_no ON patients;
CREATE TRIGGER trg_patient_no
  BEFORE INSERT ON patients
  FOR EACH ROW EXECUTE FUNCTION assign_patient_no();

-- ── AUTO PRESCRIPTION NUMBER ─────────────────────────────────────
CREATE OR REPLACE FUNCTION assign_rx_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.prescription_no IS NULL THEN
    NEW.prescription_no := 'RX-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(nextval('rx_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rx_no ON prescriptions;
CREATE TRIGGER trg_rx_no
  BEFORE INSERT ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION assign_rx_no();

-- ── AUTO INVOICE NUMBER ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION assign_invoice_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invoice_no IS NULL THEN
    NEW.invoice_no := 'INV-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(nextval('invoice_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_no ON invoices;
CREATE TRIGGER trg_invoice_no
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION assign_invoice_no();

-- ── UPDATED_AT TRIGGER ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER upd_patients      BEFORE UPDATE ON patients      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER upd_appointments  BEFORE UPDATE ON appointments  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER upd_consultations BEFORE UPDATE ON consultations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER upd_gyn_history   BEFORE UPDATE ON gyn_history   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER upd_obs_history   BEFORE UPDATE ON obs_history   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER upd_pregnancies   BEFORE UPDATE ON pregnancies   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER upd_invoices      BEFORE UPDATE ON invoices      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER upd_settings      BEFORE UPDATE ON app_settings  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
