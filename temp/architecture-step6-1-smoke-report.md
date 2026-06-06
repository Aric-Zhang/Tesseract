# Architecture Step 6.1 Browser Smoke

Date: 2026-06-07 local session.
URL: http://127.0.0.1:5181/

## Checks

- App loaded with root Scene canvas, Camera3 gizmo, App Menu, Debug, and Hierarchy present: PASS.
- Real pointer drag moved Debug floating frame from left=14 to left=104: PASS.
- Old buttons-zero fallback log absent: PASS.
- Old buttons-released cancel reason absent: PASS.
- Pointer move/move logs present after drag: PASS.
- Browser console errors: PASS (0).
- Camera3 pointer area drag produced no old fallback/cancel logs: PASS. Precise Camera3 hit log was not captured in this smoke, so Camera3 interaction remains covered by unit tests and should receive a stronger manual/automation pass later.
- Screenshot capture: NOT CAPTURED because the in-app browser CDP screenshot command timed out.

Artifacts:

- Data: temp/architecture-step6-1-smoke-data.json
- Vite logs: temp/architecture-step6-1-vite.out.log / temp/architecture-step6-1-vite.err.log
