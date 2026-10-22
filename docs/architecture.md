# Arsitektur — Universal Attendance System

Dokumen ini adalah*rancangan* teknis yang menjadi acuan implementasi. Semua keputusan di
bawah ini dicatat beserta alasannya supaya mudah direview dan dikembangkan.

---

## 1. Ringkasan

Aplikasi absensi karyawan berbasis web yang **responsif** (Android, iPhone, tablet, desktop) dan
**installable** sebagai PWA. Dibangun dengan Next.js App Router (Server Components + Server
Actions), Firebase Admin SDK di atas Cloud Firestore, dan Tailwind CSS + komponen bergaya
shadcn/ui.

Prinsip utama:

1. **Server adalah sumber kebenaran untuk waktu.** Waktu check-in/out selalu diambil dari server
   (`Date.now()` di server). Nilai dari klien tidak pernah dipercaya untuk penentuan waktu.
2. **Otorisasi ditegakkan di server, di setiap akses data.** `proxy.ts` hanya untuk redirect UX
   (optimistic check), bukan batas keamanan.
3. **Integritas absensi dijamin database**, bukan sekadar validasi aplikasi — dokumen
   `attendance/{userId}_{YYYY-MM-DD}` membuat check-in ganda mustahil secara struktural, dan
   seluruh mutasi berjalan di dalam `firestore.runTransaction`.
4. **Tidak ada data sensitif di cache PWA.** Service worker hanya melakukan *network-first* tanpa
   penyimpanan respons untuk request yang membutuhkan autentikasi.

---

## 2. Struktur Direktori

