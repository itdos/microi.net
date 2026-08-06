import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const formSource = fs.readFileSync(
  path.resolve(here, '../src/views/form-engine/diy-form.vue'),
  'utf8',
);

test('loads async field options from the newly assigned reactive field list', () => {
  const assignmentIndex = formSource.indexOf('self.DiyFieldList = resultGetDiyField.Data;');
  const loadIndex = formSource.indexOf(
    'self.DiyCommon.SetFieldsData(self.DiyFieldList, formData, self.TableChildAuth);',
    assignmentIndex,
  );
  const readyIndex = formSource.indexOf('self.LoadDiyFieldList = true;', assignmentIndex);

  assert.notEqual(assignmentIndex, -1, 'form must assign the current field response');
  assert.ok(loadIndex > assignmentIndex, 'option loading must use the current reactive field list');
  assert.ok(loadIndex < readyIndex, 'option loading must be registered in the same initialization cycle');
});

test('does not issue a bulk option request against the stale field list', () => {
  const assignmentIndex = formSource.indexOf('self.DiyFieldList = resultGetDiyField.Data;');
  const beforeAssignment = formSource.slice(0, assignmentIndex);

  assert.equal(
    beforeAssignment.includes('self.DiyCommon.SetFieldsData(self.DiyFieldList, formData, self.TableChildAuth);'),
    false,
  );
});
