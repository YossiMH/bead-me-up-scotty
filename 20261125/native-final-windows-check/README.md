# Final native Windows execution

This packet executes the retained source and binaries from the successful continuation of the original archive release. It does not compile Rust. Final activation requires the measured producer artifact and build-result hashes in `check-inputs.json`, a bound `packet.json`, two final author inspections and independent review.

The existing Job helper, PowerShell supervisor/driver, Python process/source utility module and portable corpus verifier are retained unchanged from the accepted prior packet. The utility file keeps its historical build filename; only its shared validation, source extraction and process-execution definitions are imported. Its old build main is never called.

The checker validates every downloaded file against the producer manifest, reconstructs the original source and executable paths, checks the exact release version/capability/help, runs three staging unit tests and all eight integration targets with one test thread, then performs the four original-corpus restores and unchanged 55-command smoke. It checks all eleven type-file tests explicitly. Actual test execution and final source/byte preservation are retained separately from build results.

All work occurs on a disposable hosted Windows runner. The unchanged outer Job owns child processes; the unchanged supervisor and driver verify quiescence and completion. Keep all failed attempts. The root agent owns PC installation and native task state.
