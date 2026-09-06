import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaModelOptions, selectMediaModel } from '../src/views/ai-engine/media-models.js';

test('media choices carry the current tenant record and real model, excluding unsupported adapters', () => {
    const options = mediaModelOptions([{ AiModelId: 'tenant-row', Name: '中转', IsGateway: true, Models: [
        { Id: 'future-image', Capability: 'image', Supported: true },
        { Id: 'no-adapter', Capability: 'image', Supported: false },
        { Id: 'music-3.0', Capability: 'music' }
    ] }], 'image');
    assert.equal(options.length, 1);
    assert.equal(options[0].AiModelId, 'tenant-row');
    assert.equal(options[0].Model, 'future-image');
    assert.equal(options[0].IsGateway, true);
});

test('an unavailable selected route never silently changes provider', () => {
    const direct = { key: 'direct:one', IsGateway: false }, gateway = { key: 'gateway:one', IsGateway: true };
    assert.equal(selectMediaModel([direct, gateway], null, true), gateway);
    assert.equal(selectMediaModel([direct], null, true), null);
    assert.equal(selectMediaModel([direct], gateway, true), null);
    assert.equal(selectMediaModel([direct, gateway], direct, true), direct);
});

test('local edits require an edit model and never fall back to character reference', () => {
    const catalog = [{ AiModelId: 'relay', IsGateway: true, Models: [
        { Id: 'image-01', Capability: 'image', ReferenceMode: 'character-redraw' },
        { Id: 'future-image', Capability: 'image', ReferenceMode: 'image-edit' }
    ] }];
    assert.deepEqual(mediaModelOptions(catalog, 'image', 'erase').map(x => x.Model), ['future-image']);
    assert.equal(mediaModelOptions(catalog, 'image', 'text-to-image').length, 2);
});
