import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMiniMaxMusic3StudioState, isRetiredMiniMaxMusicApi } from './minimax-music3-fallback.js';
test('MiniMax Music3 fallback only matches the explicit official retirement response', () => {
    assert.equal(isRetiredMiniMaxMusicApi({
        Code: 0,
        Data: null,
        Msg: 'MiniMax 音乐生成失败：410 - This Music API is no longer available to new users.',
    }), true);
    assert.equal(isRetiredMiniMaxMusicApi({ Code: 0, Data: null, Msg: '410 quota exceeded' }), false);
    assert.equal(isRetiredMiniMaxMusicApi({ Code: 0, Data: null, Msg: '500 MiniMax-Music3 unavailable' }), false);
});
test('Music3 state is original, instrumental, and loop-directed', () => {
    const state = buildMiniMaxMusic3StudioState('Original neon puzzle theme.');
    assert.equal(state.instrumental, true);
    assert.equal(state.lyrics, '[instrumental]');
    assert.match(String(state.vocals), /No singing/u);
    assert.match(String(state.arrangement), /crossfade seamlessly/u);
    assert.match(String(state.arrangement), /Original neon puzzle theme/u);
});
//# sourceMappingURL=minimax-music3-fallback.test.js.map