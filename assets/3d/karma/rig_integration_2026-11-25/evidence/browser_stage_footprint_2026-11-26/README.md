# Rendered-footprint check (real index.html, headless Chrome, SwiftShader, wall clock, baseline fixture NOT FINAL, head 066eb31c + browser_stage.py patch)
browser_stage.py now also records window.__karmaStage.bounds() (Box3 of the rendered mesh, screen px) and its penetration into each card/text rect.
phone_run2: 19 samples, controller-box overlap while visible 0, rendered penetration while visible max 2.9 px (arm during wave), 54 px only in samples where she was HIDDEN (cover guard) after scroll back to 0.
A run of the same code before the patch showed one visible sample with 54.6 px rendered penetration: timing varies between wall-clock runs, so one run is not a statistic.
Single run per viewport; not a device.
