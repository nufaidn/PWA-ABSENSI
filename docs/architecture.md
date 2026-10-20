# Arsitektur — Universal Attendance System

Dokumen ini adalah*rancangan* teknis yang menjadi acuan implementasi. Semua keputusan di
bawah ini dicatat beserta alasannya supaya mudah direview dan dikembangkan.

---

## 1. Ringkasan

Aplikasi absensi karyawan berbasis web yang **responsif** (Android, iPhone, tablet, desktop) dan
**installable** sebagai PWA. Dibangun dengan Next.js App Router (Server Components + Server
Actions), Prisma ORM di atas PostgreSQL, dan Tailwind CSS + komponen bergaya shadcn/ui.

Prinsip utama:

1. **Server adalah sumber kebenaran untuk waktu.** Waktu check-in/out selalu diambil dari server
   (`Date.now()` di server). Nilai dari klien tidak pernah dipercaya untuk penentuan waktu.
2. **Otorisasi ditegakkan di server, di setiap akses data.** `proxy.ts` hanya untuk redirect UX
   (optimistic check), bukan batas keamanan.
3. **Integritas absensi dijamin database**, bukan sekadar validasi aplikasi — `@@unique([userId,
   workDate])` membuat check-in ganda mustahil secara struktural, dan seluruh mutasi berjalan di
   dalam `prisma.$transaction`.
4. **Tidak ada data sensitif di cache PWA.** Service worker hanya melakukan *network-first* tanpa
   penyimpanan respons untuk request yang membutuhkan autentikasi.

---

## 2. Struktur Direktori

```
prisma/
  schema.prisma          Definisi model database
  seed.ts                Data dummy untuk demo
src/
  app/
    (auth)/login         Halaman login (publik)
    (app)/               Area terproteksi — butuh sesi
      layout.tsx         Shell aplikasi (sidebar / bottom nav)
      dashboard/         Dashboard karyawan
      attendance/        Riwayat absensi + statistik karyawan
      admin/             Area admin & super admin
        employees/       CRUD karyawan
        schedules/       CRUD jadwal kerja
        reports/         Laporan + filter + export CSV
        settings/        Pengaturan global
        audit-log/       Audit log
      profile/           Profil & ganti password
    api/
      attendance/export  Route handler CSV export
    manifest.ts          Web App Manifest
  components/
    ui/                  Komponen dasar bergaya shadcn/ui
    layout/              AppShell, Sidebar, Topbar, MobileNav
    attendance/          Kartu check-in/out, tabel riwayat
    admin/               Form & tabel admin
  lib/
    db.ts                Prisma client singleton
    session.ts           Enkripsi/dekripsi cookie sesi (jose)
    dal/                 Data Access Layer — satu-satunya pintu ke DB
      auth.ts
      attendance.ts
      employees.ts
      schedules.ts
      settings.ts
      reports.ts
      audit.ts
    attendance/          Logika domain (murni, tanpa I/O → mudah diuji)
      time.ts            Perhitungan zona waktu / jam kerja
      geofence.ts        Haversine + validasi radius
      status.ts          Penentuan status kehadiran
    validation/          Skema Zod
    utils.ts             cn() dan helper
  proxy.ts               Redirect berbasis sesi (optimistic)
tests/                   Unit test Vitest
```

---

## 3. Model Database

| Model | Tujuan |
| --- | --- |
| `User` | Akun karyawan/admin. Menyimpan `passwordHash` (bcrypt), `role`, `isActive`. |
| `WorkSchedule` | Jadwal kerja: jam mulai, jam selesai, toleransi keterlambatan. |
| `Attendance` | Satu baris per karyawan per hari kerja. Sumber kebenaran kehadiran. |
| `WorkLocation` | Geo-fence (pusat + radius) untuk validasi lokasi opsional. |
| `Setting` | Konfigurasi global (jam kerja default, keterlambatan, wajib lokasi). |
| `AuditLog` | Jejak aktivitas administratif. Append-only. |

### Aturan integritas di level database

- `Attendance @@unique([userId, workDate])` — **mencegah check-in ganda secara struktural.**
- `User.email` unik (disimpan dalam bentuk ternormalisasi lowercase).
- `User.employeeCode` unik bila tidak null.
- Foreign key `onDelete: Cascade` dari `Attendance` → `User` (data absensi ikut terhapus bila
  akun dihapus), `Restrict` dari `User` → `WorkSchedule` (jadwal tidak boleh terhapus selama masih
  dipakai).

### Konsep kunci

**`workDate`** adalah tanggal kalender lokal (00:00 pada zona waktu aplikasi), **bukan** timestamp
UTC. Ini penting agar "absen hari ini" konsisten definisinya di seluruh aplikasi, dan agar
pemeriksaan hari kerja bisa memakai `@db.Date` yang membandingkan langsung di SQL.

**`lateMinutes`** disimpan di database (bukan dihitung ulang saat baca) karena toleransi
keterlambatan bisa diubah admin di kemudian waktu; menyimpan nilai saat kejadian terjadi menjaga
riwayat tetap konsisten dengan keputusan yang berlaku waktu itu.

