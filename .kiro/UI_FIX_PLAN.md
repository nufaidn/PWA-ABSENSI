# Dashboard UI Fix Plan - Mockup Alignment

## Problem Analysis & Solutions

### 1. Format Waktu (CRITICAL)
**Issue**: Titik (.) bukan titik dua (:) karena locale id-ID
- 16.12.45 ❌ → 16:12:45 ✅

**Penyebab**: `toLocaleTimeString('id-ID')` format lokal Indonesia

**Solusi**:
- Format manual dengan `padStart` atau library seperti `date-fns`
- Gunakan `tabular-nums` CSS untuk alignment
- Hapus monospace font

**Files**: hero-card.tsx, progress-ring.tsx

---

### 2. Badge Status (HIGH)
**Issue**: Badge terpotong, styling salah
- Saat: lingkaran penuh + teks (terpotong)
- Target: pill shape #DCFCE7, teks #166534, tinggi 26px

**Solusi**:
- Ubah styling: pill shape dengan padding 8px 12px
- Warna latar: bg-green-50, text: text-green-700
- Hilangkan ikon, hanya teks "Hadir" / "Terlambat" / "Izin"

**Files**: hero-card.tsx

---

### 3. Progress Ring Panel (HIGH)
**Issue**: Layout vertikal, ring terlalu besar
- Target: HORIZONTAL - ring 76px di kiri, teks di kanan
- Panel semi-transparan putih 14%, radius 20px

**Solusi**:
- Layout flex-row (ring kiri, teks kanan)
- Ring size: 76px (bukan besar)
- Teks format: "Jam kerja hari ini" + "8j 19m" + "dari target 8 jam"
- Jika overtime: tambah chip "+19m lembur"

**Files**: progress-ring.tsx, hero-card.tsx

---

### 4. Tombol Aksi (HIGH)
**Issue**: Teks tidak terbaca (kontras rendah)
- Saat: "Absensi hari ini selesai" - teks putih transparan ❌
- Target: white/green latar, teks hijau, kontras 4.5:1 ✅

**Solusi**:
- State selesai: bg-green-50, text-green-700, ikon centang
- Tinggi: 56px, radius: 18px
- Belum check-in: biru muda, teks blue-700
- Sudah check-in ready: gradien merah (EF4444→DC2626)

**Files**: checkout-button.tsx

---

### 5. Header & Spacing (MEDIUM)
**Issue**: 
- Ikon lonceng hilang
- Spacing tidak sesuai (tanggal menempel, hero menempel)
- Nama warna ungu (salah, harus biru #1D4ED8)

**Solusi**:
- Tambah ikon lonceng 44x44px di kanan header
- Spacing: header→tanggal 16px, tanggal→sapaan 4px, sapaan→divisi 2px, divisi→hero 16px
- Nama: gunakan DESIGN_TOKENS.colors.blue[700]

**Files**: greeting-section.tsx, app-shell.tsx (header)

---

### 6. Ringkasan Kartu (MEDIUM)
**Issue**:
- Latar pastel berbeda-beda ❌
- Ikon besar di tengah ❌
- Kontras rendah ❌

**Solusi**:
- Semua kartu: bg-white, shadow-sm, radius 18px
- Angka kiri atas (22px bold), label bawah (12px)
- Warna angka: hijau #166534, oranye #9A3412, biru #1D4ED8
- Hilangkan ikon komplex, hanya angka+label

**Files**: weekly-summary.tsx

---

### 7. Kartu Pintasan (MEDIUM)
**Issue**: Tertutup oleh bottom nav
- Target: 2 kartu, minimal 56px tinggi
- Ikon 36px gradien di kiri, judul+subteks di kanan

**Solusi**:
- Layout: flex-row, ikon kiri, text kanan
- Gap 16px, padding 16px
- Perbaiki lewat padding-bottom (poin 8)

**Files**: quick-links.tsx

---

### 8. Bottom Nav & Scroll (HIGH)
**Issue**: Konten tertutup, nav styling salah
- Tab aktif: pill terpotong, label di bawah ❌
- Target: pill horizontal, ikon+label sejajar

**Solusi**:
- Container padding-bottom: 80px (nav height) + safe-area + 16px
- Tab aktif: bg-blue-100, padding 10px 18px, height 44px
- Layout: flex-row, ikon+label, gap 8px
- Tab lain: hanya ikon 24px

**Files**: navigation.tsx, dashboard/page.tsx

---

## Implementation Priority

1. **CRITICAL**: Time format fix (hero-card.tsx)
2. **CRITICAL**: Bottom nav scroll (dashboard/page.tsx, navigation.tsx)
3. **HIGH**: Progress ring layout (hero-card.tsx, progress-ring.tsx)
4. **HIGH**: Button states (checkout-button.tsx)
5. **HIGH**: Badge styling (hero-card.tsx)
6. **MEDIUM**: Header spacing (greeting-section.tsx)
7. **MEDIUM**: Weekly summary cards (weekly-summary.tsx)
8. **MEDIUM**: Quick links (quick-links.tsx)

---

## Testing Checklist

Test at widths: 360px, 390px, 430px

- [ ] 1. Format waktu: 16:12:45 (bukan titik)
- [ ] 2. Badge status: pill shape, not cut off
- [ ] 3. Progress ring: horizontal, 76px ring, proper text
- [ ] 4. Button: readable text, correct color/contrast
- [ ] 5. Header: icon bell, correct spacing
- [ ] 6. Ringkasan: white cards, correct colors
- [ ] 7. Quick links: visible, not hidden
- [ ] 8. Bottom nav: proper pill, content not cut off

---

## Files to Modify

1. src/components/dashboard/hero-card.tsx
2. src/components/dashboard/progress-ring.tsx
3. src/components/dashboard/checkout-button.tsx
4. src/components/dashboard/greeting-section.tsx
5. src/components/dashboard/weekly-summary.tsx
6. src/components/dashboard/quick-links.tsx
7. src/components/layout/navigation.tsx
8. src/app/(app)/dashboard/page.tsx

---

**Status**: Ready for implementation
