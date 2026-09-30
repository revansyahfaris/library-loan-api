-- =====================================================================
-- Library Loan API — Schema Supabase (PostgreSQL)
-- Jalankan seluruh isi file ini di Supabase Dashboard > SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabel: members (anggota perpustakaan)
-- ---------------------------------------------------------------------
create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  member_code text not null unique,
  name        text not null,
  email       text unique,
  phone       text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Tabel: books (koleksi buku)
-- ---------------------------------------------------------------------
create table if not exists public.books (
  id         uuid primary key default gen_random_uuid(),
  isbn       text unique,
  title      text not null,
  author     text,
  publisher  text,
  year       integer,
  stock      integer not null default 1 check (stock >= 0),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Tabel: loans (transaksi peminjaman) — tabel utama
-- ---------------------------------------------------------------------
create table if not exists public.loans (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members (id) on delete restrict,
  book_id     uuid not null references public.books (id) on delete restrict,
  loan_date   date not null default current_date,
  due_date    date not null,
  return_date date,
  status      text not null default 'Dipinjam'
              check (status in ('Dipinjam', 'Dikembalikan', 'Terlambat')),
  fine        integer not null default 0 check (fine >= 0),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint chk_due_after_loan check (due_date >= loan_date),
  constraint chk_return_after_loan check (return_date is null or return_date >= loan_date)
);

-- ---------------------------------------------------------------------
-- 4. Index untuk mempercepat filter
-- ---------------------------------------------------------------------
create index if not exists idx_loans_status    on public.loans (status);
create index if not exists idx_loans_member    on public.loans (member_id);
create index if not exists idx_loans_book      on public.loans (book_id);
create index if not exists idx_loans_due_date  on public.loans (due_date);
create index if not exists idx_loans_loan_date on public.loans (loan_date desc);

-- ---------------------------------------------------------------------
-- 5. Trigger: updated_at otomatis
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_loans_updated_at on public.loans;
create trigger trg_loans_updated_at
  before update on public.loans
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. Row Level Security
--    RLS diaktifkan tanpa policy publik. API mengakses database memakai
--    SERVICE_ROLE_KEY (server-side only) yang otomatis melewati RLS,
--    sehingga tabel tidak bisa diakses langsung dari browser.
-- ---------------------------------------------------------------------
alter table public.members enable row level security;
alter table public.books   enable row level security;
alter table public.loans   enable row level security;

-- ---------------------------------------------------------------------
-- 7. Seed data (opsional, untuk pengujian)
-- ---------------------------------------------------------------------
insert into public.members (id, member_code, name, email, phone) values
  ('11111111-1111-1111-1111-111111111111', 'A-001', 'Muhammad Faris Revansyah', 'faris@example.com', '081200000001'),
  ('22222222-2222-2222-2222-222222222222', 'A-002', 'Rani Puspitasari', 'rani@example.com', '081200000002'),
  ('33333333-3333-3333-3333-333333333333', 'A-003', 'Bayu Nugroho', 'bayu@example.com', '081200000003')
on conflict (id) do nothing;

insert into public.books (id, isbn, title, author, publisher, year, stock) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '9786020332614', 'Laskar Pelangi', 'Andrea Hirata', 'Bentang Pustaka', 2005, 4),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '9789793062792', 'Bumi Manusia', 'Pramoedya Ananta Toer', 'Lentera Dipantara', 1980, 3),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '9780132350884', 'Clean Code', 'Robert C. Martin', 'Prentice Hall', 2008, 2)
on conflict (id) do nothing;

insert into public.loans (id, member_id, book_id, loan_date, due_date, return_date, status, fine, notes) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   '11111111-1111-1111-1111-111111111111',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   current_date - 3, current_date + 4, null, 'Dipinjam', 0, 'Peminjaman reguler'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
   '22222222-2222-2222-2222-222222222222',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   current_date - 20, current_date - 13, null, 'Terlambat', 0, 'Belum dikembalikan'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff',
   '33333333-3333-3333-3333-333333333333',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   current_date - 15, current_date - 8, current_date - 6, 'Dikembalikan', 2000, 'Terlambat 2 hari')
on conflict (id) do nothing;
