import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createFileCabinetOfficeSession,
  createOfficeDocumentKey,
  isOfficeFileType,
  isOfficeHistoryPath
} from '../src/utils/office-document.js'

test('file cabinet routes Office files with exact object and menu context', () => {
  const file = { filePath: 'itdos/contracts/A.docx', name: 'A.docx', type: 'docx', size: 123 }
  const session = createFileCabinetOfficeSession(file, { limit: true, sysMenuId: 'real-file-menu' })
  assert.equal(session.fileCabinetPath, file.filePath)
  assert.equal(session.filePathName, file.filePath)
  assert.equal(session.sysMenuId, 'real-file-menu')
  assert.equal(session.fileCabinetLimit, true)
  assert.equal(session.enableOfficeVersion, true)
  assert.equal(session.canEdit, true)
  assert.equal('authorization' in session, false)
  assert.equal('DownloadUrl' in session, false)
  assert.throws(() => createFileCabinetOfficeSession({ ...file, type: 'pdf' }, { limit: false, sysMenuId: 'real-file-menu' }))
  assert.throws(() => createFileCabinetOfficeSession(file, { limit: true, sysMenuId: '' }))
  assert.throws(() => createFileCabinetOfficeSession({ ...file, type: 'exe' }, { limit: true, sysMenuId: 'real-file-menu' }))
  assert.equal(isOfficeFileType('XLSX'), true)
  assert.equal(isOfficeFileType('zip'), false)
})

test('OnlyOffice key shares one collaboration room per persisted version', () => {
  const state = { tenant: 'itdos', bucket: 'private', path: 'itdos/contracts/A.docx', version: 'v1.0.0', updatedAt: '' }
  const key = createOfficeDocumentKey(state)
  assert.equal(key, createOfficeDocumentKey({ ...state }))
  assert.match(key, /^document-[a-f0-9]+-[a-f0-9]+$/)
  assert.notEqual(key, createOfficeDocumentKey({ ...state, version: 'v1.0.1' }))
  assert.notEqual(key, createOfficeDocumentKey({ ...state, updatedAt: '2026-09-27 10:00:00' }))
  assert.notEqual(key, createOfficeDocumentKey({ ...state, tenant: 'other' }))
  assert.notEqual(key, createOfficeDocumentKey({ ...state, bucket: 'public' }))
})

test('file cabinet hides internal history but leaves ordinary objects visible', () => {
  assert.equal(isOfficeHistoryPath('itdos/.microi-office-history/a/manifest.json'), true)
  assert.equal(isOfficeHistoryPath('/itdos/.microi-office-history/a/manifest.json'), true)
  assert.equal(isOfficeHistoryPath('itdos/docs/.microi-office-history/a.docx'), false)
  assert.equal(isOfficeHistoryPath('itdos/docs/my.microi-office-history.docx'), false)
})
