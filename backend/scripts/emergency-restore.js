/**
 * Emergency data restore — loads the JSON produced by emergency-export.js
 * into a *new* Supabase project. Run this against the new project only
 * after the schema has been created there (database/schema.sql, then
 * database/rls_policies.sql, then every database/migrations/*.sql in
 * numeric order — see DEPLOYMENT.md §3).
 *
 * Usage:
 *   cd backend
 *   node scripts/emergency-restore.js ./backup-2026-08-20T05-47-45-534Z
 *
 * Point backend/.env at the NEW project (SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY) before running this — it writes to whatever
 * project those credentials point at.
 *
 * Inserts happen in the same order the tables were originally created in
 * (schema.sql / migrations), which is a reasonable approximation of
 * foreign-key dependency order. Uses upsert so it's safe to re-run if it
 * fails partway through. Some rows may still fail on a FK that hasn't been
 * inserted yet — those are reported at the end so you can re-run.
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const backupDir = process.argv[2];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env");
  process.exit(1);
}
if (!backupDir || !fs.existsSync(backupDir)) {
  console.error("Usage: node scripts/emergency-restore.js <path-to-backup-dir>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Same order as emergency-export.js, which follows schema.sql / migration
// creation order (a reasonable FK-dependency ordering).
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

const CHUNK_SIZE = 500;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function restoreTable(table) {
  const file = path.join(backupDir, `${table}.json`);
  if (!fs.existsSync(file)) return { table, ok: true, count: 0, note: "no backup file" };

  const rows = JSON.parse(fs.readFileSync(file, "utf8"));
  if (rows.length === 0) return { table, ok: true, count: 0 };

  let inserted = 0;
  const errors = [];

  for (const batch of chunk(rows, CHUNK_SIZE)) {
    const { error, count } = await supabase
      .from(table)
      .upsert(batch, { onConflict: "id", ignoreDuplicates: false })
      .select("*", { count: "exact", head: true });

    if (error) {
      errors.push(error.message);
    } else {
      inserted += batch.length;
    }
  }

  return { table, ok: errors.length === 0, count: inserted, errors };
}

async function main() {
  console.log(`Restoring into ${SUPABASE_URL} from ${backupDir}\n`);

  const results = [];
  for (const table of TABLES) {
    process.stdout.write(`  ${table} ... `);
    const result = await restoreTable(table);
    results.push(result);
    if (result.count === 0 && !result.errors) {
      console.log(result.note ? result.note : "0 rows");
    } else if (result.ok) {
      console.log(`${result.count} rows`);
    } else {
      console.log(`FAILED: ${result.errors.join("; ")}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nDone. ${failed.length} table(s) had errors.`);
  if (failed.length) {
    console.log("Re-run this script (it upserts, so it's safe to repeat) once any missing");
    console.log("parent tables above have succeeded — most failures here are FK-order issues.");
  }
}

main().catch((err) => {
  console.error("Restore failed:", err);
  process.exit(1);
});
