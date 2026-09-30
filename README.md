# 📚 Library Loan API

REST API untuk pencatatan peminjaman buku perpustakaan. Dibangun menggunakan **Node.js**, **Express.js**, dan **Supabase (PostgreSQL)**, serta dideploy ke **Vercel**.

> Tugas Responsi — Praktikum Pemrograman Berbasis Platform (PPB) 2026

**🔗 Base URL Produksi:** `https://<nama-project>.vercel.app`
**🔗 Repository:** `https://github.com/<username>/library-loan-api`

---

## 📋 Daftar Isi

1. [Deskripsi & Tujuan Proyek](#1-deskripsi--tujuan-proyek)
2. [Fitur](#2-fitur)
3. [Teknologi](#3-teknologi)
4. [Struktur Data / Schema](#4-struktur-data--schema)
5. [Referensi Endpoint](#5-referensi-endpoint)
6. [Contoh Request & Response](#6-contoh-request--response)
7. [Panduan Instalasi & Menjalankan Lokal](#7-panduan-instalasi--menjalankan-lokal)
8. [Deployment ke Vercel](#8-deployment-ke-vercel)
9. [Struktur Folder](#9-struktur-folder)

---

## 1. Deskripsi & Tujuan Proyek

Perpustakaan yang masih mencatat peminjaman secara manual sulit mengetahui buku mana yang sedang dipinjam, siapa peminjamnya, dan mana yang sudah melewati jatuh tempo. **Library Loan API** menyelesaikan masalah tersebut dengan menyediakan satu sumber data terpusat yang dapat dikonsumsi oleh aplikasi apa pun (web, mobile, atau dashboard admin).

**Tujuan:**

- Menyediakan operasi **CRUD** lengkap untuk transaksi peminjaman buku oleh anggota.
- Menyediakan **filter query** agar petugas dapat menyaring data, misalnya menampilkan seluruh peminjaman yang terlambat (`GET /api/loans?status=Terlambat`).
- Menghitung **status keterlambatan** dan **denda** secara otomatis, sehingga tidak perlu dihitung manual.
- Menjaga konsistensi **stok buku** — stok berkurang saat dipinjam dan bertambah kembali saat dikembalikan.
- Berjalan secara publik melalui deployment serverless di Vercel.

---

## 2. Fitur

| Fitur | Keterangan |
|---|---|
| ✅ CRUD Peminjaman | Create, Read, Update, Delete data peminjaman |
| 🔍 Filter Query | Filter berdasarkan status, anggota, buku, nama, judul, dan rentang tanggal |
| 📄 Pagination & Sorting | Parameter `page`, `limit`, `sort_by`, `order` |
| ⏰ Auto-Overdue | Status otomatis menjadi `Terlambat` jika melewati `due_date` |
| 💰 Hitung Denda Otomatis | Denda = jumlah hari terlambat × `FINE_PER_DAY` |
| 📦 Manajemen Stok | Stok buku otomatis berkurang/bertambah |
| 🛡️ Validasi Input | Validasi ketat dengan Zod, pesan error dalam Bahasa Indonesia |
| 🔗 Data Relasional | Response menyertakan detail anggota dan buku (JOIN) |

---

## 3. Teknologi

| Komponen | Teknologi |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express.js 4 |
| Database | Supabase (PostgreSQL) |
| Validasi | Zod |
| Deployment | Vercel (Serverless Functions) |

---

## 4. Struktur Data / Schema

Database terdiri dari **tiga tabel** yang saling berelasi. Skema lengkapnya tersedia di [`db/schema.sql`](db/schema.sql).

### Relasi Antar Tabel

```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│   members   │          │    loans    │          │    books    │
├─────────────┤          ├─────────────┤          ├─────────────┤
│ id (PK)     │◄────────┤ member_id FK │          │ id (PK)     │
│ member_code │   1 : N  │ book_id   FK ├─────────►│ isbn        │
│ name        │          │ loan_date    │   N : 1  │ title       │
│ email       │          │ due_date     │          │ author      │
│ phone       │          │ return_date  │          │ publisher   │
│ created_at  │          │ status       │          │ year        │
└─────────────┘          │ fine         │          │ stock       │
                         │ notes        │          │ created_at  │
                         │ created_at   │          └─────────────┘
                         │ updated_at   │
                         └─────────────┘
```

### Tabel `loans` (tabel utama)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `uuid` | Primary key, otomatis dibuat |
| `member_id` | `uuid` | **FK** → `members.id`. Wajib |
| `book_id` | `uuid` | **FK** → `books.id`. Wajib |
| `loan_date` | `date` | Tanggal pinjam. Default: hari ini |
| `due_date` | `date` | Jatuh tempo. Default: `loan_date` + `LOAN_PERIOD_DAYS` |
| `return_date` | `date` | Tanggal kembali. `null` jika belum dikembalikan |
| `status` | `text` | `Dipinjam` \| `Dikembalikan` \| `Terlambat` |
| `fine` | `integer` | Denda dalam Rupiah. Default `0` |
| `notes` | `text` | Catatan tambahan (opsional) |
| `created_at` | `timestamptz` | Waktu data dibuat |
| `updated_at` | `timestamptz` | Waktu update terakhir (via trigger) |

**Constraint:** `due_date >= loan_date`, `return_date >= loan_date`, `fine >= 0`, dan `status` dibatasi tiga nilai di atas.

### Tabel `members`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `uuid` | Primary key |
| `member_code` | `text` | Kode anggota, **unik**. Contoh: `A-001` |
| `name` | `text` | Nama lengkap anggota |
| `email` | `text` | Email, **unik** (opsional) |
| `phone` | `text` | Nomor telepon (opsional) |
| `created_at` | `timestamptz` | Waktu pendaftaran |

### Tabel `books`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `uuid` | Primary key |
| `isbn` | `text` | ISBN, **unik** (opsional) |
| `title` | `text` | Judul buku |
| `author` | `text` | Penulis |
| `publisher` | `text` | Penerbit |
| `year` | `integer` | Tahun terbit |
| `stock` | `integer` | Jumlah eksemplar tersedia (`>= 0`) |
| `created_at` | `timestamptz` | Waktu data dibuat |

### Aturan Status

| Status | Kondisi |
|---|---|
| `Dipinjam` | `return_date` kosong dan `due_date` belum lewat |
| `Terlambat` | `return_date` kosong dan `due_date` sudah lewat |
| `Dikembalikan` | `return_date` sudah terisi |

Status `Terlambat` disinkronkan otomatis setiap kali endpoint `GET /api/loans` atau `GET /api/loans/:id` dipanggil.

---

## 5. Referensi Endpoint

### Peminjaman (Loans)

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/loans` | Ambil daftar peminjaman + filter |
| `GET` | `/api/loans/:id` | Ambil detail satu peminjaman |
| `POST` | `/api/loans` | Catat peminjaman baru |
| `PUT` | `/api/loans/:id` | Perbarui data peminjaman |
| `PATCH` | `/api/loans/:id/return` | Proses pengembalian buku |
| `DELETE` | `/api/loans/:id` | Hapus data peminjaman |

### Katalog (pendukung)

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/members` | Daftar anggota (`?search=`) |
| `POST` | `/api/members` | Tambah anggota |
| `GET` | `/api/books` | Daftar buku (`?search=`, `?available=true`) |
| `POST` | `/api/books` | Tambah buku |
| `GET` | `/health` | Cek status server |

### Parameter Filter `GET /api/loans`

| Parameter | Tipe | Contoh | Keterangan |
|---|---|---|---|
| `status` | enum | `Terlambat` | Filter berdasarkan status |
| `member_id` | uuid | `1111...` | Filter per anggota |
| `book_id` | uuid | `aaaa...` | Filter per buku |
| `member_name` | string | `Faris` | Cari berdasarkan nama anggota |
| `book_title` | string | `Clean` | Cari berdasarkan judul buku |
| `from` | date | `2026-09-01` | `loan_date` mulai dari |
| `to` | date | `2026-09-30` | `loan_date` sampai dengan |
| `due_before` | date | `2026-10-01` | Jatuh tempo sebelum tanggal ini |
| `page` | number | `2` | Halaman. Default `1` |
| `limit` | number | `20` | Data per halaman. Default `10`, maks `100` |
| `sort_by` | enum | `due_date` | `loan_date`, `due_date`, `return_date`, `status`, `fine`, `created_at` |
| `order` | enum | `asc` | `asc` atau `desc`. Default `desc` |

Contoh kombinasi:

```
GET /api/loans?status=Terlambat
GET /api/loans?status=Dipinjam&member_name=Faris&sort_by=due_date&order=asc
GET /api/loans?from=2026-09-01&to=2026-09-30&page=1&limit=20
```

### Kode Status HTTP

| Kode | Arti |
|---|---|
| `200` | Berhasil |
| `201` | Data berhasil dibuat |
| `404` | Data atau endpoint tidak ditemukan |
| `409` | Konflik (stok habis / buku sudah dikembalikan) |
| `422` | Validasi input gagal |
| `500` | Kesalahan server |

---

## 6. Contoh Request & Response

Seluruh response mengikuti format konsisten:

```json
{ "success": true, "message": "...", "data": {} }
```

### 6.1 Ambil Daftar Peminjaman dengan Filter

**Request**

```http
GET /api/loans?status=Terlambat&limit=2
```

```bash
curl "https://<nama-project>.vercel.app/api/loans?status=Terlambat&limit=2"
```

**Response — `200 OK`**

```json
{
  "success": true,
  "message": "Daftar peminjaman berhasil diambil",
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 2,
    "total_pages": 1,
    "sort_by": "loan_date",
    "order": "desc",
    "filters": { "status": "Terlambat" }
  },
  "data": [
    {
      "id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
      "member_id": "22222222-2222-2222-2222-222222222222",
      "book_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "loan_date": "2026-09-10",
      "due_date": "2026-09-17",
      "return_date": null,
      "status": "Terlambat",
      "fine": 0,
      "notes": "Belum dikembalikan",
      "created_at": "2026-09-10T02:14:33.120Z",
      "updated_at": "2026-09-30T01:05:11.882Z",
      "member": {
        "id": "22222222-2222-2222-2222-222222222222",
        "member_code": "A-002",
        "name": "Rani Puspitasari",
        "email": "rani@example.com"
      },
      "book": {
        "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "isbn": "9786020332614",
        "title": "Laskar Pelangi",
        "author": "Andrea Hirata",
        "publisher": "Bentang Pustaka"
      }
    }
  ]
}
```

---

### 6.2 Catat Peminjaman Baru

**Request**

```http
POST /api/loans
Content-Type: application/json
```

```json
{
  "member_id": "11111111-1111-1111-1111-111111111111",
  "book_id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
  "loan_date": "2026-09-30",
  "due_date": "2026-10-07",
  "notes": "Peminjaman reguler"
}
```

```bash
curl -X POST "https://<nama-project>.vercel.app/api/loans" \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": "11111111-1111-1111-1111-111111111111",
    "book_id": "cccccccc-cccc-cccc-cccc-cccccccccccc"
  }'
```

> `loan_date`, `due_date`, dan `notes` bersifat opsional. Jika dikosongkan, `loan_date` diisi hari ini dan `due_date` diisi 7 hari setelahnya.

**Response — `201 Created`**

```json
{
  "success": true,
  "message": "Peminjaman berhasil dicatat",
  "data": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "member_id": "11111111-1111-1111-1111-111111111111",
    "book_id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
    "loan_date": "2026-09-30",
    "due_date": "2026-10-07",
    "return_date": null,
    "status": "Dipinjam",
    "fine": 0,
    "notes": "Peminjaman reguler",
    "created_at": "2026-09-30T03:22:10.441Z",
    "updated_at": "2026-09-30T03:22:10.441Z",
    "member": {
      "id": "11111111-1111-1111-1111-111111111111",
      "member_code": "A-001",
      "name": "Muhammad Faris Revansyah",
      "email": "faris@example.com"
    },
    "book": {
      "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
      "isbn": "9780132350884",
      "title": "Clean Code",
      "author": "Robert C. Martin",
      "publisher": "Prentice Hall"
    }
  }
}
```

---

### 6.3 Ambil Detail Peminjaman

**Request**

```http
GET /api/loans/7c9e6679-7425-40de-944b-e07fc1f90ae7
```

**Response — `200 OK`**

```json
{
  "success": true,
  "message": "Detail peminjaman berhasil diambil",
  "data": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "loan_date": "2026-09-30",
    "due_date": "2026-10-07",
    "return_date": null,
    "status": "Dipinjam",
    "fine": 0,
    "member": { "member_code": "A-001", "name": "Muhammad Faris Revansyah" },
    "book": { "title": "Clean Code", "author": "Robert C. Martin" }
  }
}
```

---

### 6.4 Perbarui Data Peminjaman

**Request**

```http
PUT /api/loans/7c9e6679-7425-40de-944b-e07fc1f90ae7
Content-Type: application/json
```

```json
{
  "due_date": "2026-10-14",
  "notes": "Perpanjangan 7 hari"
}
```

**Response — `200 OK`**

```json
{
  "success": true,
  "message": "Data peminjaman berhasil diperbarui",
  "data": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "due_date": "2026-10-14",
    "status": "Dipinjam",
    "fine": 0,
    "notes": "Perpanjangan 7 hari",
    "updated_at": "2026-09-30T04:01:55.703Z"
  }
}
```

---

### 6.5 Proses Pengembalian Buku

**Request**

```http
PATCH /api/loans/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/return
Content-Type: application/json
```

```json
{ "return_date": "2026-09-30" }
```

**Response — `200 OK`**

```json
{
  "success": true,
  "message": "Pengembalian tercatat dengan denda Rp13.000",
  "data": {
    "id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    "due_date": "2026-09-17",
    "return_date": "2026-09-30",
    "status": "Dikembalikan",
    "fine": 13000
  }
}
```

> Denda dihitung otomatis: 13 hari terlambat × Rp1.000 = Rp13.000. Stok buku juga otomatis bertambah 1.

---

### 6.6 Hapus Data Peminjaman

**Request**

```http
DELETE /api/loans/7c9e6679-7425-40de-944b-e07fc1f90ae7
```

**Response — `200 OK`**

```json
{
  "success": true,
  "message": "Data peminjaman berhasil dihapus",
  "data": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "status": "Dipinjam",
    "fine": 0
  }
}
```

---

### 6.7 Contoh Response Error

**Validasi gagal — `422 Unprocessable Entity`**

```json
{
  "success": false,
  "message": "Validasi gagal",
  "errors": [
    { "field": "member_id", "message": "member_id harus berupa UUID yang valid" },
    { "field": "book_id", "message": "Required" }
  ]
}
```

**Data tidak ditemukan — `404 Not Found`**

```json
{
  "success": false,
  "message": "Peminjaman dengan id 7c9e6679-7425-40de-944b-e07fc1f90ae7 tidak ditemukan"
}
```

**Stok habis — `409 Conflict`**

```json
{
  "success": false,
  "message": "Stok buku \"Clean Code\" sedang habis"
}
```

---

## 7. Panduan Instalasi & Menjalankan Lokal

### Prasyarat

- Node.js versi **18 atau lebih baru**
- Akun [Supabase](https://supabase.com) (gratis)
- Git

### Langkah 1 — Clone Repository

```bash
git clone https://github.com/<username>/library-loan-api.git
cd library-loan-api
```

### Langkah 2 — Install Dependencies

```bash
npm install
```

### Langkah 3 — Siapkan Database Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka menu **SQL Editor** → **New query**.
3. Salin seluruh isi file [`db/schema.sql`](db/schema.sql), tempelkan, lalu klik **Run**.
4. Skrip tersebut membuat tabel `members`, `books`, `loans`, index, trigger, dan data contoh.

### Langkah 4 — Konfigurasi Environment Variable

Salin file contoh:

```bash
cp .env.example .env
```

Isi nilainya. `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` diambil dari **Project Settings → API** di dashboard Supabase.

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PORT=3000
LOAN_PERIOD_DAYS=7
FINE_PER_DAY=1000
```

> ⚠️ **Penting:** `service_role key` bersifat rahasia dan hanya boleh dipakai di sisi server. Jangan pernah commit file `.env` ke GitHub — file tersebut sudah masuk `.gitignore`.

### Langkah 5 — Jalankan Server

```bash
npm run dev     # mode development (auto-restart)
npm start       # mode produksi
```

Server berjalan di `http://localhost:3000`.

### Langkah 6 — Uji Coba

```bash
# Cek server
curl http://localhost:3000/health

# Lihat daftar peminjaman
curl http://localhost:3000/api/loans

# Filter yang terlambat
curl "http://localhost:3000/api/loans?status=Terlambat"
```

Bisa juga diuji lewat **Postman**, **Thunder Client**, atau langsung dari browser untuk endpoint `GET`.

---

## 8. Deployment ke Vercel

### Melalui Dashboard (paling mudah)

1. Push repository ke GitHub.
2. Buka [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → pilih repo ini.
3. Biarkan *Framework Preset* pada **Other**. Build command dan output directory dikosongkan saja — konfigurasi sudah diatur lewat `vercel.json`.
4. Buka bagian **Environment Variables**, tambahkan:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | URL project Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
   | `LOAN_PERIOD_DAYS` | `7` |
   | `FINE_PER_DAY` | `1000` |

5. Klik **Deploy**.

### Melalui CLI

```bash
npm i -g vercel
vercel login
vercel          # deploy preview
vercel --prod   # deploy production
```

### Verifikasi Deployment

```bash
curl https://<nama-project>.vercel.app/health
curl "https://<nama-project>.vercel.app/api/loans?status=Terlambat"
```

### Cara Kerja Konfigurasi Vercel

File `api/index.js` mengekspor instance Express sebagai serverless handler, dan `vercel.json` mengarahkan seluruh path ke handler tersebut:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/api" }] }
```

Dengan begitu satu aplikasi Express dapat melayani semua route tanpa perlu membuat file terpisah per endpoint.

---

## 9. Struktur Folder

```
library-loan-api/
├── api/
│   └── index.js                    # Entry point serverless Vercel
├── db/
│   └── schema.sql                  # Skema tabel, index, trigger, seed data
├── src/
│   ├── app.js                      # Konfigurasi Express
│   ├── config/
│   │   └── supabase.js             # Inisialisasi Supabase client
│   ├── controllers/
│   │   ├── loanController.js       # Logika CRUD peminjaman
│   │   └── catalogController.js    # Logika anggota & buku
│   ├── middlewares/
│   │   ├── errorHandler.js         # Penanganan error terpusat
│   │   └── validate.js             # Middleware validasi request body
│   ├── routes/
│   │   ├── loanRoutes.js
│   │   └── catalogRoutes.js
│   ├── utils/
│   │   ├── ApiError.js             # Custom error class
│   │   └── dateHelper.js           # Utilitas tanggal & denda
│   └── validators/
│       └── loanValidator.js        # Schema validasi Zod
├── .env.example
├── .gitignore
├── package.json
├── vercel.json
└── README.md
```

---

## Lisensi

MIT
