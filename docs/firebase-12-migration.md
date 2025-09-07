# Firebase 12.x Migration Plan

## Objectives

Upgrade from Firebase 10.x to 12.x to eliminate remaining moderate vulnerabilities (primarily via `undici`) and stay current with SDK improvements.

## Current State

- Using modular SDK (v10.13.x) via selective imports in `src/firebase/config.js`.
- No direct usage of compat API in app code; only modular functions.
- Aggregation/report logic relies on Firestore, Auth, Storage, Functions.

## Key Breaking Changes to Review (Preview)

1. Auth: Token / persistence API minor adjustments (verify no removed symbols).
2. Firestore: Ensure any deprecated field conversions or snapshot metadata usage still valid.
3. Functions: If using callable functions ensure signature unchanged.
4. Storage: Check upload / metadata API remains same.
5. Removal of legacy compat shims if any implicit usage (we appear not to depend on them directly).

(Consult official release notes once 12.x GA docs are available.)

## Migration Steps

1. Create branch: `chore/firebase-12-upgrade`.
2. Bump dependency: `firebase` to `^12.2.1` (or latest stable 12.x).
3. `npm install` and run build to surface breaking compile errors.
4. Run test suite (`npm test`). Add targeted tests if gaps (Auth init, Firestore read/write, Storage upload mock, Functions call).
5. Manual smoke:
   - Sign in flow (email/password or provider) still works.
   - Firestore queries for submissions and courses return data.
   - File upload (if present in UI) succeeds.
   - Research report still aggregates (progressive fetch unaffected).
6. If any deprecated warnings, adjust imports (prefer explicit sub-package imports).
7. Re-run `npm audit --production` to confirm vulnerability reduction.
8. Update docs: `README.md` note new minimum Firebase version.
9. Create PR with summary + audit diff.

## Rollback Plan

If unexpected runtime issues occur:

- Revert to tag created before upgrade (create a tag now: `pre-firebase12`).
- Reinstall with old lock file.

## Post-Upgrade Hardening

- Consider enabling Firestore persistent cache (if not already) with size limits.
- Reassess bundle size: dynamic imports may change tree-shaking patterns.

## Open Questions

- Are there any hidden compat dependencies transitively pulled? (Check build after removal.)
- Should we adopt Firebase App Check at the same time? (Optional security enhancement.)

## Acceptance Criteria

- All tests pass.
- No TypeScript/ESLint errors introduced (JS project but watch for runtime warnings).
- Build succeeds without increased bundle size > +20KB gzipped.
- Audit shows fewer total vulnerabilities (especially undici-related paths resolved).
