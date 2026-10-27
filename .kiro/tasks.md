# Redesign Halaman Beranda - Implementation Tasks

**Sprint Goal:** Modernisasi halaman Beranda dengan UI yang lebih hidup, engaging, dan professional  
**Estimated Duration:** 2–3 sprint weeks (per prioritas)  
**Dependencies:** None (self-contained redesign)

---

## Phase 1: Foundation & Core (High Priority)

### Task 1.1: Create HeroCard Component
**Objective:** Extract attendance card logic dan styling baru ke komponen terpisah  
**Acceptance Criteria:**
- [ ] Status badges (Hadir/Terlambat/Belum) dengan warna semantik
- [ ] Real-time jam server dengan `.tabular` class, update 1x per detik
- [ ] Check-in / Check-out mini-cards side-by-side dengan ikon
- [ ] "Belum check-out" text jika belum checkout (bukan "—")
- [ ] Full-width action button (Check-in/Check-out) dengan gradient
- [ ] Security note (🔒) di bawah button, satu baris
- [ ] Smooth animations pada state transitions
- [ ] Safe-area padding responsive

**Technical Details:**
- Extract dari `src/components/attendance/attendance-card.tsx`
- Reuse `StatusBadge` component dari `src/components/layout/badges.tsx`
- Styling: Tailwind + globals.css tokens
- Props: `AttendanceCardData` (existing)

**Files:**
- [ ] Update `src/components/attendance/attendance-card.tsx`

---

### Task 1.2: Create GreetingSection Component
**Objective:** Render sapaan dinamis + metadata dengan hierarki visual jelas  
**Acceptance Criteria:**
- [ ] Sapaan dinamis: "Selamat pagi/siang/malam, [Nama]"
- [ ] Tanggal dengan format "DD MMM YYYY"
- [ ] Department dengan ikon atau separator "•"
- [ ] H1 dengan optional gradient text (dari-slate-900 via-blue-800)
- [ ] Date/dept subteks dengan muted color dan proper sizing
- [ ] Responsive 360–430px

**Technical Details:**
- Buat file baru: `src/components/dashboard/greeting-section.tsx`
- Import: `formatShortDate`, `useServerClock` (existing)
- Props: `user: { name, department }`, `today: { serverNow, timezone }`

**Files:**
- [ ] Create `src/components/dashboard/greeting-section.tsx`

---

### Task 1.3: Update Quick Links Component
**Objective:** Perbesar kartu dengan ikon gradient badge dan visual lebih menarik  
**Acceptance Criteria:**
- [ ] Kartu lebih besar dengan proper padding
- [ ] Icon dalam circular gradient badge (40px)
- [ ] Label + deskripsi dengan hierarki jelas
- [ ] Chevron di kanan dengan hover animation (translate +2px)
- [ ] Gradient per card (Statistik: blue, Cuti & Izin: cyan)
- [ ] Hover: shadow increase + smooth transition
- [ ] Responsive 2 kolom

**Technical Details:**
- Update props: tambah `gradient` parameter
- File: `src/app/(app)/dashboard/page.tsx` (update `QuickLink` component)
- Styling: Tailwind + CSS transitions

**Files:**
- [ ] Update `src/app/(app)/dashboard/page.tsx` (QuickLink function)

---

### Task 1.4: Add Progress Ring / Progress Bar (Jam Kerja)
**Objective:** Visualisasi progress jam kerja dari 0–8 jam dengan durasi real-time  
**Acceptance Criteria:**
- [ ] Pilih antara circular ring atau horizontal bar (perlu konfirmasi)
- [ ] Warna: primary blue (--primary)
- [ ] Background muted (--muted)
- [ ] Label tengah: "X jam Y menit / 8 jam target"
- [ ] Update real-time setiap detik
- [ ] Responsive sizing

**Technical Details:**
- Buat komponen baru atau extend ProgressMeter dari badges.tsx
- Hitung durasi dari `workedMinutes` di `AttendanceCardData`
- File: `src/components/attendance/progress-ring.tsx` atau dalam hero-card

**Files:**
- [ ] Create `src/components/attendance/progress-ring.tsx` (jika terpisah)
- [ ] Update `src/components/attendance/attendance-card.tsx`

---

### Task 1.5: Create Weekly Summary Card (Optional but Recommended)
**Objective:** Tampilkan ringkasan minggu: hadir, terlambat, total jam, lembur  
**Acceptance Criteria:**
- [ ] 4-cell grid: Hadir (hijau), Terlambat (oranye), Total Jam (biru), Lembur (biru)
- [ ] Ikon + angka besar + unit (12px muted)
- [ ] Warna semantik per metrik
- [ ] Text-center alignment
- [ ] Responsive 2 kolom

