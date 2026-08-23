# Third-Party Notices

Steph Evo's Heaven Synth (Night Sky / Seven Heavens)

This document lists third-party software, models and resources actually used by
this application, with the license metadata read from the installed packages in
this repository. Versions refer to the resolved versions in the current lockfile.

Nothing in this file is a legal opinion. Items marked **VERIFY** require manual
confirmation before commercial distribution.

---

## 1. Machine-learning runtime and model

### @mediapipe/tasks-vision — 1.0.1 — Apache-2.0

- Declared in `node_modules/@mediapipe/tasks-vision/package.json`:
  `"license": "Apache-2.0"`, `"author": "mediapipe@google.com"`,
  homepage `http://mediapipe.dev`.
- Used by `src/core/tracking/provider.ts` and `src/components/GestureSynth.tsx`
  for hand-landmark detection (`FilesetResolver`, `HandLandmarker`).
- Attribution required: yes (Apache-2.0 §4 — copy of the license + NOTICE if
  the upstream distribution provides one).

Copyright notice (as published by the MediaPipe project):

```
Copyright 2019-2024 The MediaPipe Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

Privacy notice referenced by the package description:
<https://goo.gle/mediapipe-privacy>

### MediaPipe WASM runtime (loaded from CDN)

- URL used: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm`
- Files: `vision_wasm_internal.js/.wasm`, `vision_wasm_nosimd_internal.js/.wasm`.
- Same Apache-2.0 license as the npm package.
- **Note:** the runtime pinned in code is `0.10.14` while the installed npm
  package is `1.0.1`. For an offline/APK build these WASM files must be shipped
  locally and version-matched with the JS bundle.

### hand_landmarker.task (ML model)

- URL used: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`
- Publisher: Google / MediaPipe Solutions model garden.
- Model card & terms: <https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker>
- The bundle is distributed by Google as part of MediaPipe Solutions; the
  MediaPipe repository and model releases are published under Apache-2.0, and
  Google's model pages additionally reference the Google APIs / model terms of
  service. **VERIFY** the exact terms attached to the model card before
  bundling the `.task` file inside a redistributable APK or desktop app.
- No model weights are stored in this repository; the file is fetched at
  runtime from Google's CDN.

---

## 2. Runtime npm dependencies actually imported by application code

License values below are read from each installed package's `package.json`.

| Package | Version | License | Usage | Attribution required |
| --- | --- | --- | --- | --- |
| react | 19.2.8 | MIT | UI runtime | Yes (MIT notice) |
| react-dom | 19.2.8 | MIT | DOM renderer | Yes |
| @tanstack/react-router | 1.170.18 | MIT | Routing | Yes |
| @tanstack/react-start | 1.168.32 | MIT | App framework / SSR | Yes |
| @tanstack/react-query | 5.101.4 | MIT | Data layer | Yes |
| @mediapipe/tasks-vision | 1.0.1 | Apache-2.0 | Hand tracking | Yes (+ license copy) |
| lucide-react | 0.575.0 | ISC | UI icons | Yes (ISC notice) |
| tailwindcss | 4.3.3 | MIT | Styling | Yes |
| @tailwindcss/vite | 4.3.3 | MIT | Build-time CSS | Build only |
| tw-animate-css | 1.4.0 | MIT | CSS animation utilities | Yes |
| tailwind-merge | 3.6.0 | MIT | Class merging | Yes |
| clsx | 2.1.1 | MIT | Class helper | Yes |
| class-variance-authority | 0.7.1 | Apache-2.0 | Variant helper | Yes (+ license copy) |
| sonner | 2.0.7 | MIT | Toasts | Yes |
| vaul | 1.1.2 | MIT | Drawer primitive | Yes |
| cmdk | 1.1.1 | MIT | Command palette | Yes |
| embla-carousel-react | 8.6.0 | MIT | Carousel | Yes |
| input-otp | 1.4.2 | MIT | OTP input | Yes |
| react-day-picker | 9.14.0 | MIT | Date picker | Yes |
| react-hook-form | 7.83.0 | MIT | Forms | Yes |
| @hookform/resolvers | 5.5.7 | MIT | Form validation | Yes |
| react-resizable-panels | 4.12.2 | MIT | Resizable layout | Yes |
| recharts | 2.15.4 | MIT | Charts | Yes |
| date-fns | 4.4.0 | MIT | Date utilities | Yes |
| zod | 3.25.76 | MIT | Schema validation | Yes |
| @radix-ui/react-* (accordion, alert-dialog, aspect-ratio, avatar, checkbox, collapsible, context-menu, dialog, dropdown-menu, hover-card, label, menubar, navigation-menu, popover, progress, radio-group, scroll-area, select, separator, slider, slot, switch, tabs, toggle, toggle-group, tooltip) | 1.x–2.x | MIT | shadcn/ui primitives | Yes |

Many Radix packages come from the shadcn/ui component set present in
`src/components/ui/` and are tree-shaken out of routes that do not use them;
they are listed because they ship in the repository.

Build-only tooling (Vite, Rolldown/Nitro, TypeScript, ESLint, Prettier,
`@lovable.dev/vite-tanstack-config`, `vite-tsconfig-paths`) is not shipped to
end users and therefore does not require runtime attribution.

### shadcn/ui

Components under `src/components/ui/` are derived from shadcn/ui
(<https://ui.shadcn.com>), distributed under the MIT license by shadcn.
Copyright (c) 2023 shadcn.

---

## 3. Fonts

Loaded via Google Fonts `<link>` tags in `src/routes/index.tsx`,
`src/routes/night.tsx`, `src/routes/studio.tsx`:

| Font | Source | License |
| --- | --- | --- |
| Fraunces | Google Fonts | SIL Open Font License 1.1 |
| Manrope | Google Fonts | SIL Open Font License 1.1 |

OFL-1.1 requires the license text to accompany the font files when the fonts
are redistributed. For an offline/APK build the font files must be embedded and
the OFL text shipped alongside them.

---

## 4. Media assets

- No bitmap images, photos, audio samples or video files are bundled with the
  application. All visuals (sky gradients, sun, clouds, stars, constellations,
  particles, hand overlays, tutorial illustrations) are generated at runtime
  with Canvas 2D, SVG and CSS written for this project.
- All sound is synthesized in real time with the Web Audio API
  (`src/core/audio/*`). No sample libraries, impulse responses or recorded
  audio are used; the reverb impulse is generated procedurally with noise.
- `public/favicon.ico` — project asset; **VERIFY** origin if it was not created
  for this project.

---

## 5. License texts

Full license texts referenced above:

- MIT: <https://opensource.org/license/mit>
- ISC: <https://opensource.org/license/isc-license-txt>
- Apache License 2.0: <https://www.apache.org/licenses/LICENSE-2.0>
- SIL Open Font License 1.1: <https://openfontlicense.org>

For binary distribution (APK, desktop app, store listing), include:

1. This file (or a generated equivalent) in the app's "Licenses" screen.
2. The full Apache-2.0 text for `@mediapipe/tasks-vision`,
   `class-variance-authority` and the MediaPipe WASM/model files.
3. The full MIT and ISC texts with their copyright lines.
4. The OFL-1.1 text if fonts are embedded locally.
