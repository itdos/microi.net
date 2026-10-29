"""Host runner官方二进制身份边界测试；假文件系统不计作原厂环境验收。"""
import hashlib,importlib.util,io,json,stat,types,unittest
from pathlib import Path,PurePosixPath
from unittest.mock import patch

draft=Path(__file__).with_name('panel-host-nginx.e2e.py')
spec=importlib.util.spec_from_file_location('host_draft',draft);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def declaration(path,argv=None): return '{ path='+path+' ; argv[]='+(argv or path)+' ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }'


class FakePath:
    link=True; target='/usr/local/bin/1panel-core'; data=b'\x7fELFactual-owned-binary'; executable=True; race=False; reads=0; nested=False
    def __init__(self,value): self.value=PurePosixPath(str(value))
    def __str__(self): return str(self.value)
    def __eq__(self,other): return isinstance(other,FakePath) and self.value==other.value
    def __truediv__(self,other): return FakePath(self.value/other)
    @property
    def parent(self): return FakePath(self.value.parent)
    def is_absolute(self): return self.value.is_absolute()
    def resolve(self): return FakePath(self.target if self.link and str(self)=='/usr/bin/1panel-core' else self.value)
    def lstat(self): return types.SimpleNamespace(st_mode=stat.S_IFLNK if self.link and str(self)=='/usr/bin/1panel-core' else stat.S_IFREG|0o755)
    def stat(self):
        type(self).reads+=1
        return types.SimpleNamespace(st_mode=stat.S_IFREG|(0o755 if self.executable else 0o644),st_ino=1,st_size=len(self.data),st_mtime_ns=(2 if self.race and self.reads>1 else 1))
    def open(self,mode): return io.BytesIO(self.data)


class Tests(unittest.TestCase):
    def setUp(self):
        FakePath.link=True;FakePath.target='/usr/local/bin/1panel-core';FakePath.data=b'\x7fELFactual-owned-binary';FakePath.executable=True;FakePath.race=False;FakePath.reads=0;FakePath.nested=False
    def binary(self):
        def strict_path(value,**options):
            if FakePath.nested and str(value)=='/usr/local/bin/1panel-core': raise AssertionError('nested target symlink rejected')
            return value
        with patch.object(module,'Path',FakePath),patch.object(module,'command',return_value=declaration('/usr/bin/1panel-core')),patch.object(module,'safe_path',side_effect=strict_path),patch.object(module.os,'readlink',return_value=FakePath.target):
            return module.onepanel_binary('1panel-core')
    def test_actual_official_link_records_declared_resolved_and_content_hash(self):
        value=self.binary();self.assertEqual(value,{'service':'1panel-core','execStartPath':'/usr/bin/1panel-core','realPath':'/usr/local/bin/1panel-core','sha256':hashlib.sha256(FakePath.data).hexdigest()})
    def test_regular_official_binary_supported(self):
        FakePath.link=False;self.assertEqual(self.binary()['realPath'],'/usr/bin/1panel-core')
    def test_link_outside_allowlist_rejected(self):
        FakePath.target='/tmp/1panel-core'
        with self.assertRaises(AssertionError):self.binary()
    def test_wrong_service_link_rejected(self):
        FakePath.target='/usr/local/bin/1panel-agent'
        with self.assertRaises(AssertionError):self.binary()
    def test_nested_link_rejected_by_existing_strict_path(self):
        FakePath.nested=True
        with self.assertRaisesRegex(AssertionError,'nested'):self.binary()
    def test_shell_wrapper_rejected(self):
        FakePath.data=b'#!/bin/sh\nexec arbitrary'
        with self.assertRaisesRegex(AssertionError,'not ELF'):self.binary()
    def test_non_executable_rejected(self):
        FakePath.executable=False
        with self.assertRaisesRegex(AssertionError,'not executable'):self.binary()
    def test_changed_binary_while_reading_rejected(self):
        FakePath.race=True
        with self.assertRaisesRegex(AssertionError,'changed'):self.binary()
    def test_core_agent_both_fixed_locations(self):
        for service in ('1panel-core','1panel-agent'):
            for folder in ('/usr/bin/','/usr/local/bin/'):
                self.assertEqual(module.onepanel_exec_path(service,declaration(folder+service)),folder+service)
    def test_shell_execstart_and_argv_mismatch_rejected(self):
        for value in (declaration('/bin/sh','/bin/sh -c command'),declaration('/usr/bin/1panel-core','/usr/bin/1panel-agent')):
            with self.assertRaises(AssertionError):module.onepanel_exec_path('1panel-core',value)
    def test_multiple_execstarts_or_control_characters_rejected(self):
        for value in (declaration('/usr/bin/1panel-core')+' '+declaration('/usr/bin/1panel-core'),declaration('/usr/bin/1panel-core')+'\n'):
            with self.assertRaises(AssertionError):module.onepanel_exec_path('1panel-core',value)
    def test_other_paths_and_services_rejected(self):
        for service,value in (('docker',declaration('/usr/bin/1panel-core')),('1panel-core',declaration('/usr/local/sbin/1panel-core')),('1panel-core',declaration('/usr/bin/../bin/1panel-core'))):
            with self.assertRaises(AssertionError):module.onepanel_exec_path(service,value)


if __name__ == '__main__': unittest.main()
