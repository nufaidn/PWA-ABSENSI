# Universal Attendance System

Aplikasi absensi karyawan responsif (PWA) berbasis **Next.js 16** dan **Firebase
Firestore**. Server memegang kendali penuh atas waktu absensi, otorisasi, dan
akses data; browser tidak pernah memegang kredensial database.

## Fitur

- Check-in / check-out dengan waktu dari server, toleransi keterlambatan, dan
  validasi geo-fence opsional.
- Dashboard karyawan, riwayat absensi, dan statistik pribadi.
- Area admin: karyawan, jadwal, lokasi, laporan + export CSV, audit log.
- `ADMIN` dan `SUPER_ADMIN` dikecualikan dari absensi dan tidak melihat menu
  absensi.
- Sesi JWT `httpOnly` + bcrypt; role selalu dibaca ulang dari Firestore.
- Realtime dashboard admin lewat SSE yang dipicu dokumen
  `realtime/attendance`.

## Kebutuhan

- Node.js 22+
- Project Firebase dengan Cloud Firestore aktif
- Service account Firebase (Project settings → Service accounts) dengan role
  `roles/datastore.user`
- Untuk integration test: Firebase CLI dan Java (Firestore Emulator)

> **npm, bukan CDN.** Aplikasi memakai **Firebase Admin SDK** (`firebase-admin`)
> yang di-install lewat npm dan hanya berjalan di server. Client SDK (`firebase`)
> sengaja tidak dipakai: `firestore.rules` menolak semua akses klien dan
> browser tidak pernah bicara langsung ke Firestore.

## Setup lokal

1. Install dependency:

   ```bash
   npm install
   ```

2. Salin `.env.example` menjadi `.env`, lalu isi:

   ```dotenv
   FIREBASE_PROJECT_ID="..."
   FIREBASE_CLIENT_EMAIL="..."
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   AUTH_SECRET="..."   # minimal 32 byte acak
   ```

   Alternatif: isi `FIREBASE_SERVICE_ACCOUNT_JSON` dengan seluruh JSON service
   account (satu baris atau base64). Jangan pernah commit nilai asli.

3. Pilih salah satu:

   ```bash
   npm run db:seed          # data demo (jangan di production)
   npm run bootstrap:admin  # satu akun SUPER_ADMIN untuk deployment nyata
   ```

4. Jalankan:

   ```bash
   npm run dev
   ```

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Development server. |
| `npm run build` / `npm start` | Build dan jalankan production. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript tanpa emit. |
| `npm test` | Unit test (Vitest). |
| `npm run test:integration` | Integration test dengan Firestore Emulator. |
| `npm run db:check` | Cek koneksi Firestore dan jumlah dokumen. |
| `npm run db:seed` | Seed data demo. |
| `npm run bootstrap:admin` | Buat SUPER_ADMIN pertama. |
| `npm run db:migrate-from-postgres -- --apply` | Impor data PostgreSQL/Supabase lama (sekali pakai). |
| `npm run db:purge-demo -- --apply` | Hapus akun demo. |
| `npm run db:purge-reference -- --apply` | Hapus jadwal & lokasi demo. |
| `npm run db:reset -- --apply` | Kosongkan seluruh data aplikasi. |

> **PowerShell:** `npm run <script> -- --flag` tidak meneruskan flag di
> PowerShell 5.1 (bash, cmd, dan zsh meneruskannya). Pakai
> `npm run <script> --% -- --apply`, atau panggil script-nya langsung:
> `npx tsx scripts/migrate-postgres-to-firestore.ts --apply`.

## Deploy ke Vercel

Project Vercel: `pwa-absensi` (`https://pwa-absensi-azure.vercel.app`).

Tambahkan environment berikut di Vercel (Production dan Preview):

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `AUTH_SECRET`
- `SESSION_MAX_AGE` (opsional)

`DATABASE_URL` dan `DATABASE_SSL` tidak lagi dipakai runtime. Setelah env diisi,
deploy seperti biasa. `firestore.rules` menolak semua akses klien; Admin SDK
tetap bekerja karena berjalan di server.

Rules ikut ter-deploy dari repo:

```bash
firebase deploy --only firestore:rules --project <project-id>
```

## Project Firebase

| | Nilai |
| --- | --- |
| Project ID | `absensi-by-pwa` |
| Region database | `asia-southeast2` (Jakarta) |
| Delete protection | aktif |
| Service account | `firebase-adminsdk-fbsvc@absensi-by-pwa.iam.gserviceaccount.com` (role `roles/datastore.user`) |

## Migrasi dari PostgreSQL/Supabase

1. Isi sementara `DATABASE_URL` (dan `DATABASE_SSL` bila perlu) di `.env`.
2. Dry run:

   ```bash
   npm run db:migrate-from-postgres
   ```

3. Terapkan:

   ```bash
   npm run db:migrate-from-postgres -- --apply
   ```

4. Verifikasi:

   ```bash
   npm run db:check
   ```

5. Hapus `DATABASE_URL` dari `.env` dan Vercel setelah data lama tidak lagi
   dibutuhkan.

## Struktur data Firestore

| Koleksi | Isi |
| --- | --- |
| `users/{userId}` | Akun, hash password, role, jadwal. |
| `schedules/{scheduleId}` | Jadwal kerja. |
| `attendance/{userId}_{YYYY-MM-DD}` | Satu dokumen per karyawan per hari. |
| `locations/{locationId}` | Geo-fence. |
| `settings/organization` | Zona waktu, jadwal default, kebijakan lokasi. |
| `auditLogs/{logId}` | Audit trail. |
| `userEmails/{email}` | Indeks unik email. |
| `employeeCodes/{code}` | Indeks unik kode karyawan. |
| `counters/{prefix}` | Penomoran kode berikutnya. |
| `realtime/attendance` | Sinyal SSE tanpa PII. |

Dokumen `attendance` memakai ID deterministik, sehingga double check-in gagal
secara struktural. Detail keputusan ada di [`docs/architecture.md`](docs/architecture.md).
