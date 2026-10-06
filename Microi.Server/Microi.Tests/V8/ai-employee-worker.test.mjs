import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {officialRepositorySource} from './official-application-source.mjs';
const source = pathToFileURL(path.join(officialRepositorySource('microi.openclaw'),'server/services/employee-worker.test.cjs'));
await import(source.href);
