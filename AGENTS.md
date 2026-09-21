# Project agents — codex-switcher-ko

Documentation convention: eerraa-agent-docs v2 at commit `4bd84f45dd3e970bf25505059431058efbe7680a` ([contract](https://github.com/eerraa/eerraa-agent-docs/blob/4bd84f45dd3e970bf25505059431058efbe7680a/AGENT_DOCS_CONVENTION.md), [adoption procedure](https://github.com/eerraa/eerraa-agent-docs/blob/4bd84f45dd3e970bf25505059431058efbe7680a/ADOPTION.md)). Consult the central documents only when changing this documentation system or its pinned revision.

## Korean fork contract

- Entry: `ko/README.md`; upstream baseline/version: `ko/upstream.json`; localization gate: `npm run i18n:check`.
- Scope is Korean presentation, localization checks, Windows release packaging, and explicitly reviewed platform-compatibility fixes intended for upstream. Keep compatibility commits separate from Korean copy; do not add independent product features or general refactors.
- Do not alter proxy/account/routing/auth semantics, user data, global toolchains, installed apps, or machine-wide settings unless the current task explicitly authorizes that product or operational change.
- Before an upstream sync, inspect the selected upstream commit diff and audit failures. Stable release tags can be ahead of `upstream/main`; do not infer the baseline from branch position alone.
- Preserve Chinese matching keys, narrow types, grouping values, regexes, logs, machine codes, and opaque user content. Translate only reviewed presentation boundaries.
- Run the transformed typecheck and relevant regression tests, not only upstream `tsc`. Accept `ko/reviewed-source.json` hashes only after reviewing the changed source; never auto-accept them in CI or merely to make checks pass.
- Do not run live-account smoke tests, install packages, publish PRs, push, tag, install the app, or operate a deployed process without explicit authorization for that action.
- `README.md` and `docs/*.md` are product/reference material. macOS app restart instructions, private LAN hosts, scp deployment, and an upstream author's personal `~/.claude` / `~/.codex` settings are not obligations for this Windows fork workspace and do not override this contract or the current user request.

## Start and route

Start from the actual repository root, branch, HEAD, status, and relevant dirty diff. Preserve unrelated user changes.

| Task | Contract / decision source | First source or data owner | Validation |
| --- | --- | --- | --- |
| Korean copy or presentation boundary | `ko/README.md` — structure and terminology | `ko/catalog.json`, `ko/backend.json`, `ko/policy.json`, then `ko/source.mjs` / `ko/transform.mjs` | `npm run i18n:check` |
| Upstream sync or source-review drift | `ko/README.md` — upstream sync | `ko/upstream.json`, selected upstream diff, `ko/review.mjs` | source review, `npm run i18n:check`, then only impact-relevant build/tests |
| Platform compatibility fix | `ko/README.md` — scope and validation boundary | failing platform path plus `scripts/windows-compat.test.mjs` / `scripts/windows-ui-smoke.mjs` where applicable | targeted compatibility test; broader native checks only when affected |
| Windows release preparation | `ko/README.md` — deployment and validation boundary | `ko/build-windows.mjs`, `ko/tauri.windows.json` | release checks/build only when the task authorizes them; artifact publication is separate |

Implementation facts belong to current source and tests. Keep documentation compact; do not add patch diaries, code walkthroughs, copied trees, test-count ledgers, or per-change history comments.

For documentation-only changes, run the relevant document/link checks that exist plus diff/whitespace review. Do not require a full product build or hardware/live-account validation unless the changed contract actually affects them.
