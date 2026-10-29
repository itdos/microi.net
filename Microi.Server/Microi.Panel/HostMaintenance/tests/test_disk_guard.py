import copy
import contextlib
import importlib.util
import os
import stat
from types import SimpleNamespace
from pathlib import Path
import tempfile
import unittest
from unittest import mock

source = Path(__file__).resolve().parents[1] / 'daemon.py'
spec = importlib.util.spec_from_file_location('disk_guard', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def image_id(number):
    return 'sha256:' + format(number, '064x')


class Docker:
    def __init__(self):
        self.engine_id = 'isolated-test-engine'
        self.items = {image_id(n): dict(Id=image_id(n), RepoTags=['example.test/microi-api:v' + str(n)],
                                      RepoDigests=['example.test/microi-api@' + image_id(n)], Size=n * 100, Created=1)
                      for n in range(1, 7)}
        self.current = image_id(6)
        self.extra = []
        self.deleted = []
        self.volume_names = ['retained-mysql-data', 'retained-redis-data', 'retained-mongodb-data']
        self.before_remove = None

    def info(self):
        return dict(ID=self.engine_id, DockerRootDir='/docker-data')

    def container(self, name):
        if name == 'app-api' and self.current:
            return dict(Name='/app-api', Image=self.current, Config=dict(Image='example.test/microi-api:latest',
                        Labels={'com.docker.compose.project': 'app'}), State=dict(Running=True), Mounts=[])
        if name == 'db':
            return dict(Name='/db', Image=image_id(20), Config=dict(Image='example.test/mysql:8', Labels={}),
                        State=dict(Running=True), Mounts=[dict(Type='bind', Source='/database-data', RW=True)])

    def image(self, ref):
        return copy.deepcopy(self.items.get(ref))

    def images(self):
        return copy.deepcopy(list(self.items.values()))

    def containers(self):
        return ([dict(ImageID=self.current)] if self.current else []) + copy.deepcopy(self.extra)

    def volumes(self):
        return self.volume_names[:]

    def remove_image(self, value, *args):
        if self.before_remove:
            self.before_remove(value)
        if any(x['ImageID'] == value for x in self.containers()):
            raise module.GuardError('Docker 引用冲突。')
        self.deleted.append(value)
        self.items.pop(value)


class Tests(unittest.TestCase):
    def setUp(self):
        if os.name == 'nt':
            lock = mock.patch.object(module, 'FileLock', lambda _: contextlib.nullcontext())
            lock.start()
            self.addCleanup(lock.stop)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.now = 2000000
        self.docker = Docker()
        self.free = 100 * 1024**3
        self.inode = 20
        self.readonly = False
        self.paths = []
        self.guard = module.Guard(Path(self.temp.name), self.docker, clock=lambda: self.now,
                                 disk_reader=self.read_disk, strict=False)
        self.guard.enroll('app-api', 'api')

    def read_disk(self, path):
        self.paths.append(path)
        return dict(path=path, totalBytes=200 * 1024**3, availableBytes=self.free,
                    usedPercent=100 * (200 * 1024**3 - self.free) / (200 * 1024**3),
                    inodeUsedPercent=self.inode, readOnly=self.readonly)

    def aged(self):
        self.guard.scan()
        self.now += 8 * 86400
        return self.guard.scan()

    def job(self, snapshot):
        return self.guard.enqueue(dict(requestId='isolated-test-request', fingerprint=snapshot['fingerprint'], confirm='安全清理'))

    def test_defaults_enabled_and_data_volume_deletion_not_configurable(self):
        self.assertTrue(self.guard.status()['policy']['enabled'])
        self.assertTrue(self.guard.status()['volumesNeverDeleted'])
        with self.assertRaises(module.GuardError):
            module.policy(dict(module.DEFAULTS, deleteVolumes=True))

    def test_control_socket_fifo_and_device_are_not_data_capacity(self):
        # socket 在 /run 的小型 tmpfs 上，不能触发数据盘的 5 GiB 余量保护。
        for kind in (stat.S_IFSOCK, stat.S_IFIFO, stat.S_IFCHR, stat.S_IFBLK):
            with self.subTest(kind=kind), mock.patch.object(module.os, 'stat', return_value=SimpleNamespace(st_mode=kind)), mock.patch.object(module.os, 'statvfs', create=True) as filesystem:
                self.assertIsNone(module.disk('/control-node'))
                filesystem.assert_not_called()

    def test_regular_file_and_directory_still_have_real_capacity_checks(self):
        for kind in (stat.S_IFREG, stat.S_IFDIR):
            value=SimpleNamespace(f_blocks=100, f_frsize=4096, f_bavail=25, f_files=100, f_favail=40)
            with self.subTest(kind=kind), mock.patch.object(module.os, 'stat', return_value=SimpleNamespace(st_mode=kind)), mock.patch.object(module.os, 'statvfs', return_value=value, create=True), mock.patch.object(module, 'host_readonly', return_value=False):
                sample=module.disk('/data')
                self.assertEqual(sample['availableBytes'], 25*4096)
                self.assertEqual(sample['usedPercent'], 75)
                self.assertEqual(sample['inodeUsedPercent'], 60)

    def test_capacity_skips_special_nodes_but_keeps_database_mount(self):
        original=self.docker.container
        def container(name):
            value=original(name)
            if name=='db':value['Mounts'].append(dict(Type='bind', Source='/control-node', RW=True))
            return value
        self.docker.container=container
        self.docker.items[image_id(20)] = dict(Id=image_id(20), RepoTags=['example.test/mysql:8'], RepoDigests=[], Size=200)
        self.guard.enroll('db', 'data')
        self.guard.disk_reader=lambda path: None if path=='/control-node' else self.read_disk(path)
        capacity=self.guard.scan()['capacity']
        self.assertIn('/database-data', [x['path'] for x in capacity['disks']])
        self.assertNotIn('/control-node', [x['path'] for x in capacity['disks']])
        self.assertFalse(capacity['blockUpdates'])

    def test_policy_rejects_bool_numbers_low_rollback_and_inverted_thresholds(self):
        for change in (dict(idleDays=True), dict(rollbackVersions=1), dict(warningPercent=90, pausePercent=85)):
            with self.subTest(change=change), self.assertRaises(module.GuardError):
                module.policy(dict(module.DEFAULTS, **change))

    def test_first_enrollment_does_not_delete_old_build_dates(self):
        self.assertFalse(any(x['eligible'] for x in self.guard.scan()['images']))
        self.assertEqual(self.docker.deleted, [])

    def test_current_and_stopped_container_references_preserved(self):
        self.docker.extra = [dict(ImageID=image_id(1), State='exited')]
        rows = {x['id']: x for x in self.aged()['images']}
        self.assertFalse(rows[image_id(1)]['eligible'])
        self.assertFalse(rows[image_id(6)]['eligible'])
        self.assertTrue(rows[image_id(2)]['eligible'])

    def test_two_previous_images_remain_after_three_observed_updates(self):
        self.guard.scan()
        for number in (5, 4, 3):
            self.now += 100
            self.docker.current = image_id(number)
            self.guard.scan()
        self.now += 8 * 86400
        rows = {x['id']: x for x in self.guard.scan()['images']}
        for number in (3, 4, 5):
            self.assertFalse(rows[image_id(number)]['eligible'])
        self.assertTrue(rows[image_id(6)]['eligible'])

    def test_missing_registered_container_still_protects_rollback_history(self):
        self.guard.scan()
        self.docker.current = image_id(5)
        self.guard.scan()
        self.docker.current = image_id(4)
        self.guard.scan()
        self.docker.current = None
        self.now += 8 * 86400
        rows = {x['id']: x for x in self.guard.scan()['images']}
        self.assertFalse(rows[image_id(5)]['eligible'])
        self.assertFalse(rows[image_id(4)]['eligible'])

    def test_missing_initial_container_preserves_bootstrap_rollback_candidates(self):
        self.guard.scan()
        self.docker.current = None
        self.now += 8 * 86400
        rows = {x['id']: x for x in self.guard.scan()['images']}
        self.assertFalse(rows[image_id(4)]['eligible'])
        self.assertFalse(rows[image_id(5)]['eligible'])

    def test_foreign_or_shared_repository_is_not_deleted(self):
        self.docker.items[image_id(1)]['RepoTags'].append('other.example/business:stable')
        self.docker.items[image_id(50)] = dict(Id=image_id(50), RepoTags=[], RepoDigests=[], Size=500)
        rows = {x['id']: x for x in self.aged()['images']}
        self.assertFalse(rows[image_id(1)]['eligible'])
        self.assertNotIn(image_id(50), rows)

    def test_idle_period_restarts_after_any_container_reuses_image(self):
        self.aged()
        self.docker.extra = [dict(ImageID=image_id(1))]
        self.guard.scan()
        self.docker.extra = []
        self.now += 5
        row = next(x for x in self.guard.scan()['images'] if x['id'] == image_id(1))
        self.assertFalse(row['eligible'])
        self.assertEqual(row['unusedSince'], self.now)

    def test_persistent_task_pins_cover_ids_and_target_references(self):
        self.aged()
        self.guard.preflight(dict(operationId='update-a', images=[image_id(1), 'example.test/microi-api:v2'], requiredBytes=1024))
        rows = {x['id']: x for x in self.guard.scan()['images']}
        self.assertFalse(rows[image_id(1)]['eligible'])
        self.assertFalse(rows[image_id(2)]['eligible'])

    def test_low_disk_blocks_update_and_keeps_original_pins(self):
        self.free = 1024
        with self.assertRaises(module.GuardError):
            self.guard.preflight(dict(operationId='update-a', images=[image_id(1)], requiredBytes=1024))
        self.assertEqual(self.guard.status()['leases'][0]['images'], [image_id(1)])

    def test_inode_pressure_blocks_new_download(self):
        self.inode = 95
        with self.assertRaises(module.GuardError):
            self.guard.preflight(dict(operationId='update-a', images=[], requiredBytes=0))

    def test_engine_change_stops_read_write_instead_of_reenrolling(self):
        self.docker.engine_id = 'another-engine'
        with self.assertRaises(module.GuardError):
            self.guard.scan()
        self.assertEqual(self.docker.deleted, [])

    def test_policy_cas_and_preview_fingerprint_block_stale_execution(self):
        snapshot = self.aged()
        self.guard.save_policy(dict(expectedRevision=snapshot['policy']['revision'], policy=dict(module.DEFAULTS, idleDays=14)))
        with self.assertRaises(module.GuardError):
            self.job(snapshot)
        with self.assertRaises(module.GuardError):
            self.guard.save_policy(dict(expectedRevision=snapshot['policy']['revision'], policy=dict(module.DEFAULTS)))

    def test_request_id_is_idempotent_but_not_reusable_for_other_plan(self):
        snapshot = self.aged()
        job = self.job(snapshot)
        self.assertEqual(self.job(snapshot)['id'], job['id'])
        with self.assertRaises(module.GuardError):
            self.guard.enqueue(dict(requestId=job['requestId'], fingerprint='changed', confirm='安全清理'))

    def test_changed_reference_after_preview_causes_zero_deletions(self):
        job = self.job(self.aged())
        self.docker.extra.append(dict(ImageID=image_id(1)))
        with self.assertRaises(module.GuardError):
            self.guard.clean(job)
        self.assertEqual(self.docker.deleted, [])

    def test_real_delete_results_are_read_back_and_all_volumes_remain(self):
        volumes = self.docker.volumes()
        result = self.guard.clean(self.job(self.aged()))
        self.assertEqual(result['state'], 'Succeeded')
        self.assertEqual(len(result['deleted']), 3)
        self.assertTrue(result['volumeListUnchanged'])
        self.assertFalse(result['volumeDeletionAttempted'])
        self.assertEqual(self.docker.volumes(), volumes)
        self.assertIn(self.docker.current, self.docker.items)

    def test_docker_last_moment_reference_conflict_is_not_forced(self):
        self.docker.before_remove = lambda value: self.docker.extra.append(dict(ImageID=value))
        result = self.guard.clean(self.job(self.aged()))
        self.assertEqual(self.docker.deleted, [])
        self.assertEqual(len(result['skipped']), 3)

    def test_first_baseline_keeps_two_existing_historical_candidates(self):
        rows = {x['id']: x for x in self.aged()['images']}
        self.assertFalse(rows[image_id(4)]['eligible'])
        self.assertFalse(rows[image_id(5)]['eligible'])
        self.assertTrue(rows[image_id(1)]['eligible'])

    def test_return_to_old_image_keeps_distinct_history_versions(self):
        for number in (6, 5, 4, 5):
            self.docker.current = image_id(number)
            self.now += 100
            self.guard.scan()
        history = self.guard.status()['registrations'][0]['history']
        self.assertEqual([x['id'] for x in history[:3]], [image_id(5), image_id(4), image_id(6)])

    def test_readonly_filesystem_prevents_any_cleanup(self):
        job = self.job(self.aged())
        self.readonly = True
        with self.assertRaises(module.GuardError):
            self.guard.clean(job)
        self.assertEqual(self.docker.deleted, [])

    def test_disabled_automatic_policy_still_monitors_without_deleting(self):
        current = self.guard.status()['policy']
        self.guard.save_policy(dict(expectedRevision=current['revision'], policy=dict(module.DEFAULTS, enabled=False)))
        self.aged()
        self.free = 1024
        self.guard.tick()
        self.assertIsNone(self.guard.job)
        self.assertTrue(self.guard.status()['snapshot']['capacity']['blockUpdates'])

    def test_data_registration_monitors_mounts_without_enrolling_database_images(self):
        self.docker.items[image_id(20)] = dict(Id=image_id(20), RepoTags=['example.test/mysql:8'], RepoDigests=[], Size=200)
        self.guard.enroll('db', 'data')
        snapshot = self.aged()
        self.assertIn('/database-data', self.paths)
        self.assertFalse(any(x['id'] == image_id(20) for x in snapshot['images']))

    def test_data_only_monitor_survives_image_repository_replacement(self):
        self.docker.items[image_id(20)] = dict(Id=image_id(20), RepoTags=['example.test/mysql:8'], RepoDigests=[], Size=200)
        self.guard.enroll('db', 'data')
        old_container=self.docker.container
        def changed(name):
            value=old_container(name)
            if name=='db':value['Config']['Image']='example.test/mysql-new:9'
            return value
        self.docker.container=changed
        self.assertEqual(self.guard.enroll('db','data')['repository'],'data-only')
        self.assertEqual(self.guard.status()['registrations'][1]['role'],'data')

    def test_mount_readonly_uses_host_namespace_and_deepest_real_mount(self):
        # This parser is exercised with actual /proc/1/mountinfo in the native systemd acceptance too.
        raw='20 1 8:1 / / rw,relatime - ext4 /dev/root rw\n21 20 8:2 / /var/lib/docker ro,relatime - ext4 /dev/sdb rw\n'
        if os.name != 'nt':
            self.assertFalse(module.host_readonly('/var/lib/microi-disk-guard',raw))
            self.assertTrue(module.host_readonly('/var/lib/docker',raw))
            self.assertFalse(module.host_readonly('/var/lib/docker-other',raw))
        with self.assertRaises(module.GuardError):module.host_readonly('/missing','')

    def test_preflight_first_reclaims_only_aged_candidates_then_rechecks_real_capacity(self):
        self.aged()
        self.free = 3 * 1024**3
        self.docker.before_remove = lambda _: setattr(self, 'free', 100 * 1024**3)
        result = self.guard.preflight(dict(operationId='update-after-cleanup', images=[image_id(2)], requiredBytes=0))
        self.assertTrue(result['ready'])
        self.assertGreater(len(self.docker.deleted), 0)
        self.assertNotIn(image_id(2), self.docker.deleted)
        self.assertIsNone(self.guard.job)
        self.assertEqual(self.guard.status()['jobs'][0]['mode'], 'preflight')
        self.assertTrue(self.guard.status()['jobs'][0]['volumeListUnchanged'])

    def test_prepared_target_replaces_only_same_service_pin_and_survives_restart(self):
        self.aged()
        self.guard.preflight(dict(operationId='download1', images=[image_id(1)], requiredBytes=0))
        self.guard.prepared(dict(operationId='download1', images=[dict(name='app-api', imageId=image_id(1))]))
        rows = {x['id']: x for x in self.guard.scan()['images']}
        self.assertFalse(rows[image_id(1)]['eligible'])
        self.assertEqual(self.guard.status()['leases'], [])
        self.guard.preflight(dict(operationId='download2', images=[image_id(2)], requiredBytes=0))
        self.guard.prepared(dict(operationId='download2', images=[dict(name='app-api', imageId=image_id(2))]))
        self.guard = module.Guard(Path(self.temp.name), self.docker, clock=lambda:self.now, disk_reader=self.read_disk, strict=False, recover=True)
        rows = {x['id']: x for x in self.guard.scan()['images']}
        self.assertTrue(rows[image_id(1)]['eligible'])
        self.assertFalse(rows[image_id(2)]['eligible'])

    def test_expected_repository_blocks_first_registration_of_foreign_container(self):
        with self.assertRaises(module.GuardError):
            self.guard.enroll('db', 'data', 'example.test/microi-api')
        self.assertEqual([x['name'] for x in self.guard.status()['registrations']], ['app-api'])
        self.assertEqual(self.guard.enroll('app-api','api','example.test/microi-api:latest')['repository'],'example.test/microi-api')

    def test_failed_prepared_validation_preserves_original_lease(self):
        self.guard.preflight(dict(operationId='download1', images=[image_id(1)], requiredBytes=0))
        with self.assertRaises(module.GuardError):
            self.guard.prepared(dict(operationId='download1', images=[dict(name='db', imageId=image_id(1))]))
        self.assertEqual(self.guard.status()['leases'][0]['id'], 'download1')

    def test_cli_flags_after_action_and_guarded_command_are_parsed(self):
        args = module.parse_args(['enroll', '--name', 'app-api', '--role', 'api'])
        self.assertEqual(args.name, 'app-api')
        args = module.parse_args(['guarded', '--operation', 'install-a', '--required-bytes', '99', '--', 'docker', 'compose', 'up', '-d'])
        self.assertEqual(args.required_bytes, 99)
        self.assertEqual(args.command, ['docker', 'compose', 'up', '-d'])


if __name__ == '__main__':
    unittest.main()
