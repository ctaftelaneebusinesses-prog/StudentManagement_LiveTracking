-- ============================================================================
-- Phase — Fee Module: receipts.
-- Run AFTER 016_student_management_extras.sql.
--
-- 016_student_management_extras.sql shipped a minimal fee ledger
-- (fee_structures + fee_payments) and explicitly deferred "invoicing,
-- receipts, or payment gateway integration" to a future Fees module. This
-- migration is that follow-up: it adds a sequential, human-readable receipt
-- number to every payment so the Fee Module can render/download a proper
-- receipt for each transaction. Dashboard totals, analytics, search, and
-- filtering are all derived from the existing fee_structures/fee_payments
-- columns in the application layer — no further schema changes are needed.
-- ============================================================================

create sequence if not exists public.fee_receipt_seq;

alter table public.fee_payments
  add column if not exists receipt_no text;

-- Backfill any pre-existing rows (inserted before this column existed) with
-- a sequential receipt number before enforcing NOT NULL below.
update public.fee_payments
  set receipt_no = 'RCPT-' || lpad(nextval('public.fee_receipt_seq')::text, 6, '0')
  where receipt_no is null;

alter table public.fee_payments
  alter column receipt_no set default 'RCPT-' || lpad(nextval('public.fee_receipt_seq')::text, 6, '0'),
  alter column receipt_no set not null;

create unique index if not exists idx_fee_payments_receipt_no on public.fee_payments(receipt_no);
create index if not exists idx_fee_payments_payment_date on public.fee_payments(payment_date);