---

## 4. Autentikasi & Otorisasi

### Sesi

Sesi stateless berupa **JWT HS256** yang disimpan pada cookie `httpOnly`, mengikuti pola yang
dokumentasikan Next.js. Payload hanya berisi identifier minimal (`sub`, `role`, `sessionId`) —
bukan PII.

- `httpOnly: true` — tidak dapat dibaca JavaScript, sehingga mitigasi XSS tetap efektif.
- `sameSite: 'lax'` —oproteksi CSRF dasar untuk POST lintas situs.
- `secure: process.env.NODE_ENV === 'production'`.
- Rahasia penandatangan dibaca dari `AUTH_SECRET` (wajib ada, divalidasi saat start).

**Keputusan: verifikasi ke database pada setiap request.** JWT hanya membawa identitas; DAL
selalu memuat ulang baris `User` untuk mendapatkan `role` dan `isActive` terkini. Konsekuensinya
menonaktifkan akun atau menurunkan role langsung berlaku tanpa menunggu token kedaluwarsa.

### Lapis pertahanan

| Lapis | Mechanism | tasked |
| --- | --- | --- |
| UX | `src/proxy.ts` | Redirect ke `/login` bila cookie sesi tidak ada. Bukan otentikasi. |
| Otorisasi | `lib/dal/*.ts` | `requireUser()`, `requireRole()` — satu-satunya jalan ke DB. |
| Mutasi | setiap Server Action | Validasi ulang sesi + role + kepemilikan objek. |
| Input | Zod | Semua payload divalidasi sebelum menyentuh DB. |

### Role

| Role | Cakupan |
| --- | --- |
| `EMPLOYEE` | Absen sendiri, lihat riwayat & statistik sendiri. |
| `ADMIN` | Semua hak employee + kelola karyawan, jadwal, laporan, audit log. |
| `SUPER_ADMIN` | Semua hak admin + kelola pengaturan global & role pengguna. |

Hierarki diimplementasikan sebagai urutan numerik (`ROLE_RANK`) sehingga pemeriksaan cukup
`hasRole(user, 'ADMIN')`.

---

## 5. Alur Absensi

### Check-in

1. Klien mengirim `{ latitude?, longitude? }` (koordinat opsional).
2. Server-action memuat jadwal efektif karyawan (jadwal pribadi → default global).
3. Server mengambil `now = new Date()` — **waktu klien diabaikan**.
4. Validasi geo-fence bila `Setting.requireLocationValidation` aktif.
5. Transaksi:
   - `prisma.attendance.create({ workDate })` — gagal dengan `P2002` bila sudah ada.
   - Status dihitung dari `scheduledStart + lateTolerance` vs `now`.
6. `P2002` ditangkap dan diterjemahkan menjadi error domain "Anda sudah check-in hari ini".

### Check-out

1. Muat record absensi hari ini. **Wajib ada** — tanpa check-in tidak ada check-out.
2. Validasi `now > checkInAt` (check-out tidak valid sebelum check-in).
3. Hitung durasi kerja dan perbarui status menjadi `PRESENT`/`LATE` yang final.
4. Seluruhnya dalam satu transaksi.

### Pencegahan check-out tidak valid

- Absensi tanpa `checkInAt` → ditolak.
- `checkOutAt <= checkInAt` → ditolak.
- Check-out kedua pada hari yang sama → ditolak (record sudah memiliki `checkOutAt`).

---

## 6. Zona Waktu

Nilai default: **Asia/Jakarta** (WIB), dikonfigurasi lewat `Setting.timezone`.

Pendekatan yang dipilih: **IANA timezone string + konversi eksplisit ke UTC**, bukan
`timestamp with time zone` untuk "jam kerja".

Alasannya, batas hari kerja adalah konsep kalender lokal. Dengan menyimpan `workDate` sebagai
`@db.Date` dan menyimpan titik waktu sebagai `timestamptz`, definisi "hari kerja" menjadi tegas
dan independen terhadap zona waktu server.

> **Batasan yang diketahui:** konversi `IANA → offset` memakai pustaka `date-fns-tz` agar tetap
> benar pada DST. Seed data dikurasi agar jatuh pada rentang waktu tanpa transisi DST.

---

## 7. Validasi Lokasi (opsional)

- Model `WorkLocation` menyimpan pusat (lat/lng) dan radius dalam meter.
- Konversi Haversine di `lib/attendance/geofence.ts` — fungsi murni, tanpa dependensi browser.
- `Setting.requireLocationValidation` menentukan apakah geo-fence bersifat **wajib** atau
  **pencatatan saja** (record tetap disimpan, ditandai di audit/notes).
- Jika klien tidak mengirim koordinat sementara lokasi diwajibkan, check-in ditolak dengan pesan
  yang jelas.
- Dibuat opsional karena browser desktop sering menolak Geolocation API pada origin non-HTTPS.

---

## 8. PWA