**Assumptions:**
- Anggap data minggu ini tersedia di `getTodaySummary()` atau perlu API baru (perlu konfirmasi)
- Jika data belum ada: hardcode atau skip untuk fase 1

**Technical Details:**
- Buat `src/components/dashboard/weekly-summary.tsx`
- Reuse Stat component dari `src/components/layout/primitives.tsx`
- Props: `{ attended, late, totalHours, overtime }` (atau placeholder)

**Files:**
- [ ] Create `src/components/dashboard/weekly-summary.tsx`

---

## Phase 2: Layout & Page Integration (High Priority)

### Task 2.1: Redesign Dashboard Page Layout
**Objective:** Integrate semua komponen baru dengan proper spacing dan responsive layout  
**Acceptance Criteria:**
- [ ] Header (logo, avatar, bell, menu) → USE EXISTING LAYOUT
- [ ] Greeting section below header
- [ ] Hero card (attendance) di bawah greeting
- [ ] Progress ring di tengah hero card
- [ ] Check-in/check-out mini-cards di hero
- [ ] Action button (check-in/check-out)
- [ ] Security note di bawah button
- [ ] Weekly summary card (optional)
- [ ] Quick links di bawah (2 kolom)
- [ ] Safe-area-inset di semua edge
- [ ] Bottom nav safe-area padding

**Technical Details:**
- File: `src/app/(app)/dashboard/page.tsx`
- Reuse: `AttendanceCard`, `QuickLink` (updated)
- New components: `GreetingSection`, `WeeklySummary` (optional)
- Styling: Tailwind grid + flex
- Background: gradient-to-br from-slate-50 via-blue-50/40 to-slate-50

**Files:**
- [ ] Update `src/app/(app)/dashboard/page.tsx` (main page)

---

### Task 2.2: Update Bottom Navigation Styling
**Objective:** Ubah indikator aktif ke pill shape dan perbesar ikon  
**Acceptance Criteria:**
- [ ] Active indicator: pill-shaped (rounded-full background)
- [ ] Ikon ukuran: 19px → 22px
- [ ] Label tetap ada
- [ ] Safe-area-inset-bottom applied
- [ ] Responsive 360–430px

**Technical Details:**
- File: `src/components/layout/navigation.tsx` (existing)
- Update MobileNav component styling
- Styling: Tailwind + CSS

**Files:**
- [ ] Update `src/components/layout/navigation.tsx`

---

## Phase 3: Micro-interactions & Polish (Medium Priority)

### Task 3.1: Add Entry Animations
**Objective:** Tambah fade-in + slide-in animations saat page load  
**Acceptance Criteria:**
- [ ] Greeting fade-in + slide-in-from-top 300ms
- [ ] Hero card fade-in + slide-in 300ms (100ms delay)
- [ ] Summary card fade-in (200ms delay, optional)
- [ ] Quick links staggered fade-in (100ms per item)
- [ ] Respect prefers-reduced-motion

**Technical Details:**
- Gunakan Tailwind animate-in classes (dari tw-animate-css)
- File: `src/app/(app)/dashboard/page.tsx`
- Utilities: animate-in, fade-in, slide-in-from-top, delay-*

**Files:**
- [ ] Update `src/app/(app)/dashboard/page.tsx`

---

### Task 3.2: Add Button Press Animation
**Objective:** Scale button pada press dengan smooth easing  
**Acceptance Criteria:**
- [ ] Active state: scale(0.98)
- [ ] Duration: 100ms
- [ ] Easing: cubic-bezier
- [ ] Smooth pada click/tap

**Technical Details:**
- Update `src/components/attendance/attendance-card.tsx`
- Styling: Tailwind `active:scale-95`

**Files:**
- [ ] Update `src/components/attendance/attendance-card.tsx`

---

### Task 3.3: Enhance Hover Effects
**Objective:** Smooth hover transitions pada card dan quick links  
**Acceptance Criteria:**
- [ ] Hero card hover: subtle shadow increase
- [ ] Quick links hover: shadow increase + chevron slide-right
- [ ] Duration: 200ms untuk semua
- [ ] Smooth transitions

**Technical Details:**
- Tailwind: hover:shadow-md, hover:brightness
- CSS transitions: 200ms ease

**Files:**
- [ ] Update `src/components/attendance/attendance-card.tsx`
- [ ] Update `src/app/(app)/dashboard/page.tsx` (QuickLink)

