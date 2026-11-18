# Desktop runtime

Current local service, host bridge, hook coordination and embedded app entry point shared by the desktop integrations. Shared presentation components live in `packages/ui`.

Build the app with `npm run build`. Run the desktop fixture tests with `npm run test:desktop`. Portable customer installers are built by the host release scripts, not by a developer-checkout preview.

These tests do not establish native host rendering, fresh-user installation or learning value. See `docs/DEVELOPMENT.md` and `docs/STATUS.md`.
