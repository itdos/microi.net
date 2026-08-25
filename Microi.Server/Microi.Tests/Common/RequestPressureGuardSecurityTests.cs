using System.Collections;
using System.Reflection;
using Microi.net;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class RequestPressureGuardSecurityTests
{
    [Fact]
    public async Task AnonymousHighCardinalityInputs_CannotGrowGateRegistryWithoutBound()
    {
        var options = new RequestPressureGuardOptions();
        for (var index = 0; index < 5000; index++)
        {
            using var lease = await RequestPressureGuardService.TryEnterAsync(
                $"/api/random-controller-{index}/random-action-{index}",
                $"attacker-tenant-{index}",
                options,
                CancellationToken.None);
            Assert.True(lease.IsEntered);
        }

        var field = typeof(RequestPressureGuardService).GetField(
            "Gates",
            BindingFlags.Static | BindingFlags.NonPublic);
        var gates = field?.GetValue(null);
        Assert.NotNull(gates);
        var count = Assert.IsType<int>(gates.GetType().GetProperty("Count")?.GetValue(gates));
        Assert.InRange(count, 1, 4110);

        foreach (var entry in Assert.IsAssignableFrom<IEnumerable>(gates))
        {
            var key = entry?.GetType().GetProperty("Key")?.GetValue(entry)?.ToString();
            Assert.DoesNotContain("attacker-tenant-", key ?? string.Empty, StringComparison.OrdinalIgnoreCase);
        }
    }
}