---

### Task 3.4: Add Loading & Skeleton States
**Objective:** Visual feedback saat data loading dari server  
**Acceptance Criteria:**
- [ ] Skeleton placeholder untuk jam server
- [ ] Skeleton untuk check-in/check-out time
- [ ] Smooth fade transition saat data arrive
- [ ] Optional: shimmer pulse animation

**Technical Details:**
- Buat skeleton component atau use CSS gradient pulse
- File: `src/components/attendance/attendance-card.tsx`
- Conditional rendering berdasarkan loading state

**Files:**
- [ ] Update `src/components/attendance/attendance-card.tsx`

---

## Phase 4: Accessibility & Testing (Medium Priority)

### Task 4.1: Audit & Fix WCAG AA Contrast
**Objective:** Ensure semua text/icon meet WCAG AA 4.5:1 ratio  
**Acceptance Criteria:**
- [ ] All foreground text: ≥ 4.5:1 pada background
- [ ] Badge text: ≥ 7:1 (AAA)
- [ ] Icons readable & not color-only signal
- [ ] Verified dengan Lighthouse atau WAVE tool

**Technical Details:**
- Check color pairs: foreground vs background
- Update warna jika ada yang kurang contrast
- File: `src/app/globals.css` atau component styling

**Files:**
- [ ] Audit & update as needed

---

### Task 4.2: Add ARIA Labels & Semantic HTML
**Objective:** Ensure proper accessibility tree untuk screen readers  
**Acceptance Criteria:**
- [ ] Main > section > header hierarchy
- [ ] aria-label pada ikon (status badge, check-in/out, progress)
- [ ] aria-current="page" pada active nav
- [ ] aria-busy="true" saat loading
- [ ] form elements dengan label
- [ ] role="alert" untuk error/toast

**Technical Details:**
- Update JSX dengan aria-* attributes
- Use semantic HTML tags
- Files: attendance-card, greeting-section, dashboard page

**Files:**
- [ ] Update `src/components/attendance/attendance-card.tsx`
- [ ] Update `src/components/dashboard/greeting-section.tsx`
- [ ] Update `src/app/(app)/dashboard/page.tsx`

---

### Task 4.3: Test prefers-reduced-motion
**Objective:** Animasi respect motion preferences  
**Acceptance Criteria:**
- [ ] In DevTools: Rendering > CSS Media Feature Prefers Reduced Motion = reduce
- [ ] Animations disabled atau minimal
- [ ] No transitions jitter/stutter
- [ ] Page still functional & accessible

**Technical Details:**
- Add CSS media query
- File: `src/app/globals.css` atau per-component

**Files:**
- [ ] Update `src/app/globals.css` atau component files

---

### Task 4.4: Test Responsive 360–430px + Safe-Area
**Objective:** Verify UI bekerja sempurna di mobile + safe area  
**Acceptance Criteria:**
- [ ] Chrome DevTools: 360px width viewport
- [ ] Bottom nav tidak tertutup safe-area
- [ ] No horizontal scroll
- [ ] Touch targets ≥ 44×44px
- [ ] Test di real device (iOS + Android) jika mungkin

**Technical Details:**
- Browser DevTools responsive mode
- Check env(safe-area-inset-bottom), left, right
- Files: affected components

**Files:**
- [ ] Test & update as needed

---

## Phase 5: Final Optimization & Deploy (Low Priority)

### Task 5.1: Performance Optimization
**Objective:** Ensure page loads cepat dan smooth  
**Acceptance Criteria:**
- [ ] Lighthouse Performance ≥ 85
- [ ] Time to Interactive ≤ 3s (4G)
- [ ] No layout shift (CLS ≤ 0.1)
- [ ] Lazy load optional components (weekly summary)
- [ ] Optimize images if any

**Technical Details:**
- Run Lighthouse audit
- Check bundle size
- Memoize components jika perlu
- File: `src/app/(app)/dashboard/page.tsx`

**Files:**
- [ ] Audit & optimize

---

### Task 5.2: Code Review & Documentation
**Objective:** Ensure code quality, readability, dan maintainability  
**Acceptance Criteria:**
- [ ] Components documented dengan JSDoc
- [ ] Props interface clear
- [ ] No TypeScript errors
- [ ] Consistent naming convention
- [ ] Code review approved

**Technical Details:**
- Add comments untuk complex logic
- Export clear prop types
- Update component storybook (if exists)

**Files:**
- [ ] Review & update all created/modified files

---

