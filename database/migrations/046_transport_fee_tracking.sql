-- Transport fee tracking, one row per student since student_pickup_points
-- already has student_id as its primary key (one assignment per student).
alter table public.student_pickup_points
  add column if not exists fee_amount numeric(10,2),
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('paid', 'unpaid', 'partial')),
  add column if not exists fee_due_date date,
  add column if not exists fee_paid_date date,
  add column if not exists fee_updated_by uuid references public.users(id) on delete set null,
  add column if not exists fee_updated_at timestamptz;
