# Website

Customer documentation and the landing page live at https://learningharness.dev/.

`install-guide.md` is the source for `/install.md`. `doc-pages.mjs` generates the host and customer guides through `build-docs.mjs`. Authored assets live in `assets/`, and landing/thesis HTML in `pages/`. `build.mjs` stages them and builds customer documentation into ignored `dist/`.

Run `node --test website/test/*.test.mjs` for documentation, manifest and release policy checks. `node website/build.mjs` builds customer pages. Preparing or deploying downloads also requires approved immutable archives and release evidence; do not publish a source snapshot as an accepted package.

`release-readiness.json` is release metadata, not proof that every later source change passed. Current source validation limits are in `../docs/STATUS.md`. Keep old public download URLs and checksums intact during repository consolidation. Domain, hosting credentials and private publication evidence are managed by the maintainer and are not part of this source repository.
