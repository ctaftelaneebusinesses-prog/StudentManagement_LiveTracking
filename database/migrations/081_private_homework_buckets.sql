-- ============================================================================
-- Migration: 081_private_homework_buckets
-- Security fix: SEC-20 (public homework storage buckets).
--
-- BEFORE: the 'homework-attachments' and 'homework-submissions' buckets were
-- public=true, so anyone with (or able to guess) an object URL could read
-- students' submitted work and teachers' handouts without authentication.
--
-- AFTER: both buckets are private. Files are referenced by object PATH and the
-- backend mints short-lived signed URLs on read (homework.service.ts), the same
-- pattern used by the already-private student-documents / evaluated-papers /
-- exam-documents buckets. The existing write RLS policies on storage.objects
-- (folder[1] = caller's school for attachments; owner = auth.uid() for
-- submissions) are unchanged and continue to gate uploads.
--
-- Idempotent.
-- ============================================================================

update storage.buckets set public = false where id in ('homework-attachments', 'homework-submissions');
