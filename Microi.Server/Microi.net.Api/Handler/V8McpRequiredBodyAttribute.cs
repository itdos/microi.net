namespace Microi.net.Api
{
    /// <summary>
    /// Compatibility name for the V8/MCP controller. The implementation is
    /// shared with other DosResult controllers that have genuinely mandatory
    /// JSON bodies.
    /// </summary>
    public sealed class V8McpRequiredBodyAttribute : RequiredDosBodyAttribute
    {
    }
}
