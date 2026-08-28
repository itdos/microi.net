import type { ApiResponse, MicroiClient } from './microi-client.js';
export declare const MINIMAX_MUSIC3_MODEL = "MiniMaxAI/MiniMax-Music3";
export declare const MINIMAX_MUSIC3_SPACE = "https://minimaxai-minimax-music3.hf.space";
export interface MiniMaxMusic3FallbackInput {
    apiBaseUrl: string;
    osClient: string;
    requestId: string;
    prompt: string;
    durationSeconds?: number;
    stateDirectory?: string;
}
export declare function isRetiredMiniMaxMusicApi(result: ApiResponse): boolean;
export declare function buildMiniMaxMusic3StudioState(prompt: string): Record<string, unknown>;
export declare function generateMiniMaxMusic3Fallback(client: MicroiClient, input: MiniMaxMusic3FallbackInput): Promise<ApiResponse<Record<string, unknown>>>;
//# sourceMappingURL=minimax-music3-fallback.d.ts.map