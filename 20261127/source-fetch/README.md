# Fetch final source objects

The PC does not yet contain either final source commit. This helper fetches the
two exact reviewed commits sequentially from the user's forks, then verifies
the expected ancestry. It updates no branch or FETCH_HEAD. Explicit fetch
options suppress tags, submodules, commit-graph writing and automatic
maintenance; pack processing uses one thread.

Before each fetch, the helper requires the original HEAD and raw Git index. It
checks the 15 existing app files against the exact preservation manifest and
records Git HEAD/index/config/FETCH_HEAD, all refs, status, .env.local and the
old native pin. After fetching, it requires all recorded values to match.
Native source must remain clean. Installation performs its own fresh checks.

The source derives from the accepted Windows PowerShell 5.1 downloader. The
complete embedded Job inspector, retained child handles, priority management,
hard timer and final cleanup remain unchanged. The byte-stream runner changes
only its executable/name and prompt-disabling environment for Git. Seven base
functions are byte-identical; the memory sampler changes only two messages.
The four new helpers provide bounded Git reads and deterministic snapshots.

Limits remain 1 GiB free memory initially and during work, 512 MiB aggregate
resident memory, BelowNormal hidden execution, 168 seconds for work and 180
seconds overall. Each fetch has a 45-second deadline; each local Git read has
10 seconds. Output and error streams are bounded to 64 KiB. Git credentials and
raw errors remain outside the retained result.

Run only the reviewed exact file after Windows PowerShell parsing. The only
parameter is JobHelperPath, bound to SHA256
2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f.
Its fresh directory is
F:/Dev/.bead-edit-20261111/source-objects-v9-20261127-2889282bfcec;
the .claim and .supervisor siblings must also be absent. A failure retains all
attempt records and any fetched objects. Reconcile it before another action.

Acceptance requires connector exit zero, passed overall and both repository
records, verified ancestry and identical before/after states, no assisted
cleanup, no cleanup errors and no remaining owned processes. Source objects
alone do not indicate installation or branch publication.

This file belongs to the existing Riftri-managed continuation worktree at
/tmp/beads-2889282bfcec/continuation. After publishing exact bytes and preserving
any remaining work, remove the clean worktree through Riftri without force.
Future agents must finish that cleanup if this session ends early.
