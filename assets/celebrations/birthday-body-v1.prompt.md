# Birthday costume cutout v1

Generator: built-in `image_gen`, `transparent_background: true`.

Selected output: `/Users/jaeyoung5178/.codex/generated_images/01a1bf37-118d-7bc2-8875-5b9aa9b0a7b7/exec-628c7d28-d221-4a38-a0f9-fcc80afe08b6.png`.

The original is preserved as `birthday-body-v1-source.png`. Runtime WebP preserves the complete source alpha channel byte-for-byte. No human photograph or generated human identity was used. The second background-cleanup generation was not selected; no manual pixel or identity edits were applied.

## Selected generation prompt

Use case: stylized-concept. Asset type: production web-game birthday celebration character costume cutout with a PHOTO INSERT SLOT. Create one premium soft 3D plush chick-shaped birthday costume body, frontal view, full body, holding a beautiful small ivory birthday cake physically supported by both soft yellow wings/hands at chest/waist level. Delicate red berries, gold stars, three tiny lit candles. Warm ivory knitted winter cardigan with mint scarf and tasteful cranberry/gold cone party hat. Golden little chick feet clearly grounded, toes visible. Matches a cozy luxurious snowy Christmas garden with warm late-afternoon gold lighting and realistic plush fuzz, finely knitted wool, charming toy proportions, dimensional but polished, soft front-left studio light. CRITICAL: this is a FACELESS PHOTO-BOOTH COSTUME, NOT a complete chick identity. The entire central face region is a perfectly round genuinely TRANSPARENT ALPHA OPENING, not filled with black/white/gray, no checkerboard painted, no face, no eyes, no eyebrows, no beak, no mouth anywhere. A thick soft golden plush hood ring around that circular transparent opening naturally frames an actual human photograph to be inserted separately behind it by software. Do not create any human/person/photo. Canvas portrait 1024x1536; target aperture center x512 y360 radius190, outer head hood around x512 y360 radius260; party hat above hood top; cake center x512 y970; complete feet baseline x512 y1490; leave slim transparent margin around all edges. Only ONE costume body with its own cake/hat. Fully isolated transparent exterior and transparent circular face hole. No scenery, no snow floor, no ground shadow plate, no trees, no gift boxes, no background, no extra character, no text/logo/watermark. Keep full silhouette, physical wing grip under cake tray, cake cannot obscure face opening.

## Measured geometry supersedes requested coordinates

Actual canvas: 1024 × 1536. Actual transparent aperture bounds: x276–720, y371–802. The photo layer goes behind the costume at center (498,586), radius230; excess photo is covered by the opaque plush hood. Ground anchor: (512,1528). Cake center approximately (512,1040). Use the adjacent JSON manifest for normalized CSS geometry.

QA: center(500,585), exterior(40,1000), and corner(0,0) all alpha0. Opening flood-fill at alpha≤5 covers149,525 pixels and remains enclosed by the plush hood. Both feet and the cake tray are visible. No baked eyes, beak, mouth or person exists. Root visually approved the cream-background alpha preview on 2026-11-09.