```
scripts/
  seed-firestore.ts      Data dummy untuk demo
  bootstrap-admin.ts     Membuat SUPER_ADMIN pertama
  migrate-postgres-to-firestore.ts  Impor data lama (sekali pakai)
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
      health             Diagnosa deployment (kredensial + jangkauan Firestore)
    manifest.ts          Web App Manifest
  components/
    ui/                  Komponen dasar bergaya shadcn/ui
    layout/              AppShell, Sidebar, Topbar, MobileNav
    attendance/          Kartu check-in/out, tabel riwayat
    admin/               Form & tabel admin
  lib/
    domain.ts            Enum & tipe domain (pengganti tipe Prisma)
    firebase-config.ts   Inisialisasi Firebase Admin (dipakai app & script)
    db.ts                Singleton Firestore + mapper dokumen
    realtime.ts          Polling dokumen sinyal untuk SSE
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

## 3. Model Data (Firestore)

| Koleksi | Tujuan |
| --- | --- |
| `users/{userId}` | Akun karyawan/admin. Menyimpan `passwordHash` (bcrypt), `role`, `isActive`. |
| `schedules/{scheduleId}` | Jadwal kerja: jam mulai, jam selesai, toleransi keterlambatan, dan hari kerja yang berlaku. |
| `attendance/{userId}_{YYYY-MM-DD}` | Satu dokumen per karyawan per hari kerja. Sumber kebenaran kehadiran. |
| `locations/{locationId}` | Geo-fence (pusat + radius) untuk validasi lokasi opsional. |
| `settings/organization` | Konfigurasi global (zona waktu, jadwal default, wajib lokasi). |
| `auditLogs/{logId}` | Jejak aktivitas administratif. Append-only. |
| `userEmails/{email}` | Indeks unik email → `userId` (Firestore tidak punya unique index). |
| `employeeCodes/{code}` | Indeks unik kode karyawan → `userId`. |
| `counters/{prefix}` | Penomoran kode karyawan berikutnya. |
| `realtime/attendance` | Dokumen sinyal untuk SSE (tanpa PII). |

### Aturan integritas di level database

- ID dokumen `attendance/{userId}_{workDate}` — **mencegah check-in ganda secara struktural**;
  penulisan kedua gagal dengan `ALREADY_EXISTS`.
- `userEmails/{email}` dan `employeeCodes/{code}` dibuat dalam transaksi/batch yang sama dengan
  `users/{userId}`, sehingga dua akun tidak dapat memakai email atau kode yang sama.
- Penghapusan akun menghapus dokumen `attendance` miliknya di batch yang sama; penghapusan jadwal
  ditolak selama masih ada `users` yang menunjuk ke jadwal tersebut.
- Semua mutasi multi-dokumen memakai `firestore.runTransaction` atau `WriteBatch`.

### Konsep kunci

**`workDate`** adalah tanggal kalender lokal dalam format string `YYYY-MM-DD`, **bukan**
timestamp UTC. String dipilih agar query rentang (`>=`, `<=`) tidak memerlukan composite index,
dan agar "absen hari ini" konsisten definisinya di seluruh aplikasi.

**`lateMinutes`** disimpan di database (bukan dihitung ulang saat baca) karena toleransi
keterlambatan bisa diubah admin di kemudian waktu; menyimpan nilai saat kejadian terjadi menjaga
riwayat tetap konsisten dengan keputusan yang berlaku waktu itu.

### Hari kerja per jadwal

Hari kerja disimpan **di dalam jadwal** (`schedules/{id}.workingDays`), bukan sebagai pengaturan
global: `0 = Minggu` … `6 = Sabtu`. Setiap jadwal punya jam kerjanya sendiri, jadi jam kerja yang
sama bisa berlaku Senin–Jumat untuk satu shift dan Senin–Sabtu untuk shift lain.

Konsekuensinya:

- Check-in hanya boleh dilakukan pada hari yang ada di `workingDays` jadwal karyawan; selain itu
  `AttendanceError` dengan kode `NOT_A_WORKING_DAY`.
- Halaman ringkasan, riwayat absensi, dan dashboard memakai hari kerja dari jadwal yang sama,
  sehingga label "bukan hari kerja" selalu konsisten dengan aturan check-in.
- Jadwal tanpa satu pun hari kerja ditolak saat disimpan (`Pilih minimal satu hari kerja.`),
  karena jadwal seperti itu membuat seluruh karyawannya tidak bisa absen.
- Dokumen lama yang belum punya field ini dibaca sebagai Senin–Jumat, sama dengan asumsi
  aplikasi sebelum fieldnya ada. `npm run db:backfill-working-days` menuliskan nilainya secara
  eksplisit.

Di UI, pemilih hari berada di dialog "Tambah jadwal kerja": tujuh tombol hari (Senin–Minggu) plus
preset cepat "Sen–Jum" dan "Semua hari". Setiap hari terpilih mengirim satu field `workingDays`,
sehingga server menerima tepat hari-hari yang dicentang.

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
   - `attendance/{userId}_{workDate}` dibuat dengan `create()` — gagal dengan `ALREADY_EXISTS`
     bila sudah ada.
   - Status dihitung dari `scheduledStart + lateTolerance` vs `now`.
6. `ALREADY_EXISTS` ditangkap dan diterjemahkan menjadi error domain "Anda sudah check-in hari
   ini".

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
string `YYYY-MM-DD` dan titik waktu sebagai `Timestamp` Firestore, definisi "hari kerja" menjadi
tegas dan independen terhadap zona waktu server.

> **Batasan yang diketahui:** konversi `IANA → offset` memakai `Intl.DateTimeFormat`, bukan offset
> hardcode, sehingga tetap benar pada DST. Seed data dikurasi agar jatuh pada rentang waktu tanpa
> transisi DST.

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
2. **Integrasi — service layer** terhadap **Firestore Emulator**, dijalankan dengan
   `npm run test:integration`. Menguji aturan yang dijamin database: check-in ganda ditolak,
   check-out tanpa check-in ditolak, role diverifikasi di server. Emulator dijalankan otomatis
   oleh `firebase emulators:exec`, sehingga tidak perlu database eksternal.

---

## 11. Deployment

### Database

Cloud Firestore, diakses **hanya dari server** memakai Firebase Admin SDK dengan service account.
Tidak ada Firebase config atau API key yang dikirim ke browser.

Environment yang dibutuhkan:

| Variabel | Isi |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Project ID Firebase. |
| `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` | Service account (cara utama). |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Alternatif: JSON service account dalam satu baris/base64. |
| `FIRESTORE_EMULATOR_HOST` | Hanya untuk test lokal; diisi otomatis oleh `firebase emulators:exec`. |
| `AUTH_SECRET` | Kunci penandatangan cookie sesi (HS256), minimal 32 karakter. |

`firestore.rules` menolak semua akses klien (`allow read, write: if false`). Aturan itu bukan
satu-satunya lapisan: Admin SDK memang mem-bypass rules, dan browser tidak pernah memegang
kredensial Firebase.

#### Vercel: variabel tidak otomatis ikut

`npm run dev`/`npm start` membaca `.env` di repo. Deployment Vercel **tidak** punya file itu —
ia hanya melihat variabel yang diisi di dashboard (Settings → Environment Variables), dan itu
hanya berlaku untuk environment yang dipilih (Production / Preview / Development). Kalau satu
variabel kredensial tidak ikut, semua pembacaan Firestore gagal dan layar login menampilkan
"Terjadi kesalahan" tanpa penjelasan — karena halaman login sendiri tidak pernah menyentuh
database, jadi ia tetap bisa render.

Checklist sebelum deploy:

1. `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — isi untuk **semua**
   environment, lalu redeploy (perubahan env var butuh redeploy baru).
