# Troubleshooting — Universal Attendance System

## ERR_TOO_MANY_REDIRECTS pada Mobile (Desktop OK)

**Error message:**
```
"Halaman ini tidak berfungsi"
"pwa-absensi-azure.vercel.app terlalu sering mengalihkan Anda"
"ERR_TOO_MANY_REDIRECTS"
```

**Karakteristik:**
- Desktop: login berhasil ✓
- Mobile (Android/iOS, WiFi atau 4G): ERR_TOO_MANY_REDIRECTS ✗
- Terjadi konsisten atau setelah kondisi tertentu

**Root cause (spesifik mobile):**
Session cookie tidak tersimpan di mobile browser, sehingga loop redirect:
```
1. Mobile akses halaman
2. proxy.ts → tidak ada cookie → redirect /login
3. /login → getCurrentUser() → tidak ada cookie → redirect /login
4. ... infinite redirect → ERR_TOO_MANY_REDIRECTS
```

---

## Penyebab #1: Mobile Browser Cookie Handling (PALING SERING)

**Tanda-tanda:**
- Desktop login OK, mobile akses langsung dari desktop session → error
- Atau mobile akses, terus login lagi di mobile → error
- Di incognito mode mobile → OK

**Penyebab:**
- Android Chrome/Firefox: `sameSite=lax` + `secure=true` handling berbeda dari desktop
- Safari iOS: cookie dengan `httpOnly` sering di-block pada redirect chain
- Mixed HTTP/HTTPS: redirect tidak clean antara protocol

**Solusi Langsung (Test dulu):**

1. **Di Mobile, buka incognito/private tab** dan coba login
   - Jika **berhasil** → cookie issue (cache stale)
   - Jika **gagal** → lanjut ke Penyebab #2

2. **Clear app data:**
   - **Android:** Settings → Apps → [Browser] → Storage → Clear Data
   - **iOS:** Settings → [Browser] → Clear History and Website Data
   - Kemudian buka link fresh → coba login