- `src/app/manifest.ts` menghasilkan Web App Manifest (`display: standalone`).
- `public/sw.js` — service worker yang didaftarkan dari klien.
  - **Tidak ada** penyimpanan respons untuk navigasi atau request `/api`.
  - Hanya aset statis yang di-cache *cache-first* (font, ikon, chunk JS immutable).
  - Cache dibersihkan saat aktivasi versi baru.
  - Fungsi push notification ditangani, tetapi langganan di luar cakupan MVP.
- Header keamanan di `next.config.ts`: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, dan `Cache-Control: no-store` pada route yang memuat data absensi.

---

## 9. Testing

Vitest dengan dua kelompok:

1. **Unit — logika domain murni** (`lib/attendance/*`): perhitungan jam kerja, toleransi
   keterlambatan, Haversine, pembentukan status. Tidak butuh database, dijalankan di setiap CI.
2. **Integrasi — service layer** terhadap database PostgreSQL uji, memakai `DATABASE_URL` dari
   `TEST_DATABASE_URL`. Menguji aturan yang dijamin database: check-in ganda ditolak, check-out
   tanpa check-in ditolak, role diverifikasi di server.

---

## 11. Deployment

### Database

PostgreSQL, accessed through Prisma's `@prisma/adapter-pg` driver adapter. Any
PostgreSQL provider works — the choice affects only `DATABASE_URL`.

| | Lokal | Supabase (free) |
| --- | --- | --- |
| Koneksi | `localhost:5432` | session pooler, port 5432 |
| TLS | tidak | `sslmode=require` (`DATABASE_SSL`) |
| Catatan | untuk `npm run db:migrate` | project akan **pause setelah 1 minggu idle**, di-resume manual dari dashboard |

> **Pakai *session* pooler, bukan *transaction* pooler.** Prisma dan koneksi
> `pg` yang dipakai untuk LISTEN/NOTIFY memerlukan sesi yang bisa menahan
> `LISTEN` terbuka; transaction pooler mengembalikan sesi ke pool dan LISTEN
> ikut hilang.

Memindahkan hosting ke luar tidak menyentuh lapisan DAL — tidak ada kode yang
berubah, hanya nilai environment.

### Realtime

Dashboard admin memperbarui diri sendiri lewat **Postgres LISTEN/NOTIFY** yang
diteruskan sebagai **Server-Sent Events**.

Dua pendekatan yang sengaja **tidak** dipakai:

| Alternatif | Kenapa tidak |
| --- | --- |
| Event bus in-memory | Tiap Server Action di Vercel bisa jalan di *instance* serverless berbeda dengan heap sendiri. Bus modul akan membuang semua event di production sambil tetap terlihat bekerja di `npm run dev`. |
| Supabase Realtime / Postgres Changes | Berlangganan dari browser memakai `anon` key, sehingga butuh RLS policy yang membocorkan baris absensi ke siapa pun yang memegang publishable key. |

Yang terjadi sebenarnya: server melakukan `pg_notify` setelah commit, route
`/api/attendance/stream` menerimanya, lalu browser memanggil `router.refresh()`.
**Data absensi tidak pernah keluar lewat kanal ini** — payloadnya hanya
`{ type, at }`, dan data asli dimuat ulang lewat Server Component yang sudah
menegakkan otorisasi.

Konsekuensinya batas keamanan di §4 tetap utuh: tidak ada RLS yang dilonggarkan,
tidak ada kredensial database yang sampai ke browser, dan `Cache-Control:
no-store` masih berlaku karena SSE bukan cache.

Endpoint ini `ADMIN`-only, memakai cookie sesi yang sama dengan halaman lain.
Heartbeat 25 detik menjaga koneksi tetap hidup sekaligus mendeteksi klien yang
pergi, supaya sesi LISTEN tidak bocor di database.

---

## 12. Keputusan Teknis & Default yang Diambil

| Topik | Keputusan | Alasan |
| --- | --- | --- |
| Auth library | JWT + `jose` sendiri, bukan NextAuth/Clerk | Nol dependensi eksternal, kontrol penuh atas payload & cookie. Karena Next.js mendokumentasikan pola `jose`, ini tetap idiomatik. |
| Sesi di DB | Tidak (stateless) | Skala sederhana; kompensasi dilakukan dengan pemuatan ulang user tiap request. |
| Zona waktu | IANA string + `date-fns-tz` | Menangani DST dengan benar dibanding offset hardcode. |
| Waktu check-in | `Date.now()` di server | Requirements; klien tidak dipercaya. |
| Pencegahan double check-in | Unik DB `(userId, workDate)` | Jaminan integritas tidak bergantung pada logika aplikasi. |
| Role hierarchy | Rank numerik | Mempermudah pemeriksaan `hasRole`. |
| Menit keterlambatan | Disimpan saat kejadian | Konsisten dengan aturan yang berlaku waktu itu. |
| Geo-fence | Opsional via setting | Desktop sering tidak dapat mengambil lokasi; memaksa lokasi akan merusak UX. |
| Format CSV | RFC 4180 + BOM UTF-8 | Excel di locale Indonesia menampilkan karakter non-ASCII dengan benar. |