# Development

Use Node.js 22.19+ and npm. From the repository root:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run test:desktop
npm run test:website
```

The default tests use synthetic contexts and local temporary directories. They do not require model credentials. Some integration tests use local sockets; run them in an environment that permits those sockets.

`npm run build` compiles the shared embedded app. Generated output, local archives, model responses and learner records do not belong in commits. Keep test fixtures synthetic. Use the existing formatter/style of a file; avoid unrelated formatting changes in a fix.

## Native checks and model-backed evaluations

Real Codex or Claude acceptance requires the corresponding installed host and a consenting account owner. Build and automated protocol checks are not substitutes for restarting the app, reviewing hooks, opening the view beside the correct chat and observing useful learning.

The historical internal evaluation runner remains in `scripts/evals` for reproducibility. It is a development tool, not a customer plugin mode. A live run consumes model allowance and requires explicit consent. Inspect the saved report, examples and failures before claiming a learning milestone. Passing fixtures alone does not demonstrate learning value.

Do not change data paths or clear learner history to obtain a fresh-looking screenshot. Use a separate synthetic environment. Existing users' memory and settings must survive updates.

## Packaging and release

Current packaging entry points are `scripts/package-native-codex.mjs` and `scripts/claude-release/package.mjs`. They build local candidates, not automatically approved releases. Do not use old development-preview packages as customer installers.

Retain the root MIT license and bundled third-party notices. Published binary URLs and checksums are immutable; use a new version for changed bytes. Release automation and repository settings still need maintainer setup during consolidation. Do not overwrite website packages or publish this development snapshot as beta63.
