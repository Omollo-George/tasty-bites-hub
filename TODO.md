# TODO - Restaurant POS 3D Background

- [ ] Implement `Restaurant3DBackground.jsx` with React Three Fiber + Drei.
  - [ ] Transparent Canvas behind UI (pointerEvents none, z-index -1).
  - [ ] Procedural dark wood tables/chairs (low geometry complexity).
  - [ ] Warm ambient bokeh glow lights (no textures, minimal draw calls).
  - [ ] Floating dust particles using `InstancedMesh`.
  - [ ] Subtle fog/atmosphere with opacity tuned for menu readability.
  - [ ] Camera drift (side-to-side ~5° + zoom oscillation 0.98–1.02).
  - [ ] Color grading to match tailwind: bg-gray-900 -> slate-800 + orange-400 accents.
  - [ ] Performance comments + keep under ~30 draw calls.
- [ ] Provide integration snippet to wrap the existing menu grid behind the component.
- [ ] Provide npm install commands (idempotent) and how to use component.
- [ ] (After code) Run `npm run dev:client` and do quick smoke test in browser.

