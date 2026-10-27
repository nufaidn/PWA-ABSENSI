# Redesign Halaman Beranda (Dashboard) - Requirements Specification

**Proyek:** PT Bumi Sarana Maju – Attendance System  
**Scope:** Halaman Beranda role User  
**Deadline:** Per sprint  
**Status:** In Progress

---

## 1. Latar Belakang

Halaman Beranda saat ini (dashboard) memiliki hierarki visual yang datar, dengan elemen-elemen dalam satu card besar dengan garis pemisah tipis. Pengalaman terasa kaku dan kurang modern, meskipun fungsionalitas sudah baik.

**Masalah Utama:**
- Hierarki datar: semua informasi dalam card dengan border thin
- Durasi kerja ("6j 38m") ditempatkan di bawah Check-out, padahal user belum check-out
- Ruang kosong besar di bawah quick links yang tidak terpakai
- Quick links terlalu kecil dan flat
- Tombol action tidak menonjol dengan cukup
- Tidak ada animasi atau micro-interactions

---

## 2. Tujuan Desain

**Visi:** Ciptakan pengalaman Beranda yang terasa **modern, hidup, dan ramah** tanpa mengubah logika bisnis atau API structure. Gunakan biru sebagai brand color utama, dengan hijau (status hadir), oranye (terlambat), dan merah (aksi/error) sebagai accent colors.

**Objectives:**
1. Meningkatkan hierarki visual dengan spacing, warna, dan typography yang jelas
2. Membuat elemen aksi (Check-in/Check-out) menonjol dan mudah dipahami
3. Mengoptimalkan penggunaan space dengan menambahkan ringkasan minggu ini
4. Meningkatkan engagement dengan micro-interactions dan animasi
5. Mempertahankan aksesibilitas (WCAG AA, kontras, target 44px+)
6. Responsive pada lebar 360–430px dengan aman terhadap notch/gesture bar

---

## 3. Functional Requirements

### 3.1 Jam Server Real-time
- **FR-001:** Tampilkan jam server dengan angka tabular agar tidak bergeser
- **FR-002:** Perbarui setiap detik dari server, bukan device clock
- **FR-003:** Tampilkan dalam format HH:MM:SS

### 3.2 Status & Chips
- **FR-003:** Tampilkan status badge (Hadir/Terlambat/Belum absen) berdasarkan data server
- **FR-004:** Tampilkan chip lokasi jika data tersedia dan valid
- **FR-005:** Gunakan warna semantik: hijau (hadir), oranye (terlambat), abu-abu (belum)

### 3.3 Check-in dan Check-out Cards
- **FR-006:** Buat dua mini-card terpisah dengan ikon berwarna, label, dan waktu
- **FR-007:** Jika belum check-out, tampilkan "Belum check-out" (muted), bukan "—"
- **FR-008:** Tampilkan durasi kerja di card Check-out jika sudah check-in

### 3.4 Progress Ring/Bar Jam Kerja
- **FR-009:** Tampilkan progress ring/bar dari 0 hingga 8 jam (target kerja)
- **FR-010:** Update durasi berjalan real-time
- **FR-011:** Pindahkan "6j 38m" dari bawah Check-out ke progress ring

### 3.5 Tombol Aksi Utama
- **FR-012:** Check-in: full width, tinggi 56px, gradien biru, shadow
- **FR-013:** Check-out: full width, tinggi 56px, gradien merah-oranye, shadow
- **FR-014:** State handling: default, loading (spinner), disabled
- **FR-015:** **OPTIONAL:** Konfirmasi via bottom sheet atau slide-to-confirm sebelum check-out (perlu konfirmasi user)
- **FR-016:** **OPTIONAL:** Haptic feedback pada press (perlu konfirmasi user & device support)

### 3.6 Catatan Keamanan
- **FR-017:** Jadikan info chip satu baris dengan ikon gembok
- **FR-018:** Teks ringkas: "Waktu dicatat server, tidak bisa diubah dari perangkat"
- **FR-019:** Ditempatkan di bawah tombol aksi

### 3.7 Ringkasan Minggu Ini
- **FR-020:** Tampilkan kartu horizontal dengan: hadir (count), terlambat (count), total jam kerja, lembur
- **FR-021:** Gunakan ikon semantik dan warna untuk setiap metrik
- **FR-022:** Fungsi: mengisi ruang kosong + memberikan konteks attendance minggu

