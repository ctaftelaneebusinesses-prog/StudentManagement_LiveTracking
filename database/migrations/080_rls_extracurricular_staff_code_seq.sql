-- ============================================================================
-- Migration: 080_rls_extracurricular_staff_code_seq
-- Security fix: SEC-21 (table without Row Level Security).
--
-- BEFORE: public.extracurricular_staff_code_seq was the only public table with
-- RLS disabled. With Supabase's default table grants, anon/authenticated could
-- read or tamper with the per-school staff-code counters directly via PostgREST.
--
-- AFTER: RLS enabled with NO policies, so no client role (anon/authenticated)
-- can touch it. The application never accesses this table directly — only
-- through public.next_extracurricular_staff_code(uuid), which is SECURITY
-- DEFINER (runs as the owner, bypassing RLS), so provisioning is unaffected.
--
-- Idempotent.
-- ============================================================================

alter table public.extracurricular_staff_code_seq enable row level security;
-- Deliberately no policies: only SECURITY DEFINER functions / the service role
-- may read or modify the sequence table.