2. `FIREBASE_PRIVATE_KEY` ditulis sebagai satu baris dengan newline escaped (`-----BEGIN PRIVATE
   KEY-----\n...\n-----END PRIVATE KEY-----\n`). Kode menormalkan `\n` otomatis, jadi tidak perlu
   menyalin newline asli ke dashboard.
3. `AUTH_SECRET` diisi dengan nilai yang sama di semua environment. Mengganti `AUTH_SECRET`
   membuat semua sesi lama tidak valid (user harus login ulang).

Verifikasi deployment tanpa membuka log server:

```bash
curl -s https://<domain>/api/health
```

Endpoint itu melaporkan apakah kredensial ada, project id yang dipakai, dan apakah Firestore
bisa dibaca — tanpa membocorkan nilai rahasia. `503` berarti kredensial belum lengkap;
`200` berarti jalur database siap.

Perintah operasional:

```bash
npm run db:check                  # cek koneksi + jumlah dokumen
npm run db:seed                   # data demo (jangan di production)
npm run bootstrap:admin           # SUPER_ADMIN pertama
npm run db:migrate-from-postgres -- --apply   # impor data Supabase lama (sekali pakai)
```

### Realtime

Dashboard admin memperbarui diri sendiri lewat **Server-Sent Events** yang dipicu oleh dokumen
sinyal Firestore `realtime/attendance`.

Dua pendekatan yang sengaja **tidak** dipakai:

| Alternatif | Kenapa tidak |
| --- | --- |
| Event bus in-memory | Tiap Server Action di Vercel bisa jalan di *instance* serverless berbeda dengan heap sendiri. Bus modul akan membuang semua event di production sambil tetap terlihat bekerja di `npm run dev`. |
| Firebase Client SDK / `onSnapshot` di browser | Akan mengirim config Firebase ke browser dan membutuhkan rules baca, sehingga baris absensi bisa dibaca siapa pun yang memegang config tersebut. Admin SDK juga tidak menyediakan `onSnapshot`. |

Yang terjadi sebenarnya: setelah commit, server menulis `{ type, at, id }` ke
`realtime/attendance`. Route `/api/attendance/stream` melakukan polling dokumen itu tiap 10 detik
per koneksi, lalu browser memanggil `router.refresh()`. **Data absensi tidak pernah keluar lewat
kanal ini** — payloadnya hanya sinyal perubahan, dan data asli dimuat ulang lewat Server Component
yang sudah menegakkan otorisasi.

Konsekuensinya batas keamanan di §4 tetap utuh: tidak ada rules yang dilonggarkan, tidak ada
kredensial Firebase yang sampai ke browser, dan `Cache-Control: no-store` masih berlaku karena SSE
bukan cache.

Endpoint ini `ADMIN`-only, memakai cookie sesi yang sama dengan halaman lain. Heartbeat 25 detik
menjaga koneksi tetap hidup sekaligus mendeteksi klien yang pergi; polling dihentikan saat koneksi
ditutup.

---

## 12. Keputusan Teknis & Default yang Diambil

| Topik | Keputusan | Alasan |
| --- | --- | --- |
| Auth library | JWT + `jose` sendiri, bukan NextAuth/Clerk | Nol dependensi eksternal, kontrol penuh atas payload & cookie. Karena Next.js mendokumentasikan pola `jose`, ini tetap idiomatik. |
| Sesi di DB | Tidak (stateless) | Skala sederhana; kompensasi dilakukan dengan pemuatan ulang user tiap request. |
| Zona waktu | IANA string + `Intl.DateTimeFormat` | Menangani DST dengan benar dibanding offset hardcode, tanpa dependensi tambahan. |
| Waktu check-in | `Date.now()` di server | Requirements; klien tidak dipercaya. |
| Pencegahan double check-in | ID dokumen deterministik `attendance/{userId}_{workDate}` | Jaminan integritas tidak bergantung pada logika aplikasi; penulisan kedua gagal `ALREADY_EXISTS`. |
| Database | Firestore + Admin SDK di server | Tidak ada kredensial database di browser; rules menolak semua akses klien. |
| Role hierarchy | Rank numerik | Mempermudah pemeriksaan `hasRole`. |
| Menit keterlambatan | Disimpan saat kejadian | Konsisten dengan aturan yang berlaku waktu itu. |
| Geo-fence | Opsional via setting | Desktop sering tidak dapat mengambil lokasi; memaksa lokasi akan merusak UX. |
| Format CSV | RFC 4180 + BOM UTF-8 | Excel di locale Indonesia menampilkan karakter non-ASCII dengan benar. |