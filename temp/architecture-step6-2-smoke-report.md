# Architecture Step 6.2 Camera3 Input Smoke

Date: 2026-06-07 local session.
URL: http://127.0.0.1:5182/

## Checks

- Camera3 mode label found: PASS.
- Real pointer click toggled projection mode from < Persp to || Iso: PASS.
- Camera3 actor-input log mentions camera3/projection-mode: PASS.
- Old buttons-zero fallback log absent: PASS.
- Old buttons-released cancel reason absent: PASS.
- Browser console errors: PASS (0).

Artifacts:

- Data: temp/architecture-step6-2-smoke-data.json
- Vite logs: temp/architecture-step6-2-vite.out.log / temp/architecture-step6-2-vite.err.log
