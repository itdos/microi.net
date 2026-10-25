"""Verify and remove only a rich-text test's resources in an explicitly owned MySQL fixture."""
import json, pathlib, re, sys
import pymysql

class FixtureGuardError(Exception):
    pass

def require(condition, message):
    if not condition:
        raise FixtureGuardError(message)

def run():
    payload = json.load(sys.stdin)
    config = json.loads(pathlib.Path(payload['config']).read_text(encoding='utf-8-sig'))
    require(payload['osClient'] == config['osClient'], 'TENANT_MISMATCH')
    database = config['database']
    require(re.fullmatch(r'[A-Za-z0-9_]+', database), 'INVALID_DATABASE')
    require(config['ownerTask'] and config['authorization'], 'OWNER_REQUIRED')
    with pymysql.connect(**config['connection'], database=database, connect_timeout=5, read_timeout=15, write_timeout=15) as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT TaskId FROM _ui_full_owner WHERE Id=1')
            require(cur.fetchone() == (config['ownerTask'],), 'FIXTURE_OWNER_MISMATCH')
            if payload['action'] == 'verify':
                return {'ownerVerified': True}
            require(payload['action'] == 'cleanup', 'INVALID_ACTION')
            fixture = payload['fixture']
            nonce = fixture['nonce']
            require(re.fullmatch(r'[a-f0-9]{16}', nonce), 'INVALID_NONCE')
            table = 'mci_e2e_richtext_' + nonce
            owner = 'microi-richtext-e2e:' + nonce
            require(fixture['tableName'] == table and fixture['owner'] == owner, 'RESOURCE_OWNER_MISMATCH')
            cur.execute('SELECT Name,Description FROM diy_table WHERE Id=%s', (fixture['tableId'],))
            metadata = cur.fetchone()
            cur.execute('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=%s AND TABLE_NAME=%s', (database, table))
            physical = cur.fetchone()[0]
            if metadata is None:
                require(not physical, 'UNCLAIMED_PHYSICAL_TABLE')
            else:
                require(metadata == (table, owner), 'TABLE_OWNER_MISMATCH')
            cur.execute('SELECT Description,Url,DiyTableId FROM sys_menu WHERE Id=%s', (fixture['menuId'],))
            menu = cur.fetchone()
            if menu is not None:
                require(menu == (owner, fixture['route'], fixture['tableId']), 'MENU_OWNER_MISMATCH')
                cur.execute('DELETE FROM sys_rolelimit WHERE FkId=%s AND Type=%s', (fixture['menuId'], 'Menu'))
                cur.execute('DELETE FROM sys_menu WHERE Id=%s AND Description=%s', (fixture['menuId'], owner))
            if metadata is not None:
                cur.execute('DELETE FROM diy_field WHERE TableId=%s', (fixture['tableId'],))
                cur.execute('DELETE FROM diy_table WHERE Id=%s AND Name=%s AND Description=%s', (fixture['tableId'], table, owner))
                if physical:
                    cur.execute('DROP TABLE `' + table + '`')
            conn.commit()
            cur.execute('SELECT COUNT(*) FROM diy_table WHERE Id=%s', (fixture['tableId'],))
            require(cur.fetchone()[0] == 0, 'TABLE_METADATA_REMAINS')
            cur.execute('SELECT COUNT(*) FROM diy_field WHERE TableId=%s', (fixture['tableId'],))
            require(cur.fetchone()[0] == 0, 'FIELD_METADATA_REMAINS')
            cur.execute('SELECT COUNT(*) FROM sys_menu WHERE Id=%s', (fixture['menuId'],))
            require(cur.fetchone()[0] == 0, 'MENU_REMAINS')
            cur.execute('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=%s AND TABLE_NAME=%s', (database, table))
            require(cur.fetchone()[0] == 0, 'PHYSICAL_TABLE_REMAINS')
            return {'ownerVerified': True, 'tableRemoved': True, 'fieldsRemoved': True, 'menuRemoved': True}

try:
    print(json.dumps(run()))
except Exception as error:
    # Connection strings, credentials and database exception payloads never reach test logs.
    print(json.dumps({'error': str(error) if isinstance(error, FixtureGuardError) else type(error).__name__, 'errorCode': error.args[0] if error.args and isinstance(error.args[0], int) else None}))
    sys.exit(1)
