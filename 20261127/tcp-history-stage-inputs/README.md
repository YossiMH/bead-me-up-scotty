# TCP and history input staging

Root owns the Windows calls. Run the fixed commands in this order:

1. Review and execute `stage-tcp-inputs-command.json` once. It stages the three accepted TCP files from commit `cf462e43a1012a75112d943bb17edc84c35b8e67` into the existing final-installation directory. Expected payload: 62,254 bytes.
2. Reconcile all three exact readbacks, then run `parse-tcp-and-history-command.json`. Its ordinary Windows PowerShell 5.1 child parses those three files plus the two already staged CRLF supervisors. Require a successful child and all five zero-error file records; a waiting-for-memory response is a deferral.
3. Proceed with root's separately reviewed configured launch. Stage the six history receipts using `stage-history-receipts-command.json` after that launch has ended. Expected payload: 45,412 bytes. This command can create only the absent final `checkpoint-only-inputs` leaf beneath the existing coordination revision-9 directory.

The readable sources and exact command strings are bound in `author-checks.json` and `static-checks.json`. Downloader commands use Node64, BelowNormal priority, no children, a 1 GiB free-memory floor, 128 MiB own-RSS checks, 60-second total and 20-second absolute request timers, exclusive writes and exact byte/hash readback. The parser retains root's Node64 parent, 2 GiB admission floor, hidden BelowNormal PS5.1 child, 20-second timeout and 32 KiB child output limit. Actual staging and Windows parsing remain separate execution receipts.

Both downloaders refuse existing target entries and redirected or nonregular ancestors. They preserve partial results. After a failure or timeout, inspect every fixed destination and retain the result before proposing a narrowed remaining transfer; do not replay the full command blindly. No cleanup is performed by these commands.

No worktree was created for this small packet. Preserve the exact source and actual results in the transfer history before cloud cleanup. The PC staged sources and six receipts remain inputs to subsequent reviewed execution and should be removed only through the final exact cleanup inventory.
