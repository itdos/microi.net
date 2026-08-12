using UnityEngine;

namespace Microi.Unity
{
    /// <summary>
    /// Records the source renderers for a mesh-combine operation so the Editor
    /// toolbox can restore them without guessing by object name.
    /// </summary>
    [DisallowMultipleComponent]
    [AddComponentMenu("")]
    public sealed class MicroiMeshCombineMarker : MonoBehaviour
    {
        [SerializeField, HideInInspector]
        private Renderer[] sourceRenderers = System.Array.Empty<Renderer>();

        [SerializeField, HideInInspector]
        private Mesh[] generatedMeshes = System.Array.Empty<Mesh>();

        public Renderer[] SourceRenderers => sourceRenderers;

        public Mesh[] GeneratedMeshes => generatedMeshes;

        public void Initialize(Renderer[] renderers, Mesh[] meshes)
        {
            sourceRenderers = renderers ?? System.Array.Empty<Renderer>();
            generatedMeshes = meshes ?? System.Array.Empty<Mesh>();
        }
    }
}
