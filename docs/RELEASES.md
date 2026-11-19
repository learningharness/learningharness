# Plugin releases and updates

Every push to protected `main` runs Linux and Mac checks. Only if both pass does the `publish` job build both host packages, inspect their archives and publish a GitHub release. No Firebase access, website deployment, cloud credential or model account is involved. The website is maintained separately.

## Version and source

The version is `1.0.0-beta.<1000 + Checks workflow run number>`. This avoids the earlier manually published beta numbers. A failed or cancelled run may leave a gap. Each package contains SOURCE.json and the install manifest records the exact source commit. Builds normalize archive timestamps and permissions. This is source traceability, not a claim of reproducible toolchains or signed binaries.

The install contract is the root install.md and the latest successful release’s install.json. The stable discovery URL is https://github.com/learningharness/learningharness/releases/latest/download/install.json . Artifact URLs pin a version and SHA-256. A release is created as a draft, all assets are uploaded, and only then is it published and marked latest. A newer main commit prevents an older run from moving latest backward. Existing files are compared and never overwritten on retries. Failed checks or failed uploads leave the previously published latest release available.

GitHub’s latest pointer selects regular releases. These entries are deliberately published as regular GitHub releases with beta version names and explicit public-beta/experimental channel metadata, rather than GitHub prerelease entries that the latest endpoint excludes. They do not claim stable/native acceptance or learning outcomes. Existing failed live evaluations remain documented in STATUS.md. Maintainer review of a main merge authorizes distribution; automated checks do not fabricate native or live evaluation evidence.

## Local verification

Run npm run test:release. To build without installing or publishing, set LH_CANDIDATE_VERSION to a fresh beta number and run node scripts/release/build.mjs. The public payload is artifacts/main-release/publish. This uses the configured public ingestion token under scripts/distribution, not a management credential. No learner data is packaged. Publishing requires GitHub’s job-scoped contents:write token, available only in the main push job.

## Updates and rollback

“Check for updates” reads the latest manifest and compares the matching installed host version. It does not install, downgrade a newer local candidate, reset preferences or restart an app. An explicitly requested update downloads the exact manifest-selected archive, checks its hash, preserves memory/settings and follows the normal restart and hook review process.

To roll back new installs, use gh release edit <known-good-tag> --latest after checking that release’s complete manifest/assets. Do not alter a published ZIP. Existing installations are changed only by an explicit local update. Old Firebase /downloads/ URLs remain historical immutable downloads, independent of new GitHub releases.
