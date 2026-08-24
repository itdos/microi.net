using Jint;

namespace Microi.net
{
    /// <summary>
    /// Bridges the optional Microi.V8Engine extension registry into the open
    /// Core runtime without introducing a reverse project reference.
    /// </summary>
    public sealed class V8ExtensionInjector : IV8ExtensionInjector
    {
        public void InjectAll(Engine engine)
        {
            V8ExtensionRegistry.InjectAll(engine);
        }
    }
}