### 3.8 Quick Links (Statistik & Cuti & Izin)
- **FR-023:** Perbesar kartu dengan ikon dalam lingkaran gradien
- **FR-024:** Tampilkan deskripsi singkat dan chevron
- **FR-025:** Gradient: Statistik (blue), Cuti & Izin (cyan-blue)

### 3.9 Header & Greeting
- **FR-026:** Sapaan dinamis sesuai waktu ("Selamat pagi/siang/malam, Nufail")
- **FR-027:** Tanggal dan divisi sebagai subteks dengan hierarki tipografi jelas
- **FR-028:** Avatar user (monogram) + ikon notifikasi (optional)

### 3.10 Bottom Navigation
- **FR-029:** Indikator aktif berbentuk pill (pill shape, bukan underline)
- **FR-030:** Ikon sedikit lebih besar (19px → 22px)
- **FR-031:** Safe-area padding untuk iOS/Android gesture bar

---

## 4. Non-Functional Requirements

### 4.1 Performa
- **NFR-001:** Lazy load quick links dan ringkasan minggu
- **NFR-002:** Skeleton loading state untuk real-time data
- **NFR-003:** Pull-to-refresh support (optional, perlu konfirmasi)

### 4.2 Aksesibilitas
- **NFR-004:** WCAG AA color contrast (4.5:1 untuk text)
- **NFR-005:** Target sentuh minimal 44×44px
- **NFR-006:** Label aksesibilitas pada ikon (aria-label)
- **NFR-007:** Semantic HTML: <main>, <section>, <time>, roles

### 4.3 Responsivitas
- **NFR-008:** Mobile-first design, 360–430px viewport
- **NFR-009:** Safe-area-inset untuk notch (iPhone X+) dan gesture bar (Android)
- **NFR-010:** Padding bottom untuk bottom nav tidak tertutup

### 4.4 Kompatibilitas
- **NFR-011:** Dukung browser modern (Chrome 90+, Safari 14+, Firefox 88+)
- **NFR-012:** Fallback untuk animasi jika prefers-reduced-motion aktif

### 4.5 Styling
- **NFR-013:** Gunakan design tokens dari globals.css (OKLCH color palette)
- **NFR-014:** Jangan tambah dependensi besar tanpa alasan
- **NFR-015:** Ikuti existing patterns (Surface, Stat, primitives)
- **NFR-016:** Light theme only (no dark mode)

---

## 5. Business Rules

- **BR-001:** Waktu absensi tetap dicatat dari server
- **BR-002:** Tidak boleh mengubah API endpoints atau data structure
- **BR-003:** Hanya perubahan UI/UX dan styling
- **BR-004:** Semua teks dalam Bahasa Indonesia

---

## 6. Acceptance Criteria

- [ ] Halaman Beranda terlihat modern dan hidup
- [ ] Hierarki visual jelas dengan spacing, warna, typography
- [ ] Jam server update real-time tanpa jitter
- [ ] Check-in/Check-out menonjol dengan gradient dan shadow
- [ ] Progress ring jam kerja berfungsi dan update real-time
- [ ] Ringkasan minggu hadir dan berisi (hadir, terlambat, jam, lembur)
- [ ] Quick links lebih besar dan eye-catching
- [ ] Micro-interactions smooth (fade, slide, scale on press)
- [ ] Responsive 360–430px, safe-area-inset bekerja
- [ ] WCAG AA contrast, target 44px+
- [ ] No breaking changes terhadap API atau logic
- [ ] Semua file ter-track di git

---

## 7. Constraints & Risks

**Constraints:**
- Tidak boleh menambah API calls (gunakan data yang sudah ada di `getTodaySummary`)
- Tidak boleh mengubah shape data AttendanceCardData
- Material UI / shadcn harus tetap konsisten

**Risks:**
- **Risk-001:** Real-time clock bisa jitter jika render terlalu sering → Mitigasi: debounce, interval 1s
- **Risk-002:** Responsive design kompleks dengan safe-area-inset → Mitigasi: test di browser DevTools + device real
- **Risk-003:** Animasi bisa mengurangi performa di device lama → Mitigasi: prefers-reduced-motion, optimize keyframes

---

## 8. Success Metrics

- **SM-001:** User satisfaction: lebih dari 80% pengguna merasa halaman lebih modern
- **SM-002:** Performance: Time to Interactive (TTI) ≤ 3s di 4G
- **SM-003:** Accessibility: Lighthouse Accessibility score ≥ 90
- **SM-004:** Responsiveness: Bekerja sempurna di 360–430px viewport
- **SM-005:** Zero breaking changes: API dan data structure tetap sama
