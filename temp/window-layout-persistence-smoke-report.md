# Window Layout Persistence Smoke Report

Date: 2026-06-06
URL: http://127.0.0.1:5195/

## Result

Passed. Layout survived full page reload after merge and split docking. Scene canvas, Camera3 overlay, and Scene fullscreen/restore remained functional after hydration.

## Steps

1. Opened a clean dev origin on port 5195.
2. Brought Scene to the front and dragged the Scene tab into the Debug Log tabbar.
3. Reloaded the page and confirmed Debug + Scene restored as tabs in one frame.
4. Dragged Scene from the Debug frame into the left side of the Hierarchy frame content area, creating a split.
5. Reloaded the page and confirmed the split layout restored with a splitter and Scene canvas.
6. Clicked the Scene fullscreen button while Scene was docked in a split frame.
7. Confirmed fullscreen used a temporary Scene-only frame, not the mixed split frame.
8. Clicked restore and confirmed Scene returned to the previous split pane.

## Evidence

- Windows after split reload: 2
- Splitters after split reload: 1
- Canvas after split reload: {"height":298,"left":15.600000381469727,"top":74.4000015258789,"width":91.1875}
- Camera overlay after split reload: {"height":150,"left":-47.212501525878906,"top":96.4000015258789,"width":132}
- Fullscreen splitters visible in fullscreen frame: 0
- Restore splitters after exiting fullscreen: 1
- Console errors: 0

## Notes

The in-app browser evaluate sandbox did not expose localStorage directly, so storage contents could not be read from the smoke script. Persistence was verified by full page reload on the same origin preserving merge and split layouts.

The in-app browser tab did not expose a viewport resize capability in this session. The smoke ran in the available narrow browser viewport; no separate 390px mobile emulation was performed for this persistence-only step.
