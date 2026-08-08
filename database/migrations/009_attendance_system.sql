-- =====================================================================
-- Phase 9: Complete Attendance System
-- Assumes existing tables: users(id, role, ...), students(id, user_id, class_id, ...),
-- classes(id, name, section, ...). Adjust FK column/table names below if yours differ.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. attendance  — one row per student per day
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
    id              SERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status          VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    remarks         TEXT,
    marked_by       INTEGER NOT NULL REFERENCES users(id),   -- teacher who marked it
    updated_by      INTEGER REFERENCES users(id),            -- last editor
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_attendance_student_date UNIQUE (student_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_date        ON attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date   ON attendance (class_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student      ON attendance (student_id);

-- ---------------------------------------------------------------------
-- 2. attendance_history — audit trail of every change to a record
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_history (
    id              SERIAL PRIMARY KEY,
    attendance_id   INTEGER NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    old_status      VARCHAR(20),
    new_status      VARCHAR(20) NOT NULL,
    change_reason   TEXT,
    changed_by      INTEGER NOT NULL REFERENCES users(id),
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_history_attendance ON attendance_history (attendance_id);
CREATE INDEX IF NOT EXISTS idx_attendance_history_student    ON attendance_history (student_id);

-- ---------------------------------------------------------------------
-- 3. Trigger: auto-log every UPDATE to attendance.status into history
--    (INSERT of the very first mark is NOT logged here — the controller
--    inserts an explicit "created" row instead, see attendance.service.ts)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_log_attendance_change() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO attendance_history (attendance_id, student_id, old_status, new_status, changed_by, change_reason)
        VALUES (NEW.id, NEW.student_id, OLD.status, NEW.status, NEW.updated_by, NEW.remarks);
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attendance_history ON attendance;
CREATE TRIGGER trg_attendance_history
    BEFORE UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION fn_log_attendance_change();

-- ---------------------------------------------------------------------
-- 4. Reporting views
-- ---------------------------------------------------------------------

-- Daily summary per class
CREATE OR REPLACE VIEW vw_attendance_daily_summary AS
SELECT
    a.attendance_date,
    a.class_id,
    c.name AS class_name,
    COUNT(*) FILTER (WHERE a.status = 'present') AS present_count,
    COUNT(*) FILTER (WHERE a.status = 'absent')  AS absent_count,
    COUNT(*) FILTER (WHERE a.status = 'late')    AS late_count,
    COUNT(*) FILTER (WHERE a.status = 'excused') AS excused_count,
    COUNT(*) AS total_marked,
    ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'present') / NULLIF(COUNT(*), 0), 2) AS present_pct
FROM attendance a
JOIN classes c ON c.id = a.class_id
GROUP BY a.attendance_date, a.class_id, c.name;

-- Monthly summary per class
CREATE OR REPLACE VIEW vw_attendance_monthly_summary AS
SELECT
    date_trunc('month', a.attendance_date)::date AS month,
    a.class_id,
    c.name AS class_name,
    COUNT(*) FILTER (WHERE a.status = 'present') AS present_count,
    COUNT(*) FILTER (WHERE a.status = 'absent')  AS absent_count,
    COUNT(*) FILTER (WHERE a.status = 'late')    AS late_count,
    COUNT(*) FILTER (WHERE a.status = 'excused') AS excused_count,
    COUNT(*) AS total_marked,
    ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'present') / NULLIF(COUNT(*), 0), 2) AS present_pct
FROM attendance a
JOIN classes c ON c.id = a.class_id
GROUP BY date_trunc('month', a.attendance_date), a.class_id, c.name;

-- Student-wise summary (all time; filter by date range in queries)
CREATE OR REPLACE VIEW vw_attendance_student_summary AS
SELECT
    a.student_id,
    s.class_id,
    COUNT(*) FILTER (WHERE a.status = 'present') AS present_count,
    COUNT(*) FILTER (WHERE a.status = 'absent')  AS absent_count,
    COUNT(*) FILTER (WHERE a.status = 'late')    AS late_count,
    COUNT(*) FILTER (WHERE a.status = 'excused') AS excused_count,
    COUNT(*) AS total_marked,
    ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'present') / NULLIF(COUNT(*), 0), 2) AS present_pct
FROM attendance a
JOIN students s ON s.id = a.student_id
GROUP BY a.student_id, s.class_id;

-- Class-wise summary (all time; filter by date range in queries)
CREATE OR REPLACE VIEW vw_attendance_class_summary AS
SELECT
    a.class_id,
    c.name AS class_name,
    COUNT(DISTINCT a.student_id) AS student_count,
    COUNT(*) FILTER (WHERE a.status = 'present') AS present_count,
    COUNT(*) FILTER (WHERE a.status = 'absent')  AS absent_count,
    COUNT(*) FILTER (WHERE a.status = 'late')    AS late_count,
    COUNT(*) FILTER (WHERE a.status = 'excused') AS excused_count,
    COUNT(*) AS total_marked,
    ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'present') / NULLIF(COUNT(*), 0), 2) AS present_pct
FROM attendance a
JOIN classes c ON c.id = a.class_id
GROUP BY a.class_id, c.name;

COMMIT;
