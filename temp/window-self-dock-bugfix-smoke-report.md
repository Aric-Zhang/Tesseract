# Window Self-Dock Bugfix Smoke Report

Date: 2026-06-09

Status: passed.

Target: `http://127.0.0.1:5190/?resetWorkspaceLayout=1`

## Scenarios

- Root Scene tab dragged into its own content edge.
- Floating Debug Log tab dragged into its own content edge.

## Result

- Scene tab count after root self-dock attempt: 1.
- Debug Log tab count after floating self-dock attempt: 1.
- Browser console errors: 0.

## Notes

This smoke verifies that single-tab self-dock attempts do not duplicate the
same `viewActorId` into multiple rendered tabsets. Unit coverage in
`ui-framework` now also locks the dock tree reducer, preview resolver, and
lifecycle commit validation paths.