3. **Coba WiFi + mobile data:**
   - Jika WiFi berhasil tapi 4G gagal → ISP proxy intercept (lihat Penyebab #3)
   - Jika keduanya gagal → lanjut

4. **Check clock sync di device:**
   - Android: Settings → System → Date & time → Use network-provided time (ON)
   - iOS: Settings → General → Date & Time → Set Automatically (ON)
   - JWT validation memerlukan clock accuracy ±5 menit

---

## Penyebab #2: Firebase Credentials Issue (pada Mobile khususnya)

**Tanda-tanda:**
- `/api/health` return `configured: false` saat diakses mobile
- Atau saat login mobile, error "Terjadi kesalahan"

**Solusi:**

Pastikan Vercel env vars untuk **Production** + **Preview**:
```
✓ FIREBASE_PROJECT_ID
✓ FIREBASE_CLIENT_EMAIL
✓ FIREBASE_PRIVATE_KEY
✓ AUTH_SECRET (minimal 32 char)
```

Test:
```bash
# Dari desktop
curl https://pwa-absensi-azure.vercel.app/api/health

# Dari mobile browser
https://pwa-absensi-azure.vercel.app/api/health
```

Jika tidak `configured: true`, lihat Penyebab #1 di troubleshooting sebelumnya.

---

## Penyebab #3: ISP/Mobile Network Proxy

**Tanda-tanda:**
- WiFi → login OK ✓
- Mobile data (4G/LTE) → ERR_TOO_MANY_REDIRECTS ✗
- Ganti operator → sama problemnya

**Penyebab:**
- ISP proxy memblokir `httpOnly` cookies
- Atau intercept HTTPS redirect chain
- Transparan proxy menghilangkan `Secure` flag

**Solusi:**
1. Ganti ke WiFi untuk test
2. Jika tetap gagal → bukan ISP, lanjut Penyebab #4
3. Jika WiFi OK tapi 4G gagal → hubungi ISP atau coba VPN

---

## Penyebab #4: Service Worker / PWA Cache (Khusus jika pernah install PWA)

**Tanda-tanda:**
- PWA sudah di-install ke home screen
- Desktop baru bisa login, tapi PWA di mobile → error
- Clear app data → OK (sementara)

**Penyebab:**
- Service worker cached old redirect logic
- Cache tidak auto-update

**Solusi:**

**Uninstall dan reinstall PWA:**
1. Long-press app icon di home screen → Uninstall
2. Buka browser fresh → `https://pwa-absensi-azure.vercel.app`
3. Browser menu → Install app
4. Coba login lagi

**Atau clear cache PWA:**
- **Android:** Settings → Apps → [App Name] → Storage → Clear Cache
- **iOS:** (PWA tidak punya persistent cache install, cukup clear Safari cache)

---

## Debug Endpoints (Temporary - Untuk Troubleshooting)

### `/api/health` — Firebase Configuration Status

```bash
curl https://pwa-absensi-azure.vercel.app/api/health
```

**Response OK:**
```json
{
  "configured": true,
  "projectId": "absensi-by-pwa",
  "source": "service-account-json",
  "missing": [],
  "problem": null
}
```

### `/api/debug/session` — Cookie & Session Status

```bash
# Desktop: open in browser or curl
https://pwa-absensi-azure.vercel.app/api/debug/session

# Mobile: just navigate to it
```

**Response setelah login:**
```json
{
  "hasCookie": true,           // ← Harus true
  "tokenIsValid": true,        // ← Harus true
  "isSecureCookiesEnabled": true,
  "isMobile": false  // atau true jika dari mobile
}
```

**Jika `hasCookie: false` setelah login:**
- Cookie tidak ter-persist → masalah browser/network
- Coba Penyebab #1-#3 di atas

---

## Mobile-Specific Diagnostics

### Chrome DevTools Remote Debug (Android)

1. Desktop: Buka Chrome → `chrome://inspect`
2. Aktifkan USB debugging di phone (Settings → Developer Options)
3. Hubungkan dengan kabel USB
4. Di desktop DevTools, klik "Inspect" di device
5. Buka mobile tab `pwa-absensi-azure.vercel.app`
6. Lihat:
   - **Console** → error apa?
   - **Network** → redirect chain (3xx codes)
   - **Application → Cookies** → `uas_session` ada atau tidak?
   - **Application → Cache Storage** → file apa di cache?

### Firefox DevTools Remote Debug (Android)

1. Mobile Firefox: `about:debugging` → Enable Remote Debugging
2. Desktop Firefox: `about:debugging` → Connect to device
3. Tab "This Firefox" → "Setup" → pilih device
4. Inspect halaman seperti Chrome

### Safari Remote Debug (iOS)

1. iPhone: Settings → Safari → Advanced → Web Inspector (ON)
2. Desktop Mac: Safari → Develop → [Device Name] → tab
3. Inspect elements + console

---

## Quick Checklist (Mobile-Specific)

- [ ] Sinkronisasi waktu device (Settings → Date & Time)
- [ ] Clear app data (browser cache + cookies)
- [ ] Coba WiFi (bukan hanya mobile data)
- [ ] Coba incognito/private tab
- [ ] Jika PWA di-install, uninstall dan reinstall
- [ ] `/api/health` return `configured: true` (akses dari mobile)
- [ ] `/api/debug/session` show `hasCookie: true` setelah login

---

## Saat Report Issue

Beri info:
1. Device: iPhone / Android, model, OS version
2. Browser: Chrome / Safari / Firefox version
3. Network: WiFi SSID or mobile operator name
4. Step to reproduce: exact sequence
5. Screenshot error message
6. Output dari `/api/health` (mobile)
7. Output dari `/api/debug/session` sebelum & sesudah login (mobile)

---

## Logs & Server-Side Troubleshooting

Saat error, server logs akan show:
```
[MOBILE] GET /
{
  "hasToken": false,
  "isSignedIn": false,
  "userAgent": "Mozilla/5.0 (Linux; Android 14; ...) Chrome/..."
}
```

Ini membantu diagnose apakah:
- Cookie benar-benar tidak dikirim mobile
- atau parsing-nya yang gagal

Check di Vercel Dashboard → Deployments → Logs untuk live errors.

