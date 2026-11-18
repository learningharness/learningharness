# Security

LearningHarness is a local desktop plugin. Review the code, installers and hooks before enabling them. It runs with the local user's permissions; it is not an operating-system sandbox.

## Report privately

For a vulnerability, use GitHub's private vulnerability reporting when available. If it is not enabled, contact [arvindm1991](https://github.com/arvindm1991) to arrange a private channel. A public issue may request that channel, but must not include exploit details, private code, learner data or credentials. Private reporting must be enabled when the consolidated repository is published.

Include the affected version, host and OS, a minimal synthetic reproduction, expected boundary and observed impact. Please avoid real learner records and real access tokens. No response-time or bounty commitment is made.

## Boundaries to protect

- Correct chat identity and approved observation scope; no guessing a different active chat.
- Explicit user consent for hooks, observation, paid work and changes to settings.
- No automatic learner responses or context requests sent into the main coding conversation.
- Local learner memory, private model credentials and unrelated host configuration.
- Validation and isolation of generated learning content and interactive artifacts.
- Safe extraction, checksum verification, installation, update and rollback of packages.
- Bounded usage and accurate reporting of unknown or interrupted work.

Code, project content, host events and model output can be untrusted inputs. Generated content must not acquire host tools merely because it appears in the learning view. Read-only observation does not mean observed text can be trusted as instructions.

The normal model connection receives selected work and learner context; this is a disclosed part of the product. Anonymous usage metadata, when configured, is separate and can be disabled. Report unexpected disclosure or a consent bypass. Do not assume these intended data flows excuse an unreviewed leak.

This policy does not certify the software or exclude classes of vulnerabilities. Native host behavior and third-party services have their own boundaries and limitations. Current acceptance gaps are recorded in [status](docs/STATUS.md).
