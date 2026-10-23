# Product discovery research evidence · 2026-10-22 LA

Decision document: [03_COMPETITORS_EVIDENCE](../../03_COMPETITORS_EVIDENCE.md).

This directory contains research evidence, not BackToIt runtime code. No upstream code is imported by the production extension or Detour prototype. No user tasks, account data, diagnoses, or interviews were collected.

## Auditable records

- `sources.json`: primary research URLs, reading depth, designs and limits. E5 direct PMC browser access hit a check; indexed full-text passages were available through web search. No challenge bypass.
- `repositories/*.json`: GitHub API metadata, fixed default-branch head, author/committer dates, full recursive tree. All five repositories were public and unarchived when checked. No post-observation future head date was found. UTC observations on Oct 23 correspond to Oct 22 in Los Angeles.
- `code-audit.json`: actual inspected files and claims not independently verified. Read with the pinned SHA; do not assume a later branch contains the same code.
- `neuroflow-runtime.json`: 3 passing functional assertions using the original unpacked extension, popup document opened as an extension tab. Native action popup and host switching untested. Input occlusion at 620px is also recorded; functional assertions do not certify visual quality.
- `resettle-fixture-runtime.json`: 3 passing assertions using original React components/styles/assets but synthetic Chrome messaging. This is NOT an installed extension test. The fixture uses existing React19 rather than upstream React18. Background scheduling, storage, notifications and real window close were not exercised.
- `screenshots/`: images actually captured and visually inspected. Each depicts synthetic research state.
- `evidence-verification.json`: 5 repository SHAs/file paths checked against pinned trees, 6 runtime assertions, 6 PNGs, and all local links from document 03 verified. Recheck with `node artifacts/product-discovery/research/verify-evidence.mjs`.

## Safety and reproducibility

The webapp-testing skill was read. The existing project Node Playwright/Chromium was reused instead of installing another runtime. Upstream files and package manifests were inspected before executing UI code. No upstream install/build/package/lifecycle script was executed; no global dependency was installed. The two MIT snapshots retain their LICENSE files locally. Unlicensed/AGPL competitor code was read through the GitHub connector and was not moved into product code.

Pinned downloads (excluded from git as generated third-party material):

| Archive | Pinned source | Observed SHA256 |
|---|---|---|
| `upstream/NeuroFlow.zip` | https://codeload.github.com/aminehabchi/NeuroFlow/zip/b6043dd8b56f2a4a77ffbcf547fb7633ca6ebc68 | `79EED3362198CACA710DDB3235891EF39D7CE286D30E9705D023321BE160E92E` |
| `upstream/resettle.zip` | https://codeload.github.com/cmarathe1/resettle-microbreak-extension/zip/029a9089c7a7fc6933ddaaf63fa90284ca135347 | `3564B0E74B3341378C04B4B61B2919C690B568A628E83F04EA25A0596AB28F42` |

Extract each archive under `upstream/NeuroFlow/` or `upstream/resettle/`, preserving its GitHub archive root folder. Audit files before execution. From `<repo>` with the existing dependencies/browser available:

```powershell
node artifacts/product-discovery/research/run-neuroflow.mjs
node artifacts/product-discovery/research/run-resettle-fixture.mjs
```

The first creates only `research/profiles/neuroflow` and clears that extension's synthetic localStorage on rerun. It does not open the user's browser profile. The second starts a localhost Vite source-component fixture, uses mocked runtime replies, records screenshots, and closes browser/server in finally. Its Vite import is pinned to the currently installed pnpm path; if dependencies change, update the research runner path after review. All profiles/downloaded snapshots/Vite caches are locally ignored. Tests use the project browser copy if present, otherwise Playwright's configured browser.

Execution history: initial NeuroFlow launch without explicit extension flags was blocked by Chromium; adding load-extension/disable-extensions-except for the reviewed source produced the recorded passing run. Initial Resettle runner had a wrong relative Vite import and did not execute; corrected path produced the recorded passing run. No functional claim is based on those failed attempts.

## Interpretation limits

These are engineering observations, not usability participants or evidence of ADHD benefit. A functioning click does not show improved recovery, and the synthetic Resettle state cannot verify its backend. README claims, code mechanisms, independent scientific evidence, and design hypotheses are kept separate in the decision document. Neither competitor was installed into the user's real Chrome profile. No marketing effectiveness percentages were adopted as BackToIt forecasts.
