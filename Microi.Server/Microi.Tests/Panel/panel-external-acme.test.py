"""外部 ACME 验收器自身的边界回归；不计作真实 ACME、Nginx 或重启验收。"""
import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('external_acme', Path(__file__).with_name('panel-external-acme.e2e.py'))
runner = importlib.util.module_from_spec(spec); spec.loader.exec_module(runner)


class IssueProtocolTests(unittest.TestCase):
    def setUp(self):
        self.state = {'issueRequest': {'requestId': '11111111-1111-4111-8111-111111111111', 'instanceId': 'onepanel-fixture'}}
        self.operation = {'id': '2' * 32, 'requestId': self.state['issueRequest']['requestId'],
                          'resourceId': 'host-nginx-' + runner.host.sha(b'onepanel-fixture')[:24], 'action': 'ExternalAcmeIssue'}

    def test_first_response_binds_independent_server_id(self):
        self.assertNotEqual(self.operation['id'], self.state['issueRequest']['requestId'].replace('-', ''))
        self.assertEqual('2' * 32, runner.bind_issue_operation(self.state, self.operation))
        self.assertEqual(self.operation['id'], self.state['issueOperationId'])

    def test_same_request_replay_keeps_original_operation_id(self):
        runner.bind_issue_operation(self.state, self.operation)
        self.assertEqual(self.operation['id'], runner.bind_issue_operation(self.state, copy.deepcopy(self.operation)))

    def test_replayed_request_cannot_switch_operation(self):
        runner.bind_issue_operation(self.state, self.operation)
        with self.assertRaisesRegex(AssertionError, 'different operation'):
            runner.bind_issue_operation(self.state, self.operation | {'id': '3' * 32})
        self.assertEqual('2' * 32, self.state['issueOperationId'])

    def test_foreign_request_action_resource_and_malformed_id_do_not_bind(self):
        for field, value in [('requestId', 'other-request'), ('action', 'ExternalAcmeRenew'),
                             ('resourceId', 'other-resource'), ('id', None), ('id', 'not-an-operation-id')]:
            with self.subTest(field=field, value=value), self.assertRaises(AssertionError):
                runner.bind_issue_operation(self.state, self.operation | {field: value})
            self.assertNotIn('issueOperationId', self.state)

    def test_old_derived_checkpoint_is_not_silently_migrated(self):
        self.state['issueOperationId'] = self.state['issueRequest']['requestId'].replace('-', '')
        with self.assertRaisesRegex(AssertionError, 'different operation'):
            runner.bind_issue_operation(self.state, self.operation)


