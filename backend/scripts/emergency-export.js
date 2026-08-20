/**
 * Emergency data export — dumps every table to JSON using the service-role
 * key already sitting in backend/.env. Works even with zero access to the
 * Supabase dashboard/account, because the service-role key talks to the
 * database over the REST API (PostgREST) independently of who's logged in.
 *
 * Usage:
 *   cd backend
 *   node scripts/emergency-export.js
 *
 * Output: backend/backup-<timestamp>/<table>.json (one file per table) plus
 * a summary.json with row counts and any tables that failed/don't exist.
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Every table found across database/schema.sql and database/migrations/*.sql
const TABLES = [
  "academic_years", "activities", "activity_logs", "announcement_attachments",
  "announcement_classes", "announcement_extracurricular_staff", "announcement_teachers",
  "announcements", "attendance", "attendance_history", "branches", "class_subjects",
  "classes", "departments", "drivers", "evaluated_papers", "exam_documents",
  "exam_marks", "exam_schedule", "exams", "extracurricular_achievements",
  "extracurricular_attendance", "extracurricular_batch_students", "extracurricular_batches",
  "extracurricular_events", "extracurricular_practice_work", "extracurricular_schedule_slots",
  "extracurricular_staff", "extracurricular_staff_activities", "fee_payments",
  "fee_structures", "holidays", "homework", "homework_submissions",
  "learning_game_attempts", "learning_game_stats", "learning_game_user_achievements",
  "leave_requests", "login_history", "notification_reads", "notifications",
  "parent_locations", "parents", "permissions", "pickup_points",
  "platform_audit_logs", "push_subscriptions", "registration_requests",
  "role_permissions", "roles", "routes", "school_admin_schools",
  "school_creation_requests", "schools", "student_documents",
  "student_leave_requests", "student_parents", "student_pickup_points",
  "student_profile_change_requests", "student_siblings", "students", "subjects",
  "syllabus", "teacher_attendance", "teacher_documents", "teachers",
  "timetable_change_requests", "timetable_periods", "trip_history",
  "trip_student_status", "trips", "user_roles", "users", "vehicle_locations",
  "vehicle_maintenance_records", "vehicles", "website_knowledge_attempt_answers",
  "website_knowledge_attempts", "website_knowledge_certificates",
  "website_knowledge_notification_log", "website_knowledge_question_set_items",
  "website_knowledge_question_sets", "website_knowledge_questions",
  "website_knowledge_settings",
];

const PAGE_SIZE = 1000;

async function exportTable(table) {
  const rows = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return { table, ok: false, error: error.message, count: 0 };
    }
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { table, ok: true, count: rows.length, rows };
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(__dirname, "..", `backup-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Exporting ${TABLES.length} tables from ${SUPABASE_URL} ...`);
  console.log(`Output: ${outDir}\n`);

  const summary = [];

  for (const table of TABLES) {
    process.stdout.write(`  ${table} ... `);
    const result = await exportTable(table);

    if (!result.ok) {
      console.log(`skip (${result.error})`);
      summary.push({ table, ok: false, error: result.error, count: 0 });
      continue;
    }

    fs.writeFileSync(
      path.join(outDir, `${table}.json`),
      JSON.stringify(result.rows, null, 2),
    );
    console.log(`${result.count} rows`);
    summary.push({ table, ok: true, count: result.count });
  }

  fs.writeFileSync(
    path.join(outDir, "summary.json"),
    JSON.stringify({ exportedAt: new Date().toISOString(), tables: summary }, null, 2),
  );

  const failed = summary.filter((s) => !s.ok);
  const totalRows = summary.reduce((sum, s) => sum + (s.count || 0), 0);

  console.log(`\nDone. ${totalRows} total rows across ${summary.length - failed.length} tables.`);
  if (failed.length) {
    console.log(`${failed.length} table(s) skipped (likely don't exist in this schema — check summary.json):`);
    failed.forEach((f) => console.log(`  - ${f.table}: ${f.error}`));
  }
  console.log(`\nBack up "${outDir}" somewhere safe (it is gitignored by default via backup-*/ — verify before committing anything).`);
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
