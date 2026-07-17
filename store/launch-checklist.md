# TruckersPro — Android Launch Checklist (Phase B)

- [ ] 1. EAS link: `eas login` (user) → `eas init` → project linked
- [ ] 2. EAS env vars (production): `eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value <url>` and same for `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] 3. GitHub Pages ON (master /docs) via `gh api` → https://fatihatak1907.github.io/TruckersPro/privacy.html returns 200
- [ ] 4. Preview build: `eas build --platform android --profile preview` → install APK on phone → smoke test: login, add load, confirm expense, insights sheet, offline add + resync
- [ ] 5. User: create Google Play developer account ($25, play.google.com/console) — identity verification may take ~1 day
- [ ] 6. Production build: `eas build --platform android --profile production` → .aab
- [ ] 7. Play Console: create app (TruckersPro, free, Business) → paste listing from store/listing.md → upload screenshots + feature graphic → data safety + content rating (answers in listing.md) → privacy URL
- [ ] 8. Upload .aab to CLOSED TESTING track → add ≥12 testers → run 14 continuous days (Google requirement for new personal accounts)
- [ ] 9. Tester invite message drafted & sent (Claude drafts when we reach this step)
- [ ] 10. Decide Supabase Pro ($25/mo) before public launch (free tier pauses after ~1 week inactivity)
- [ ] 11. Apply for production access → promote to production → LIVE