class ReceiptTests(unittest.TestCase):
    def setUp(self):
        self.operation = {'id': '2' * 32, 'resourceId': 'external-site', 'state': 'Succeeded', 'action': 'ExternalAcmeRenew',
                          'actor': 'scheduler', 'created': '2026-10-26T10:00:05Z', 'updated': '2026-10-26T10:00:10Z'}
        self.registration = {'id': 'cert-1', 'resourceId': 'external-site', 'autoRenew': True, 'revision': 'r2', 'nextCheck': '2026-10-26T10:05:00Z'}
        self.before = {'issueOperationId': '1' * 32}
        self.boot = {'bootId': 'after', 'bootStartedAt': runner.unix_time('2026-10-26T10:00:00Z')}

    def select(self): return runner.select_automatic_renewal(self.operation, self.registration, self.before, self.boot)
    def test_actual_scheduler_after_boot_selected(self): self.assertTrue(self.select())
    def test_manual_renewal_not_selected(self): self.operation['actor'] = 'admin'; self.assertFalse(self.select())
    def test_old_success_before_boot_not_selected(self): self.operation['updated'] = '2026-10-26T09:59:59Z'; self.assertFalse(self.select())
    def test_failed_operation_not_selected(self): self.operation['state'] = 'Failed'; self.assertFalse(self.select())
    def test_issue_replay_not_selected(self): self.operation['id'] = '1' * 32; self.assertFalse(self.select())
    def test_wrong_resource_not_selected(self): self.operation['resourceId'] = 'other-site'; self.assertFalse(self.select())
    def test_paused_registration_not_selected(self): self.registration['autoRenew'] = False; self.assertFalse(self.select())
    def test_managed_renewal_not_selected(self): self.operation['action'] = 'AcmeRenew'; self.assertFalse(self.select())

    def fixture(self):
        target = runner.ExternalAcmeRunner.__new__(runner.ExternalAcmeRunner)
        target.config = {'sites': [{'provider': '1Panel', 'instanceId': 'i1', 'siteId': 's1'}, {'provider': 'BaoTa', 'instanceId': 'i2', 'siteId': 's2'}]}
        target.run = 'unit-owned-run'; target.candidate = {'imageId': 'sha256:' + 'a' * 64, 'sourceHash': 'b' * 64, 'hostAdapterSha256': 'c' * 64}
        target.runner_hash = 'd' * 64; target.host_runner_hash = 'e' * 64; target.receipt_path = Path('never-written.json')
        target.boot = self.boot; target.state = {'sites': {}}
        for site in target.config['sites']:
            renewal = {'operation': self.operation, 'registration': self.registration, 'tls': {'certificateSha256': 'f' * 64},
                       'boot': self.boot, 'observedAt': self.boot['bootStartedAt'] + 20}
            target.state['sites'][runner.selected_key(site)] = {**self.before, 'issued': {}, 'scheduled': copy.deepcopy(renewal), 'renewed': copy.deepcopy(renewal),
                'deployRollback': {'completed': True}, 'rollbackFixture': {'restored': True},
                'firstCertificateSha256': '0' * 64, 'beforeReboot': {'boot': {'bootId': 'before'}, 'registration': self.registration}}
        return target

    def read_receipt(self, target):
        with patch.object(runner, 'atomic_json') as write:
            target.receipt(); return write.call_args.args[1]

    def test_both_vendors_and_numeric_time_fields(self):
        result = self.read_receipt(self.fixture()); self.assertTrue(result['completed']); self.assertEqual(len(result['sites']), 2)
        for site in result['sites']:
            for field in ('operationCreatedAt', 'operationUpdatedAt', 'scheduledNextCheckBeforeReboot', 'bootStartedAt', 'observedAt'):
                self.assertIsInstance(site['automaticRenewal'][field], (int, float))

    def test_single_vendor_cannot_complete_whole_receipt(self):
        target = self.fixture(); target.config['sites'].pop(); self.assertFalse(self.read_receipt(target)['completed'])

    def test_missing_normal_scheduler_proof_cannot_complete(self):
        target = self.fixture(); target.state['sites'][runner.selected_key(target.config['sites'][0])].pop('scheduled')
        self.assertFalse(self.read_receipt(target)['completed'])

    def test_new_checkpoint_invalidates_old_reboot_receipt(self):
        target = self.fixture(); site = target.config['sites'][0]; state = target.state['sites'][runner.selected_key(site)]
        target.registration = lambda _: self.registration
        target.certificate = lambda *_: ({'id': 'cert-1'}, {'certificateSha256': 'f' * 64})
        target.save = lambda: None; target.passed = lambda *_: None
        with patch.object(runner, 'atomic_json') as write:
            target.checkpoint(site, state)
        self.assertNotIn('renewed', state); self.assertFalse(write.call_args.args[1]['completed'])

    def test_early_failure_after_pause_restores_policy(self):
        target = self.fixture(); site = target.config['sites'][0]; state = target.state['sites'][runner.selected_key(site)]
        state['rollbackPolicy'] = {'pausedRevision': 'paused', 'restored': False}
        target._verify_deploy_rollback = lambda *_: (_ for _ in ()).throw(ValueError('fixture generation failed'))
        target.restore_fault = lambda *_: None; target.save = lambda: None
        values = iter([{'id': 'cert-1', 'revision': 'paused', 'autoRenew': False}, {'id': 'cert-1', 'autoRenew': True}])
        target.registration = lambda _: next(values)
        class Api:
            def call(self, path, body): self.body = body
        target.api = Api()
        with self.assertRaises(ValueError): target.verify_deploy_rollback(site, state)
        self.assertTrue(state['rollbackPolicy']['restored']); self.assertEqual(target.api.body['revision'], 'paused')

    def test_early_cleanup_does_not_override_concurrent_policy(self):
        target = self.fixture(); site = target.config['sites'][0]; state = target.state['sites'][runner.selected_key(site)]
        state['rollbackPolicy'] = {'pausedRevision': 'paused', 'restored': False}
        target._verify_deploy_rollback = lambda *_: None; target.restore_fault = lambda *_: None
        target.registration = lambda _: {'id': 'cert-1', 'revision': 'external-change', 'autoRenew': False}
        with self.assertRaisesRegex(AssertionError, 'changed externally'): target.verify_deploy_rollback(site, state)


if __name__ == '__main__': unittest.main()
