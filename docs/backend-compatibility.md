# Backend compatibility

Scotty supports separate original Beads (`bd`) and native bead-rs (`bead`)
projects. The backend belongs to each registered project; a missing selection
means original bd. Selecting a backend does not convert between implementations
or initialize missing data. Registering or opening a native project runs the
selected CLI, which can upgrade an older native schema and change SQLite journal
or sidecar files. Add only stores already known to be current and compatible with
that exact executable. Review and explicitly approve any migration of an original
store before opening it.

## Versions and installation

| Backend | Compatibility target | Executable setting |
| --- | --- | --- |
| Original Beads | `bd` 1.1.0 | `BD_BIN`, or `bd` on `PATH` |
| Native bead-rs | [commit `bf2aa10b5bb36898a8f7f73e60b3b61de9a4a2ec`](https://github.com/jedarden/bead-rs/tree/bf2aa10b5bb36898a8f7f73e60b3b61de9a4a2ec), reporting 0.3.0 / `native-v1` | `BEAD_BIN`, or `bead` on `PATH` |

Native v0.2.6 is unsupported: it lacks the required comments, complete-list and
JSON-document interfaces. A 0.3.0 version string alone does not identify the
tested source. Use the pinned commit and retain its build metadata. Scotty checks
the public capability document and workspace identity, not the executable's hash.
Later bead-rs revisions need separate qualification.

### Use a local bead-rs fork on Windows

Select the executable explicitly when another `bead` is installed on `PATH`.
From the Scotty checkout, for a sibling `bead-rs` checkout with an existing debug
build:

```powershell
npm ci
npm run build
node .\bin\bead-me-up-scotty.mjs --bead-bin ..\bead-rs\target\debug\bead.exe --host 127.0.0.1
```

`--bead-bin` takes a file path, resolves relative paths from the folder where the
command was invoked, and overrides `BEAD_BIN` for the launched server. It does
not install or replace an executable. In Add a project, select **bead-rs**.

For an independent local installation, `.env.local` can hold absolute paths:

```dotenv
BEAD_BIN=F:/Dev/bead-me-up-scotty/.scotty-local/bin/bead-376537b7917f.exe
XDG_CONFIG_HOME=F:/Dev/bead-me-up-scotty/.scotty-local
```

For this already configured clone, launch from `F:\Dev\bead-me-up-scotty`:

```powershell
node .\bin\bead-me-up-scotty.mjs --host 127.0.0.1 --port 3000 --no-open
```

Open the printed URL, then use **Add project**, choose **bead-rs**, and enter the
repository root containing `.beads`, rather than the `.beads` directory itself.
Existing process environment settings take precedence over `.env.local`.

This keeps this clone's project registrations and native claim credentials in
its ignored `.scotty-local/` directory. Existing Scotty registrations remain in
their previous configuration directory. Launching this clone starts at its own
project picker; use **Add project**, choose **bead-rs**, and select an initialized
workspace already known to be compatible with the selected executable. Adding a
project opens that workspace through the selected CLI; it does not copy its data.
Qualification runs capability and snapshot commands. Normal native commands can
upgrade older schemas, including through a command's pre-dispatch connection;
backend selection is not a no-migration mode. The compatibility tests use newly
initialized disposable workspaces. Older original stores require a separate
safe-access and migration decision before registration.

This installation pins a copy of the tested fork binary at the path above,
with a neighboring provenance receipt and SHA-256. It does not follow future
fork rebuilds. A development `target/debug/bead.exe` can be replaced by another
build while Scotty is running; qualify a new binary on disposable data before
replacing the local pin or selecting it with `--bead-bin`.

On this Windows host, the configured F: pin now passes the full real-store tests
and headless browser registration, issue display, API create and CLI readback on
fresh F: Git workspaces. The current checkpoint's referenced files were staged
with matching bytes, while an unrelated file stayed unchanged and untracked.
The clone's `.env.local` defaults were also tested without `--bead-bin`; cleanup
leaves an empty clone-local project registry. After the user-approved Windows
Medium integrity-label repair, the unchanged executable passed the ordinary C:
Git-native suite and the C: headless browser's application checks. The browser
controller initially failed its five-second exit observation for two owned
headless-browser children despite an empty Job; a later identity check confirmed
both had exited. The original result and that reconciliation are retained. The
browser checks used an existing isolated Playwright headless browser. Earlier
failed fixtures are preserved. These results do not qualify original stores;
no existing live store was opened.

The local Windows binary tested with this checkout has SHA-256
`376537b7917f18d33383a3e4bd3eb9e0955bb42d1a60b73aef5c81865662af28`.
Its public contract reports 0.3.0 / native-v1 with array list output and object
show/create output. The tests exercise complete listing, creation, comments,
labels, dependencies, closing, reopening, assignment and release using a fresh
disposable store. The binary hash identifies the tested file; the checkout's
Git revision does not establish that file's build provenance.

To check another local binary, set `BEAD_BIN` and `SCOTTY_TEST_ROOT` to absolute
paths, with the test root outside both source repositories. Set `HOME`,
`USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `XDG_CONFIG_HOME`, `TEMP` and `TMP` to a
disposable home before running `npm run test:bead-rs:local`. The browser check
uses `npm run test:bead-rs:browser` after a production build; optionally set
`SCOTTY_TEST_CHROME` to an installed isolated Playwright Chromium or headless-shell
executable. It launches a separate
browser session and verifies that the CLI flag overrides an invalid inherited
`BEAD_BIN`. Keep tests under an owned process controller on Windows so its
entire server process tree is reclaimed on exit.

Build Scotty from this checkout with `npm ci` and `npm run build`, then start it
with `npm run serve`. The upstream v0.3.2 release predates this adapter. The
Dockerfile bundles only bd; native mode in Docker is not qualified. The native
build procedure below uses Linux shell tools; it has not been qualified on
macOS or Windows.

### Build the native CLI

The qualified Linux build uses Rust 1.99.1, Cargo, Git, Bash, Python 3 and GNU
utilities. Install those prerequisites separately if needed. The upstream build
script requires at least 5 GiB free under `$HOME/scratch` and downloads locked
Cargo dependencies. It builds an archive of the requested commit without changing
the source checkout's HEAD, index or stash.

```sh
git clone https://github.com/jedarden/bead-rs.git
cd bead-rs
git cat-file -t bf2aa10b5bb36898a8f7f73e60b3b61de9a4a2ec
scripts/build-from-archive.sh bf2aa10b5bb36898a8f7f73e60b3b61de9a4a2ec \
  --name bead-scotty-bf2aa10 --out "$HOME/.local/bin"
"$HOME/.local/bin/bead-scotty-bf2aa10" --version
```

The script runs `cargo build --release --locked` with default features and refuses
to overwrite an existing pin. Keep the adjacent `.metadata.json`: archive builds
report commit `unknown`, while that file records the source commit and binary
hash. The qualified binary reported
`bead 0.3.0 (unknown 2026-10-20T06:48:57Z)` with SHA-256
`9a934a834b01c50d6211f19fff9eee9a436152e3ba51ead6947c535f13158e16`.
Build timestamps change the hash, so a fresh build is not expected to reproduce
those bytes. See the pinned [upstream build procedure](https://github.com/jedarden/bead-rs/blob/bf2aa10b5bb36898a8f7f73e60b3b61de9a4a2ec/BUILD_PROCEDURE.md).

### Add a native project

Use an existing initialized native workspace. For a new project only, run
`"$HOME/.local/bin/bead-scotty-bf2aa10" init --prefix <project-prefix>` in its
intended directory, replacing `<project-prefix>` with the project's ID prefix.
Do not run `bd init` over native data, or initialize either tool over an existing
store to resolve an error.

Start Scotty from its own checkout, not from the native project:

```sh
BEAD_BIN="$HOME/.local/bin/bead-scotty-bf2aa10" \
POSTHOG_KEY='' npm run serve
```

Open **Add a project**, choose **Backend → bead-rs (bead)**, then select the
directory containing that workspace's `.beads`. `BEADS_REPO` and legacy
registrations retain original-bd selection; they do not select native mode.
If the folder is already registered as bd, remove its registration and add it
again with bead-rs. Removing a registration leaves the issue store in place.

`BD_BIN` remains independent and can be set alongside `BEAD_BIN`. Do not point
`BD_BIN` at `bead`: the tools have different commands and formats. A missing
executable, unsupported contract or wrong workspace produces an error rather
than switching backends or showing demo data. Choose the Demo project explicitly
to use its in-memory dataset.

## Native workflow

Board, List, Focus, the detail drawer and the dependency graph use native records.
Reads request all issues and comments, including resolved comments, and join
issue type and close metadata through the public query interface. **Ready**
comes from bead-rs's ready query. Assigned or otherwise ineligible open work is
shown in **Open**, rather than being presented as ready.

| Action | Native behavior |
| --- | --- |
| Create | Title, description, priority, type, assignee and initial labels; start-in-backlog uses one manifest transaction |
| Edit after creation | Status and assignee only; title, description, priority and type are immutable |
| Close | Requires a nonblank reason, retained with the completion time |
| Reopen or release | Reopen closed work before other edits; moving in-progress work to open releases it |
| Start | Move deferred work to open first; starting unassigned work assigns it to the configured actor |
| Comments | Create and display native comment text and recorded author |
| Labels | Add or remove one label per action; no replace-all or clear-all action |
| Dependencies | Exact native kinds `blocks`, `relates_to` and `verifies`; removal identifies the edge kind |

Status and assignment changes respect native revisions and ownership. Scotty
retains credentials only for claims it acquired itself, under
`$XDG_CONFIG_HOME/bead-me-up-scotty/native-claims` (default
`~/.config/bead-me-up-scotty/native-claims`). It does not adopt a visible token
from another process. If the original holder owns a protected claim, that holder
must release it with its original credential. Keep Scotty's configuration
directory private and preserve it across restarts.

Native projects cannot delete or archive issues, edit checklists or descriptions,
create parent-child hierarchy or human approval gates, run Refine with AI, upload
or serve attachments, or publish a site. These actions are unavailable in the UI
and rejected by the API. Native issue creation authorship is unavailable, so
Scotty does not infer an origin badge or offer creation-attribution analytics,
including Activity, Insights and Achievements. Comment authorship remains visible.
Original bd and Demo keep their existing operations.

### Label API and concurrency

Native projects expose `POST` and `DELETE` at
`/api/p/:projectId/beads/:id/labels`, accepting exactly `{"label":"name"}`.
Each request runs one public native label add or remove command. Blank labels,
extra properties and combined edits are rejected before a subprocess.
`PATCH` with a `labels` property is unsupported, including an empty array or a
body that also changes status. Original bd and Demo keep their existing label
replacement route.

An individual delta preserves unrelated labels. It is not an issue-revision
compare-and-swap or a fenced claim operation. Another writer can change the same
label before or after it; refreshed data represents the current state, not a
frozen label set. The pinned native service records label events as `system`,
not as Scotty's configured human actor.

### Live refresh

Native live notifications watch the public `.beads/checkpoint/` publication
directory, not the SQLite/WAL/SHM files touched by native reads. Successful
automatic checkpoint publication triggers refresh without a read/refetch loop.
If publication is suppressed, fails, or the checkpoint directory is unavailable,
the configured fallback refresh interval still discovers committed changes.
Original `bd` keeps its existing top-level `.beads` watcher.

### Write errors and refresh

A native command can commit before receipt parsing, readback, local credential
storage or checkpoint handling fails. An error is not evidence of rollback.
Scotty distinguishes `mutation_committed` from `mutation_uncertain` and retains
available issue/comment IDs. Do not resubmit a create or comment just because
the response failed. Use **Refresh without resubmitting** and inspect the
identified record. An unknown outcome remains unresolved until read-only checks
establish what happened.

Native reads reject malformed or inconsistent output rather than returning an
empty board. A snapshot read makes up to three attempts if the workspace changes
during the read. Commands have a 60-second timeout and a 32 MiB output bound;
exceeding either is a failure, not a partial successful result.

## Checkpoints and source updates

bead-rs normally publishes local checkpoint files after successful writes and
may stage them in the workspace's Git index. Staging is not a Git commit or push,
but a later commit can include issue content. Inspect `git status` and the staged
diff before committing. Keep test workspaces outside Scotty's source tree, and
do not include private issue data, local configuration or claim credentials in
a source contribution. Scotty does not change the native auto-flush or auto-stage
settings. See the [native checkpoint staging contract](https://github.com/jedarden/bead-rs/blob/bf2aa10b5bb36898a8f7f73e60b3b61de9a4a2ec/docs/adr/018-auto-stage-published-checkpoint-fileset.md).

Scotty's own repository tracks issues locally under its existing
[repository rules](../AGENTS.md). Adding this adapter does not authorize syncing
that data. Keep the original MIT notice, attribution and design assets when
redistributing the source.

For a fork or unreadable/different `origin`, in-app upstream updates are disabled
before release discovery or fetch. Update manually from your chosen fork, inspect
the source changes, then run `npm ci` and `npm run build` and restart. Pointing
`origin` back at upstream removes that fork safeguard.

## Verification

Run checks from the Scotty checkout. Node 24.19.0 and npm 11.9.0 were used for
qualification. The unit tests use explicit subprocess doubles and do not prove
real CLI or browser behavior.

```sh
export POSTHOG_KEY='' NEXT_TELEMETRY_DISABLED=1
export BD_DISABLE_METRICS=1 BD_DISABLE_EVENT_FLUSH=1
export SCOTTY_TEST_ROOT="$(mktemp -d /tmp/scotty-backends.XXXXXX)"
node --test scripts/test-backend-contract.mjs \
  scripts/test-native-mutations.mjs scripts/test-native-ownership.mjs \
  scripts/test-native-route-guards.mjs scripts/test-native-label-revision.mjs \
  scripts/test-native-label-deltas.mjs scripts/test-native-mutation-outcomes.mjs \
  scripts/test-native-credential-tenures.mjs scripts/test-native-ui.mjs \
  scripts/test-native-graph-kinds.mjs scripts/test-native-label-ui.mjs \
  scripts/test-native-ui-outcomes.mjs scripts/test-beads-watch.mjs
node scripts/test-fork-updates.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run lint
npm run build
git diff --check
```

The integration runner requires absolute executable paths and a production build.
It creates a fresh Git workspace and isolated HOME/config inside
`SCOTTY_TEST_ROOT`, starts its own server and stops it after the checks. Run the
backends sequentially with port 3196 free. Browser checks require Playwright
Chromium installed separately; the runner does not install it.

```sh
BD_BIN=/absolute/path/to/bd SCOTTY_TEST_PORT=3196 \
  node scripts/test-backend-integration.mjs bd --browser
BEAD_BIN=/absolute/path/to/bead-scotty-bf2aa10 SCOTTY_TEST_PORT=3196 \
  node scripts/test-backend-integration.mjs bead-rs --browser --native-ui
```

The runs retain `evidence.json`, server output, workspace fingerprints and browser
artifacts in their new fixture directories. Native UI recovery tests forward the
write to the real server, then inject a failed response; they check client
reconciliation, not native checkpoint failure. Keep those results distinct from
unintercepted CLI/API/browser checks.

## 2026-11-11 editing and Windows tray work

Development is running in cloud linked Git worktrees created through Riftri.
The PC source and native checkpoints remain preserved. If the session stops,
inspect these directories and branches before resuming or removing anything:

- `/workspace/scratch/51bd923093d4/worktrees/bead-editing`: `feat/bead-editing-20261111`
- `/workspace/scratch/51bd923093d4/worktrees/bead-pinning`: `feat/bead-pinning-20261111`
- `/workspace/scratch/51bd923093d4/worktrees/scotty-editing`: `feat/scotty-editing-20261111`
- `/workspace/scratch/51bd923093d4/worktrees/scotty-tray`: `feat/scotty-tray-20261111`

Check Git status and remote commits before cleanup. Preserve any uncommitted or
unpublished changes. From the appropriate repository, use
`/workspace/scratch/51bd923093d4/tools/node_modules/.bin/riftri exec -- git worktree remove PATH`
with the exact listed directory, without force. The cloud filesystem does not
permit copy-on-write mounts; Riftri forwards these commands to ordinary linked
Git worktrees. The final update will record removal.

Backend source starts at `afac9fa0ce9533a707d745018d16a25e4ccff492` from
`YossiMH/bead-rs`. Scotty's existing local source was preserved at
`55f17568be93442abc6e4725d3e159448e0c9ab5` before new code. Only the backend's
verified native checkpoint is being restored into the isolated cloud checkout
for task coordination. Scotty's machine-local task data stays on the PC.
