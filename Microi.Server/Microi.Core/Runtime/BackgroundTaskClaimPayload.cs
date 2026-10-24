using System;
using System.Threading;

namespace Microi.net
{
    /// <summary>
    /// Loads execution data after a lightweight claim, outside the dispatcher.
    /// No user code may run until the durable claim has been checked again.
    /// </summary>
    internal static class BackgroundTaskClaimPayload
    {
        internal static BackgroundTaskRecord Prepare(
            BackgroundTaskRecord claim,
            Func<BackgroundTaskRecord> read,
            Func<bool> isCurrent,
            Action release,
            Action<Exception> report,
            CancellationToken cancellationToken)
        {
            try
            {
                cancellationToken.ThrowIfCancellationRequested();
                var payload = read();
                if (MatchesClaim(claim, payload) && isCurrent()
                    && payload.LeaseExpiresAt > DateTime.Now)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    return payload;
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                // Nothing has executed; return this claim without spending a
                // business retry, just as a contention-delayed claim is returned.
            }
            catch (Exception error)
            {
                Report(report, error);
            }

            // The release delegate uses the original owner/fence, never values
            // from an unconfirmed payload. A different owner's claim is untouched.
            try { release(); }
            catch (Exception error) { Report(report, error); }
            return null;
        }

        private static bool MatchesClaim(BackgroundTaskRecord claim, BackgroundTaskRecord payload)
        {
            return claim != null && payload != null
                && !string.IsNullOrEmpty(claim.LeaseOwner)
                && claim.FencingToken > 0
                && string.Equals(payload.Id, claim.Id, StringComparison.Ordinal)
                && string.Equals(payload.OsClient, claim.OsClient, StringComparison.OrdinalIgnoreCase)
                && string.Equals(payload.ApiEngineKey, claim.ApiEngineKey, StringComparison.Ordinal)
                && string.Equals(payload.Status, "Running", StringComparison.Ordinal)
                && string.Equals(payload.LeaseOwner, claim.LeaseOwner, StringComparison.Ordinal)
                && payload.FencingToken == claim.FencingToken;
        }

        private static void Report(Action<Exception> report, Exception error)
        {
            try { report(error); } catch { }
        }
    }
}
