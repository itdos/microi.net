using Jint;

namespace Microi.net
{
    /// <summary>
    /// Creates the tenant-bound AI facade used by one V8 execution.
    ///
    /// The implementation lives in the closed platform assembly because it owns
    /// the local product-license boundary.  The open V8 runtime only consumes the
    /// already-bound facade and cannot manufacture a licensed state itself.
    /// </summary>
    public interface IV8TenantAiFactory
    {
        IV8AI Create(string osClient, object currentUser);
    }

    /// <summary>
    /// Supplies a display-only product edition to observability.  License
    /// validation and feature enforcement stay in the closed implementation.
    /// </summary>
    public interface IPlatformProductEditionProvider
    {
        string GetProductEdition();
    }

    /// <summary>
    /// Injects optional open-source V8 extension packages without making
    /// Microi.Core depend on those packages (which already depend on Core).
    /// </summary>
    public interface IV8ExtensionInjector
    {
        void InjectAll(Engine engine);
    }
}
