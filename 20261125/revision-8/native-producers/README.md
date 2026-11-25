# Native checkpoint repair builds

These producers build `YossiMH/bead-rs` commit `c90f0cdbade93f9e9e6206e9a4d1999fa63afb1b`, tree `13e8f57a4de57819dfe3f13cc71f6078ac27bba7`. The source contains the accepted type-file change and two scoped Windows checkpoint fixes. Earlier 9ff release and test results remain historical evidence.

The Linux producer verifies the complete accepted commit chain and all nine changed-file hashes, then runs formatting, Clippy and complete default test compilation with one Cargo job. It retains the original generated man page and the reviewed one-space synopsis comparison. The unchanged archive build script produces the release. The full target bundle supports separate affected tests, the complete suite and original-corpus recovery.

The Windows producer uses the reviewed ordinary MSVC build path and the unchanged archive script. The fixed absolute `dumpbin.exe` lookup remains. It compiles the library and nine integration targets, including `checkpoint_publication_lock`. The resulting inventory contains eleven test/support executables and one separate release executable. Hosted runner teardown owns compiler descendants.

Windows outputs include a full cloud test artifact and a small release package containing only the release, its adjacent metadata, the producing build receipt and a manifest. A separate job downloads and verifies both packages. Its release-only receipt reports only the small package's files; it does not claim to verify test executables. PC staging can consume the small package after final qualification.

Each workflow is dormant until its exact reviewed commit is placed on its named activation branch. Producer success establishes compilation and artifact identities. Runtime tests, corpus recovery, independent final review and the guarded PC installation remain separate requirements.
