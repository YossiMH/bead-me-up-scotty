# Configured launch memory check

Use `windows-configured-launch-host-memory-20261127.ps1` for the final configured
launch. It is an exact copy of the accepted `ed256f992d8398eb07f00d1991b1ee24245ce537ab2973222ca71efbd4dda51e`
helper, with three added lines at the start of `Check-Budget`.

The original helper checked 3 GiB immediately before launch and sampled total
owned resident memory and time. It did not check a live free-memory minimum.
The new copy calls its existing native `AvailablePhysical()` getter on every
budget check, retains the minimum observed value, and stops work below 1 GiB.
Its normal failure handling still reclaims only exact owned processes. Cleanup
continues even when free memory is low. No extra PowerShell process is added.

The new copy has SHA-256 `8db39140f935b690af58fc2c604ba7a0566945f7c4ea140d6f98637ead75c5ae` and 48,944 bytes.
The original remains unchanged. Reversing the exact three-line insertion produces
the original bytes and SHA-256. Product code, embedded declarations, process
ownership, deadlines, launch checks, port selection and edit/Exit assertions are
unchanged. The established limits remain a 128 MiB Node heap, 512 MiB aggregate
owned RSS, 3 GiB before launch, 120 seconds total and a 12-second cleanup reserve.

Use the same explicit port 43972 and fresh output directory
`F:\Dev\.bead-edit-20261111\configured-v9-final-20261125-1151`, with installed
`F:\Dev\bead-me-up-scotty\.scotty-local\bin\bead-0431a828bf95.exe` and SHA-256
`0431a828bf95038641a0c55b4cf11c5800b52881940a13bd2f56b02f0b27177a`.
Stage and hash-check this exact copy, then obtain a zero-error Windows PowerShell
5.1 AST parse before invoking its body in one hidden logged-in-session process.
The actual run still requires independent result and cleanup acceptance.

This change uses the existing root Riftri worktree
`/tmp/beads-2889282bfcec/continuation`. Future agents must retain its accepted
changes remotely and remove that clean worktree through Riftri without force
if this process ends early. Keep the private PC recovery copies and attempt
results available until final acceptance.
