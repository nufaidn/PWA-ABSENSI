# Vercel Deployment Fix Checklist

## Problem
Production deployment failed for "absensi-by-pwa" while local build succeeds.

---

## Root Cause Diagnosis

### Common Causes (Check These First)

#### [ ] 1. Missing Environment Variables
**Action**: Check Vercel Project Settings → Environment Variables

Required variables:
- [ ] FIREBASE_PROJECT_ID
- [ ] FIREBASE_CLIENT_EMAIL
- [ ] FIREBASE_PRIVATE_KEY (or FIREBASE_SERVICE_ACCOUNT_JSON)
- [ ] AUTH_SECRET

**How to check**: 
1. Go to Vercel Dashboard
2. Select "absensi-by-pwa" project
3. Click Settings → Environment Variables
4. Verify all variables exist

**Fix if missing**:
```
1. Copy values from local .env.local
2. Add to Vercel for Production + Preview + Development
3. Redeploy
```

#### [ ] 2. Build Cache Issue
**Action**: Clear build cache

**Steps**:
1. Vercel Dashboard → Project → Settings → Git
2. Click "Clear All Caches" 
3. Redeploy

#### [ ] 3. Check Actual Vercel Error
**Action**: Read the build logs

**Steps**:
1. Vercel Dashboard → Deployments
2. Click latest failed deployment
3. Look for error message in Build Logs
4. Common errors:
   - "Cannot find FIREBASE_PROJECT_ID"
   - "Firebase initialization failed"
   - "Port already in use"
   - "Timeout during build"

---

## Detailed Fix Steps

### Step 1: Retrieve Firebase Credentials
```bash
# Get from local .env.local
cat .env.local | grep FIREBASE

# Or from Firebase Console:
# 1. Go to Firebase Console
# 2. Project Settings → Service Accounts
# 3. Generate new private key (JSON)
# 4. Copy values for FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
```

### Step 2: Add to Vercel Environment Variables
1. **Go to**: https://vercel.com → "absensi-by-pwa" → Settings → Environment Variables
2. **For each environment** (Production, Preview, Development):
   - Click "Add Environment Variable"
   - Add these values:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
AUTH_SECRET=your-secret-here
```

**Important**: 
- Use actual values from Firebase service account JSON
- For FIREBASE_PRIVATE_KEY: Keep `\n` characters (don't convert to actual newlines)
- AUTH_SECRET must be 32+ bytes (base64)

### Step 3: Verify Values Are Set
1. Go to Vercel Project Settings
2. Environment Variables section
3. Check each variable shows ✓ for all environments

### Step 4: Redeploy
```bash
# Option 1: Redeploy from Vercel UI
# Deployments → Failed Build → Redeploy

# Option 2: Force redeploy via git
git -C "f:\PWA-ABSEN" commit --allow-empty -m "chore: trigger redeploy"
git -C "f:\PWA-ABSEN" push origin main
```

### Step 5: Monitor Build Logs
1. Go to Vercel Deployments
2. Watch new deployment
3. Check for errors in Build Logs
4. Should see: "Compiled successfully" and "Generating static pages"

---

## Verification After Deploy

### [ ] Check Deployment Status
- [ ] Build completes without errors
- [ ] Status shows "Ready"
- [ ] All routes generated (20+ pages)

### [ ] Test Live URL
1. Go to live URL
2. Try to access dashboard
3. Should load without 500/502 errors

### [ ] Check API Health
```
curl https://your-vercel-url.vercel.app/api/health
```
Expected response:
```json
{"status":"ok","timestamp":"2026-10-27T..."}
```

### [ ] Test Database Connection
1. Login to app
2. Try to check-in
3. Should succeed (Firebase queries working)

---

## If Still Failing After These Steps

### Escalation 1: Check Firebase Project
```bash
# Verify Firebase project is accessible
npm run db:check
```

This will:
- Test Firebase connection
- Verify credentials
- Check Firestore database access

### Escalation 2: Test Production Build Locally
```bash
# Build production version
npm run build

# Start production server
npm run start

# This simulates Vercel environment
# If it fails, the issue is code/config not env vars
```

### Escalation 3: Check Vercel Logs for Specific Errors
1. Go to deployment in Vercel
2. Click "Runtime Logs" (not just Build Logs)
3. Look for errors like:
   - Permission denied (Firebase auth)
   - Connection refused (database)
   - Module not found (dependencies)
   - Timeout (build taking too long)

---

## Known Issues Fixed

### ✅ CalendarPlus ReferenceError
- **Fixed**: Replaced with Clock icon
- **Commit**: b6c42b0
- **Status**: Resolved

### ✅ TypeScript Compilation Errors  
- **Fixed**: Icon types, form actions, status mapping
- **Commit**: b7c23a2
- **Status**: Resolved

### ✅ Security Note Color
- **Fixed**: Changed to white text
- **Commit**: 42cd04e
- **Status**: Resolved

---

## Code Changes Summary

All recent changes are dashboard-related and **do not affect deployment**:
- Dashboard redesign (Phase 1-5) ✅
- Design tokens ✅
- Navigation fixes ✅
- No build config changes
- No environment changes

**Conclusion**: Issue is environmental, not code quality.

---

## Questions to Ask

1. **When was the last successful deployment?**
   - If < 1 week ago: Environment vars likely set
   - If > 1 month ago: Check if variables expired

2. **Did project.json or vercel.json change?**
   - Check: `git log -1 -- vercel.json`
   - Should be: no changes

3. **Is this the first deployment or a redeploy?**
   - First: Likely missing env vars
   - Redeploy: Likely cache issue

---

## Contact Firebase Support (if needed)

If after all steps it still fails:
1. Verify Firebase project hasn't hit quotas
2. Check Firebase Console → Quotas & Limits
3. Check Firebase Console → Usage & Billing
4. Verify service account has required permissions

---

**Last Updated**: October 27, 2026
**Status**: Ready for troubleshooting
