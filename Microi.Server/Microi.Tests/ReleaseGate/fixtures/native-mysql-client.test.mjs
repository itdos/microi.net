import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('explicit native MySQL and automatic Docker fail before either transport starts', () => {
  const env = { ...process.env, MICROI_GATE_TEST_MYSQL_NATIVE_CONFIG: 'not-opened.json',
    MICROI_GATE_TEST_MYSQL_NATIVE_PYTHON: 'not-executed-python', MICROI_GATE_TEST_MYSQL_AUTO: '1' };
  delete env.MICROI_GATE_TEST_MYSQL_CONTAINER;
  delete env.NODE_TEST_CONTEXT;
  const source = fileURLToPath(new URL('../../../OfficialApplications/Resource/application-stream-physical-contract.test.mjs', import.meta.url));
  const result = spawnSync(process.execPath, ['--test', '--test-name-pattern=^isolated MySQL:', source], {
    env, encoding: 'utf8', timeout: 30000, windowsHide: true,
  });
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /native MySQL cannot enable automatic Docker/);
});

// These fake-client tests prove refusal and transport semantics, not live MySQL DDL.
test('native MySQL fixture refuses foreign scope and preserves safe row/error contracts', () => {
  const script = String.raw`
import copy, importlib.util, io, json, sys, unittest
spec = importlib.util.spec_from_file_location('native_mysql_fixture', sys.argv[1])
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
CONFIG = {'taskId':'native-gate-fixture-test','owner':'microservice-gate-contract-01234567-89ab-4cde-8fab-0123456789ab',
 'database':'mci_gate_0123456789ab4cde8fab0123456789ab',
 'connection':{'host':'127.0.0.1','port':63880,'user':'test','password':'not-a-real-secret'}}
class Cursor:
 def __init__(self, store): self.store=store; self.description=None; self.rows=[]
 def __enter__(self): return self
 def __exit__(self,*args): pass
 def execute(self,sql,args=None):
  self.store['commands'].append(sql); self.description=None; self.rows=[]
  if sql.startswith('SELECT SCHEMA_NAME '): self.rows=[(CONFIG['database'],)] if self.store['exists'] else []
  elif sql.startswith('CREATE DATABASE '): self.store['exists']=True
  elif sql.startswith('CREATE TABLE ') and fixture.MARKER in sql: pass
  elif sql.startswith('INSERT INTO ') and fixture.MARKER in sql: self.store['marker']=tuple(args)
  elif sql.startswith('SELECT TaskId,Owner '): self.rows=[self.store['marker']] if self.store['marker'] else []
  elif sql.startswith('DROP DATABASE '): self.store['exists']=False
  else:
   self.store['business'].append(sql); self.description=[('Count',),('Missing',),('Text',)]; self.rows=[(7,None,b'value')]
 def fetchall(self): return self.rows
 def nextset(self): return None
class Connection:
 def __init__(self,store): self.store=store
 def __enter__(self): return self
 def __exit__(self,*args): pass
 def cursor(self): return Cursor(self.store)
 def select_db(self,name): self.store['selected'].append(name)
class Cases(unittest.TestCase):
 def setUp(self):
  self.store={'exists':False,'marker':None,'commands':[],'business':[],'selected':[],'connections':0}
 def connect(self,settings):
  self.assertEqual(settings,CONFIG['connection']); self.store['connections']+=1; return Connection(self.store)
 def call(self,op,**values): return fixture.handle(copy.deepcopy(CONFIG),{'op':op,**values},self.connect)
 def own(self): self.store.update(exists=True,marker=(CONFIG['taskId'],CONFIG['owner']))
 def test_init_requires_absence_and_writes_own_marker(self):
  self.assertEqual(self.call('init'),[])
  self.assertEqual(self.store['marker'],(CONFIG['taskId'],CONFIG['owner']))
  self.assertNotIn('IF NOT EXISTS',' '.join(self.store['commands']))
 def test_existing_database_never_creates_or_drops(self):
  self.store['exists']=True
  with self.assertRaisesRegex(fixture.GuardError,'DATABASE_ALREADY_EXISTS'): self.call('init')
  self.assertEqual(len(self.store['commands']),1)
 def test_foreign_owner_refuses_business_sql(self):
  self.store.update(exists=True,marker=('other-task-foreign','other-owner'))
  with self.assertRaisesRegex(fixture.GuardError,'OWNER_MISMATCH'): self.call('query',sql='DROP TABLE business')
  self.assertEqual(self.store['business'],[]); self.assertEqual(self.store['selected'],[])
 def test_foreign_owner_refuses_cleanup(self):
  self.store.update(exists=True,marker=('other-task-foreign','other-owner'))
  with self.assertRaisesRegex(fixture.GuardError,'OWNER_MISMATCH'): self.call('cleanup')
  self.assertFalse(any(sql.startswith('DROP DATABASE') for sql in self.store['commands']))
 def test_cleanup_drops_only_exact_owned_database(self):
  self.own(); self.assertEqual(self.call('cleanup'),[])
  self.assertEqual(self.store['commands'][-1],'DROP DATABASE '+chr(96)+CONFIG['database']+chr(96))
 def test_rows_keep_cli_strings_and_null(self):
  self.own(); rows=self.call('query',sql='SELECT 7 AS Count,NULL AS Missing')
  self.assertEqual(rows,[{'Count':'7','Missing':None,'Text':'value'}])
  self.assertEqual(self.store['selected'],[CONFIG['database']])
 def test_nonloopback_and_unbound_nonce_refuse_before_connect(self):
  for patch in [{'connection':dict(CONFIG['connection'],host='net.itdos.net')},{'database':'iTdos'},
                {'owner':'microservice-gate-contract-20261013'}]:
   config=dict(CONFIG,**patch)
   with self.assertRaises(fixture.GuardError): fixture.handle(config,{'op':'init'},self.connect)
  self.assertEqual(self.store['connections'],0)
 def test_cross_database_admin_and_marker_sql_refuse_before_connect(self):
  for sql in ['DROP DATABASE iTdos','USE iTdos','DELETE FROM iTdos.sys_user',
              'SET GLOBAL max_connections=1','DROP TABLE '+fixture.MARKER,
              "SELECT 1 INTO OUTFILE '/tmp/foreign'",'CREATE INDEX ix ON iTdos.foreign_table (Id)',
              'SELECT 1; /*!50000 DROP DATABASE iTdos */']:
   with self.subTest(sql=sql):
    with self.assertRaises(fixture.GuardError): self.call('query',sql=sql)
  self.assertEqual(self.store['connections'],0)
 def test_safe_sql_allows_current_schema_catalog_and_literals(self):
  for sql in ["UPDATE business SET Name='DROP DATABASE iTdos' WHERE Id=1",
              'SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()',
              'CREATE TABLE '+chr(96)+CONFIG['database']+chr(96)+'.'+chr(96)+'business'+chr(96)+' (Id int)']:
   fixture.validate_sql(sql,CONFIG['database'])
 def test_error_mapping_never_echoes_server_exception(self):
  self.assertEqual(fixture.safe_error(Exception(1062,'do-not-echo-this')),'MYSQL_DUPLICATE_ENTRY')
  self.assertEqual(fixture.safe_error(Exception('do-not-echo-this')),'MYSQL_NATIVE_FAILED')
result=unittest.TextTestRunner(stream=io.StringIO()).run(unittest.defaultTestLoader.loadTestsFromTestCase(Cases))
print(json.dumps({'fakeClient':True,'tests':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),
 'details':[text for _,text in result.failures+result.errors]}))
sys.exit(0 if result.wasSuccessful() else 1)
`;
  const python = process.env.MICROI_GATE_TEST_MYSQL_NATIVE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const result = spawnSync(python, ['-X', 'utf8', '-c', script, fileURLToPath(new URL('./native-mysql-client.py', import.meta.url))], {
    encoding: 'utf8', timeout: 30000, windowsHide: true,
  });
  assert.equal(result.error, undefined, 'Python fake-client regression must execute');
  assert.equal(result.status, 0, result.stdout || 'Python fake-client regression failed');
  const report = JSON.parse(result.stdout.trim());
  assert.equal(report.fakeClient, true);
  assert.equal(report.tests, 10);
  assert.equal(report.failures, 0);
  assert.equal(report.errors, 0);
  assert.doesNotMatch(result.stdout + result.stderr, /do-not-echo-this/);
});
