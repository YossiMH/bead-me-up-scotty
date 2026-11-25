#!/usr/bin/env python3
"""Reconcile exact retained full-suite text; never invoke product code or tests."""
import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath

PINS = {
    'result.json': 'fdfa1a269d7add294a7edd8a73927a908211c2617bb19e981a0b4f7e1d8d362a',
    'logs/cargo-full-suite.stdout': '860a15585ba2ff6f52ba7a56486ef7e60b9429651d93e2ac98643fdc58ddfaee',
    'logs/cargo-full-suite.stderr': '05e2a706f406b6fa6da750d04e0d7189e6c382b24120c88758ed860336b0b9d2',
    'executables-before.json': '22d8c8144f4d7b3a5d60da1abfa0b50a5ab25b4a2863be79b1ebe74a211f0a57',
    'executables-after.json': '0cfd9da9d1119718ebcf3c5d00ba80c8cc2d9ca76a05091437db81bd5d02c387',
    'environment-corrections.json': 'c768aaf5d9b42064b65281e758a5edf131438eb11d7bdd947e7cb9642621c124',
}
BUILD_SHA = '384000475ed36cf748ed952c9cc2952d3d978928a5433e51c01a1eef6ce389fd'
CONFORMANCE_SHA = '20fd293a3484c689e70a02f2c162508a3d7a1bda9eecf142fdb8ea2fefc736f2'
EXPECTED_NEW_TESTS = {
    'service::checkpoint::set_v2::tests::set_v2_staging_counts_attempt_outcomes_across_shards',
    'service::checkpoint::set_v2::tests::set_v2_staging_rejects_duplicate_attempts_within_a_shard',
    'service::checkpoint::set_v2::tests::set_v2_staging_rejects_duplicate_attempts_across_shards',
    'verified_restore_preserves_all_attempt_outcomes_from_set_v2',
    'selected_set_v2_generation_remains_restorable_after_tail_append',
    'legacy_fixed_tail_generation_remains_restorable_after_upgrade',
}
MULTILINE_TESTS = {
    'set_v2_green_scenarios_under_out_of_band_change': 2,
    'set_v2_oversize_record_once_cost': 1,
}
EXPECTED_IGNORED = {
    'cleanup_test_binaries',
    'integration_test_attempt_resolution_build_capabilities',
    'integration_test_capability_framework_integration',
    'integration_test_command_availability_across_variants',
    'integration_test_compare_binary_variants',
    'integration_test_default_build_capabilities',
    'all_blocking_sweeps_identical_secrets_across_duplicate_issues',
    'every_redaction_record_round_trips_through_sharded_restore',
}


def require(value, message):
    if not value:
        raise RuntimeError(message)


def read_exact(path, expected):
    require(path.is_file() and not path.is_symlink(), 'Regular evidence file required')
    data = path.read_bytes()
    require(len(data) <= 1024 * 1024 and hashlib.sha256(data).hexdigest() == expected,
            'Retained evidence differs: ' + str(path))
    return data


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate JSON key')
        result[key] = value
    return result


def decode(data):
    return json.loads(data, object_pairs_hook=unique_object)