### Task 5.3: Deploy & Monitor
**Objective:** Push ke production dan monitor user feedback  
**Acceptance Criteria:**
- [ ] Git commit dengan clear message
- [ ] PR merged dan no conflicts
- [ ] Deployed to staging
- [ ] Tested di real device
- [ ] No error logs saat deploy
- [ ] A/B test atau full rollout (per team decision)

**Technical Details:**
- Create commit: "redesign: modernize dashboard home page"
- Commit message include: design tokens, components, animations
- Git files: see section below

**Files:**
- [ ] All implemented files

---

## Implementation Priority & Timeline

| Phase | Tasks | Priority | Estimated | Blocker? |
|-------|-------|----------|-----------|----------|
| 1.1-1.4 | Hero + Greeting + Quick Links + Progress | **HIGH** | 3–4 days | No |
| 1.5 | Weekly Summary (optional data check) | **HIGH** | 1–2 days | **YES** (data availability) |
| 2.1-2.2 | Layout + Bottom Nav | **HIGH** | 2 days | No |
| 3.1-3.4 | Animations & Loading | **MEDIUM** | 2 days | No |
| 4.1-4.4 | A11y & Testing | **MEDIUM** | 2 days | No |
| 5.1-5.3 | Optimization & Deploy | **LOW** | 1 day | No |

**Total Estimated:** 11–14 days (2 sprint weeks)

---

## Git Commit Strategy

```bash
# Phase 1
git commit -m "feat(dashboard): create hero card component with new styling
- Add progress ring/bar for work hours
- Implement check-in/check-out mini-cards
- Add gradient status badges
- Update real-time clock with tabular nums"

# Phase 2
git commit -m "feat(dashboard): add greeting section with dynamic sapaan"

git commit -m "feat(dashboard): create weekly summary card component"

git commit -m "feat(dashboard): redesign dashboard page layout
- Integrate all components
- Update responsive breakpoints
- Add safe-area-inset"

git commit -m "feat(navigation): update bottom nav with pill indicator"

# Phase 3
git commit -m "feat(dashboard): add entry animations and micro-interactions"

# Phase 4
git commit -m "fix(dashboard): audit and fix WCAG AA accessibility"

git commit -m "test(dashboard): verify responsive design 360-430px"

# Phase 5
git commit -m "perf(dashboard): optimize bundle and lazy load"

git commit -m "docs(dashboard): add JSDoc and update component documentation"
```

---

## Confirmation Points (Blockers)

Sebelum full implementation, perlu konfirmasi:

1. **Weekly Summary Data:**
   - [ ] Apakah `getTodaySummary()` sudah include weekly stats (hadir, terlambat, jam, lembur)?
   - [ ] Jika tidak, apakah perlu API baru? atau gunakan placeholder?

2. **Progress Ring vs Bar:**
   - [ ] Preferred: Circular ring (180-240°) atau horizontal bar?
   - [ ] Styling preference?

3. **Check-out Confirmation:**
   - [ ] Butuh bottom sheet dialog + konfirmasi sebelum check-out?
   - [ ] Atau direct submit?

4. **Haptic Feedback:**
   - [ ] Support vibration API on button press?
   - [ ] Browser support check needed

5. **Pull-to-Refresh:**
   - [ ] Butuh refresh jam server dengan gestur pull-to-refresh?
   - [ ] Atau leave as-is?

6. **Avatar & Bell (Header):**
   - [ ] Include avatar user di header?
   - [ ] Include notification bell?
   - [ ] Atau skip untuk fase 1?

7. **Weekly Summary Position:**
   - [ ] Separate card di bawah hero? atau integrated?
   - [ ] Atau skip untuk MVP?

---

## Success Metrics

- [ ] UI terlihat modern, hidup, professional (80%+ user satisfaction)
- [ ] Lighthouse Accessibility ≥ 90, Performance ≥ 85
- [ ] WCAG AA contrast passed
- [ ] Responsive 360–430px, safe-area-inset bekerja
- [ ] No breaking changes, API tetap sama
- [ ] Zero critical bugs pada deploy
- [ ] User engagement meningkat (shorter page load, more interactions)

---

## Notes & References

- Design Reference: Modern fintech/HR apps (Wise, Square, Paperccut, etc.)
- Color System: `src/app/globals.css` OKLCH palette
- Components: `src/components/layout/primitives.tsx`, `src/components/layout/badges.tsx`
- Animations: Tailwind `animate-in`, `tw-animate-css` library
- Accessibility: WCAG 2.1 AA, WebAIM
- Testing: Lighthouse, Axe DevTools, responsive testing

