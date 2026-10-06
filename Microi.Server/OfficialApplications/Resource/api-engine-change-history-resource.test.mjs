import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const packageModel = JSON.parse(fs.readFileSync(new URL('./app.microi.form-engine.json', import.meta.url), 'utf8'))
const importerSource = fs.readFileSync(new URL('./import-package.js', import.meta.url), 'utf8')

test('form engine package exposes api engine history as a real TableChild', () => {
  const historyTable = packageModel.DiyTables.find(item => item.Name === 'mci_apiengine_change_history')
  assert.ok(historyTable)
  assert.equal(historyTable.FormLabelPosition, 'top')

  const parentField = packageModel.DiyFields.find(item => item.TableId === 'cf389aef-72cc-4980-9c5b-143123561ac0'
    && item.Name === 'ChangeHistoryRows')
  assert.ok(parentField)
  assert.equal(parentField.Component, 'TableChild')
  assert.equal(parentField.Type, '1')
  const config = JSON.parse(parentField.Config)
  assert.equal(config.TableChildTableId, historyTable.Id)
  assert.equal(config.TableChildFkFieldName, 'ApiEngineId')

  const legacyField = packageModel.DiyFields.find(item => item.Id === '01KS68M8VHK2AF8Q0DVMDCC9Q3')
  assert.equal(legacyField.Name, 'ChangeHistory')
  assert.equal(legacyField.Visible, 0)

  const ddl = packageModel.DDLStatements.find(item => item.TableName === historyTable.Name)?.DDL || ''
  assert.match(ddl, /UNIQUE KEY `ux_mci_apiengine_history_entry` \(`EntryKey`\)/)
  assert.match(ddl, /KEY `ix_mci_apiengine_history_engine_time` \(`ApiEngineId`, `CreateTime`\)/)
})

test('installer migrates legacy ChangeHistory lines idempotently after schema installation', () => {
  assert.match(importerSource, /API_ENGINE_CHANGE_HISTORY_TABLECHILD_MIGRATION_V1/)
  assert.match(importerSource, /mci_apiengine_change_history/)
  assert.match(importerSource, /Sha256Hex/)
  assert.match(importerSource, /split\(\/\\r\?\\n\/\)/)
  assert.match(importerSource, /EntryKey/)
  assert.match(importerSource, /'UpdateTime', 'IsDeleted'/)
  assert.match(importerSource, /Number\(legacyEngine\.IsDeleted \|\| 0\) === 1/)
  assert.doesNotMatch(importerSource, /_Where:\s*\[\['IsDeleted', '<>', 1\]\]/)
  assert.match(importerSource, /getTargetPhysicalColumns\('sys_apiengine'\)/)
  assert.match(importerSource, /if \(!legacyApiEngineColumns\.changehistory\)/)
  assert.match(importerSource, /旧 ChangeHistory 不可读取/)
})
