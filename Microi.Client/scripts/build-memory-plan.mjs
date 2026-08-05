const GB = 1024 ** 3;
const MB = 1024 ** 2;

export function calculateBuildMemoryPlan({
    totalMemory,
    heapLimitMb,
    processTreePeakMb,
    pauseMemoryUsageRatio = 0.95
}) {
    if (!Number.isFinite(totalMemory) || totalMemory <= 0) {
        throw new TypeError('totalMemory 必须是正数。');
    }
    if (!Number.isFinite(heapLimitMb) || heapLimitMb <= 0) {
        throw new TypeError('heapLimitMb 必须是正数。');
    }
    if (processTreePeakMb !== undefined &&
        (!Number.isFinite(processTreePeakMb) || processTreePeakMb <= 0)) {
        throw new TypeError('processTreePeakMb 必须是正数。');
    }

    const criticalFreeMemory = totalMemory * (1 - pauseMemoryUsageRatio);
    const systemSafetyMemory = Math.max(1.5 * GB, criticalFreeMemory);
    const nativeOverheadMemory = Math.max(
        768 * MB,
        Math.min(1.5 * GB, heapLimitMb * MB * 0.2)
    );
    // 有实测进程树峰值时，它已包含 Node 堆、原生内存和子进程，不重复叠加；
    // 尚无实测数据的阶段才用“堆上限 + 有界原生开销”作为保守回退。
    const phaseBudgetMemory = processTreePeakMb === undefined
        ? heapLimitMb * MB + nativeOverheadMemory
        : processTreePeakMb * MB;
    const requiredStartMemory = systemSafetyMemory + phaseBudgetMemory;

    return {
        criticalFreeMemory,
        systemSafetyMemory,
        nativeOverheadMemory,
        phaseBudgetMemory,
        requiredStartMemory
    };
}
