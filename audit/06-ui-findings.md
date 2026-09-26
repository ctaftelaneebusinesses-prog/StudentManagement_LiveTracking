# 06 — UI / Frontend Findings

**Browser-based UI QA was NOT performed.** Console errors, responsive layout, keyboard navigation, accessibility scans and loading/error states all need the app running against a backend with data (BLOCKED, see 00-baseline §9). The items below come from static review and the build.

| ID | Severity | Status | Finding |
|---|---|---|---|
| UI-01 | MEDIUM | LIKELY | Unsanitized `dangerouslySetInnerHTML` (see SEC-11) at `pages/portal/PortalExamsPage.tsx:150` and `pages/teacher/TeacherQuestionPapersPage.tsx:70` |
| UI-02 | LOW | CONFIRMED | 8.4 MB region-data chunk (PERF-01) slows the registration and profile forms on mobile |
| UI-03 | LOW | CONFIRMED (code) | `ProtectedRoute` is UX-only. It's correctly documented as such, and the backend enforces access |
| UI-04 | INFO | CONFIRMED (code) | Third-party Google Translate script loaded at runtime (`lib/googleTranslate.ts`). This is a supply-chain and CSP consideration |
| UI-05 | INFO | CONFIRMED (code) | 401s don't force a logout (`lib/axios.ts`), by design. The UI must show errors for failed requests. Not verified in the browser |

## To run once an environment exists (Playwright is available locally)
- Log in as each role, visit every nav item, and capture console errors and failed network requests.
- Check 360 px and 768 px viewports for overflow in the sidebar and data tables.
- Tab through the login, registration and key CRUD forms, and check focus traps in `Modal` and `Drawer`.
- Run an axe-core scan on the main pages.
- Check empty, loading and error states when the API returns 403 or 500.