def parse_results(stdout, stderr, build):
    build_root = PurePosixPath(build['build_root'])
    source = PurePosixPath(build['source_root'])
    mapping = {str(build_root / row['path']): key.removeprefix('harness:')
               for key, row in build['executables'].items() if row['test_harness']}
    require(len(mapping) == 144, 'Expected all144 accepted default harnesses')
    executed, docs = [], []
    for line in stderr.splitlines():
        if re.match(r'^\s*Running ', line):
            match = re.search(r'\(([^()\r\n]+)\)\s*$', line)
            require(match is not None, 'Unrecognized Cargo target execution line')
            path = PurePosixPath(match.group(1))
            if not path.is_absolute():
                path = source / path
            require('..' not in path.parts and str(path) in mapping
                    and mapping[str(path)] not in executed, 'Unknown or repeated test harness')
            executed.append(mapping[str(path)])
        match = re.match(r'^\s*Doc-tests\s+(\S+)\s*$', line)
        if match:
            docs.append('doctest:' + match.group(1))
    require(set(executed) == set(build['default_harnesses']), 'A default test harness did not execute')
    require(docs == ['doctest:bead_rs'], 'Default library doctests did not execute exactly once')
    summaries = list(re.finditer(
        r'(?m)^test result: (ok|FAILED)\. (\d+) passed; (\d+) failed; (\d+) ignored; '
        r'(\d+) measured; (\d+) filtered out; finished in [^\r\n]+$', stdout))
    starts = list(re.finditer(r'(?m)^running (\d+) tests?\r?$', stdout))
    require(len(summaries) == len(starts) == 145, 'Incomplete target summary coverage')
    doc_groups = len(summaries) - len(executed)
    target_order = executed + ['doctest:bead_rs:' + str(index + 1) for index in range(doc_groups)]
    targets, multiline = [], []
    all_passed_names, all_ignored_names = set(), set()
    previous_end = 0
    for index, (start, summary) in enumerate(zip(starts, summaries)):
        require(previous_end <= start.start() < summary.start(), 'Test output blocks overlap')
        passed, failed, ignored, measured, filtered = (int(summary.group(i)) for i in range(2, 7))
        require(summary.group(1) == 'ok' and failed == measured == filtered == 0,
                'A complete-suite target failed or was filtered')
        require(int(start.group(1)) == passed + ignored, 'Target running count differs')
        body = stdout[start.end():summary.start()]
        names = re.findall(r'(?m)^test (.+) \.\.\. (ok|ignored(?:, [^\r\n]+)?)\r?$', body)
        # The two observed existing tests inherit stdout from native update --notes-file -.
        # Accept their complete exact-shaped emission plus final libtest ok.
        for name, id_count in MULTILINE_TESTS.items():
            pattern = r'(?m)^test ' + re.escape(name) + r' \.\.\. ((?:bead-[a-f0-9]{8}\r?\n)+)ok\r?$'
            for match in re.finditer(pattern, body):
                require(target_order[index] == 'test:checkpoint_set_v2_conformance',
                        'Multiline completion belongs to the wrong harness')
                ids = match.group(1).splitlines()
                require(len(ids) == id_count and len(set(ids)) == id_count,
                        'Unexpected inherited native-update output')
                require(name not in {row['name'] for row in multiline}, 'Repeated multiline completion')
                multiline.append({'target': target_order[index], 'name': name,
                                  'native_update_stdout': ids, 'libtest_status': 'ok'})
                names.append((name, 'ok'))
        passed_names = [name for name, status in names if status == 'ok']
        ignored_names = [{'name': name, 'status': status} for name, status in names if status != 'ok']
        require(len(passed_names) == passed and len(ignored_names) == ignored
                and len({name for name, _ in names}) == len(names), 'Test names do not match target counts')
        all_passed_names.update(passed_names)
        all_ignored_names.update(row['name'] for row in ignored_names)
        targets.append({'target': target_order[index], 'passed': passed, 'failed': failed,
                        'ignored': ignored, 'measured': measured, 'filtered_out': filtered,
                        'passed_tests': passed_names, 'ignored_tests': ignored_names})
        previous_end = summary.end()
    require(EXPECTED_NEW_TESTS <= all_passed_names, 'A new checkpoint regression did not pass')
    require({row['name'] for row in multiline} == set(MULTILINE_TESTS), 'Expected exactly two multiline completions')
    require(all_ignored_names == EXPECTED_IGNORED, 'The existing ignored-test set differs')
    require(sum(row['passed'] for row in targets) == 1902
            and sum(row['ignored'] for row in targets) == 8, 'Complete-suite totals differ')
    return {'targets': targets, 'target_count': len(targets), 'passed_test_count': 1902,
            'failed_test_count': 0, 'ignored_test_count': 8, 'measured_test_count': 0,
            'filtered_test_count': 0, 'required_new_tests': sorted(EXPECTED_NEW_TESTS),
            'required_new_tests_passed': 6, 'unfiltered_default_harnesses': sorted(executed),
            'doctests': docs, 'doctest_result_groups': doc_groups, 'multiline_completions': multiline}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--evidence', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    own = Path(__file__).resolve(strict=True)
    data = {name: read_exact(args.evidence / name, pin) for name, pin in PINS.items()}
    build = decode(read_exact(own.parent / 'accepted-build-result.json', BUILD_SHA))
    conformance = read_exact(own.parent / 'checkpoint_set_v2_conformance.rs', CONFORMANCE_SHA).decode()
    for name in MULTILINE_TESTS:
        require('fn ' + name + '()' in conformance, 'Observed test is absent from exact source')
    original = decode(data['result.json'])
    require(original['status'] == 'failed' and original['error'] == 'RuntimeError: Test names do not match target counts',
            'Original wrapper outcome differs')
    require(original['run'] == {'id': '45549798905', 'attempt': '1', 'repository': 'YossiMH/bead-me-up-scotty',
                               'workflow_commit': '3db3742bfb91e3b38cf35535fa95403f2de3a093'}, 'Observed run identity differs')
    require(build['status'] == 'passed' and original['build_result_sha256'] == BUILD_SHA
            and original['source_commit'] == build['source_commit'] == '515b503b24baf71737ff8fa6c879bd0752ef0fc6'
            and original['source_tree'] == build['source_tree'] == 'b7c196bb6b337bdc7503e28d3a600e860fa3b799'
            and original['build_root'] == build['build_root'] and original['toolchain'] == build['toolchain'],
            'Accepted source/build identity differs')
    require(original['command'] == ['cargo', 'test', '--locked', '--no-fail-fast', '--', '--test-threads=1'],
            'Required unfiltered command differs')
    commands, groups = original['commands'], original['process_group_cleanup']
    require(len(commands) == len(groups) == 19 and [row['label'] for row in commands] == [row['label'] for row in groups]
            and all(row['exit_code'] == 0 and row['error'] is None for row in commands)
            and all(not row['signals'] and not row['remaining'] for row in groups), 'Command or owned-process completion failed')
    require(len([row for row in commands if row['label'] == 'cargo-full-suite']) == 1,
            'The suite command must have executed exactly once')
    require(not any(key in original for key in ('preservation_error', 'environment_cleanup_error', 'cleanup_error', 'deadline_exceeded'))
            and original['source_files_unchanged'] == 651 and original['duration_seconds'] < 5400,
            'Source preservation/deadline/completion differs')
    before, after = decode(data['executables-before.json']), decode(data['executables-after.json'])
    require(before == build['executables'] and set(after) == set(before) and len(after) == 146,
            'Recorded executable coverage differs')
    for key, row in after.items():
        require(row['path'] == before[key]['path'] and row['mode'] == before[key]['mode']
                and row['bytes'] > 0 and re.fullmatch(r'[a-f0-9]{64}', row['sha256']),
                'Invalid final executable record')
    corrections = decode(data['environment-corrections.json'])
    expected_final_corrections = {**corrections, 'cleanup_status': 'passed', 'cleanup_errors': [],
        'loader_alias': {**corrections['loader_alias'], 'removed': True},
        'lease_binary_alias': {**corrections['lease_binary_alias'], 'removed': True}}
    require(expected_final_corrections == original['environment_corrections'], 'Environment cleanup differs')
    parsed = parse_results(data['logs/cargo-full-suite.stdout'].decode(), data['logs/cargo-full-suite.stderr'].decode(), build)
    result = {'schema_version': 1, 'status': 'passed', 'operation': 'read-only-full-suite-reconciliation',
              'original_wrapper_status': original['status'], 'original_wrapper_error': original['error'],
              'original_wrapper_result_sha256': PINS['result.json'], 'original_run': original['run'],
              'source_commit': original['source_commit'], 'source_tree': original['source_tree'],
              'accepted_build_result_sha256': BUILD_SHA, 'evidence_sha256': PINS,
              'reconciler_sha256': hashlib.sha256(own.read_bytes()).hexdigest(), 'product_commands_executed': 0,
              'read_only_path_mapping': 'Exact accepted absolute executable paths matched lexically to retained Cargo stderr; the actual run verified files before and after execution.',
              'commands_exited_zero': len(commands), 'owned_process_groups_empty': len(groups),
              'source_files_unchanged': 651, 'environment_cleanup_status': 'passed', **parsed}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8', newline='\n') as stream:
        json.dump(result, stream, indent=2, sort_keys=True)
        stream.write('\n')
    print(json.dumps({'status': result['status'], 'sha256': hashlib.sha256(args.output.read_bytes()).hexdigest(),
                      'target_count': result['target_count'], 'passed': result['passed_test_count'],
                      'ignored': result['ignored_test_count'], 'required_new_tests_passed': 6}))


if __name__ == '__main__':
    main()
