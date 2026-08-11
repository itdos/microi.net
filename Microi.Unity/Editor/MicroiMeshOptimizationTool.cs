using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

namespace Microi.Unity.Editor
{
    public sealed class MicroiMeshOptimizationTool : EditorWindow
    {
        private sealed class CombineGroup
        {
            public Material Material;
            public readonly List<CombineInstance> Instances = new List<CombineInstance>();
            public readonly HashSet<MeshRenderer> Renderers = new HashSet<MeshRenderer>();
        }

        private int minimumPartsPerMaterial = 3;
        private bool includeInactive;
        private Vector2 scroll;

        [MenuItem("Microi/Unity/Toolbox/Mesh Combine...")]
        public static void Open()
        {
            GetWindow<MicroiMeshOptimizationTool>("Microi Mesh Combine");
        }

        private void OnGUI()
        {
            scroll = EditorGUILayout.BeginScrollView(scroll);
            EditorGUILayout.LabelField("Recoverable mesh combine", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox(
                "This tool only examines the selected scene root. It creates new mesh assets, disables only the renderers " +
                "that were actually combined, and records their exact references for restoration. It never searches the whole scene by name.",
                MessageType.Info);

            minimumPartsPerMaterial = EditorGUILayout.IntSlider("Minimum parts / material", minimumPartsPerMaterial, 2, 20);
            includeInactive = EditorGUILayout.Toggle("Include inactive hierarchy", includeInactive);

            var selected = Selection.activeGameObject;
            using (new EditorGUI.DisabledScope(selected == null || !selected.scene.IsValid()))
            {
                if (GUILayout.Button("Analyze selected root"))
                {
                    Analyze(selected);
                }

                if (GUILayout.Button("Combine selected root", GUILayout.Height(34)))
                {
                    Combine(selected);
                }
            }

            EditorGUILayout.Space(14);
            EditorGUILayout.HelpBox(
                "Restore re-enables the recorded source renderers and removes the generated scene objects through Unity Undo. " +
                "Generated .asset meshes are deliberately retained so restoration is recoverable and source control can review them.",
                MessageType.None);

            using (new EditorGUI.DisabledScope(selected == null))
            {
                if (GUILayout.Button("Restore combine under selection"))
                {
                    Restore(selected);
                }
            }

            EditorGUILayout.EndScrollView();
        }

        private void Analyze(GameObject root)
        {
            var groups = BuildGroups(root);
            var eligible = groups.Values.Where(group => group.Instances.Count >= minimumPartsPerMaterial).ToArray();
            var renderers = eligible.SelectMany(group => group.Renderers).Distinct().Count();
            var instances = eligible.Sum(group => group.Instances.Count);
            var triangles = eligible.Sum(group => group.Instances.Sum(instance => GetTriangleCount(instance.mesh, instance.subMeshIndex)));

            EditorUtility.DisplayDialog(
                "Microi mesh analysis",
                $"Selected root: {root.name}\n" +
                $"Eligible material groups: {eligible.Length}\n" +
                $"Source renderers: {renderers}\n" +
                $"Sub-mesh instances: {instances}\n" +
                $"Triangles: {triangles:N0}\n\n" +
                "No changes were made.",
                "OK");
        }

        private void Combine(GameObject root)
        {
            if (root.GetComponentInChildren<MicroiMeshCombineMarker>(true) != null)
            {
                EditorUtility.DisplayDialog(
                    "Already combined",
                    "A Microi combine marker already exists under this selection. Restore it before combining again.",
                    "OK");
                return;
            }

            var groups = BuildGroups(root).Values
                .Where(group => group.Instances.Count >= minimumPartsPerMaterial)
                .ToArray();
            if (groups.Length == 0)
            {
                EditorUtility.DisplayDialog("Nothing to combine", "No material group meets the configured minimum.", "OK");
                return;
            }

            var sourceRenderers = groups.SelectMany(group => group.Renderers).Distinct().ToArray();
            var instanceCount = groups.Sum(group => group.Instances.Count);
            if (!EditorUtility.DisplayDialog(
                    "Combine selected root",
                    $"Root: {root.name}\nMaterial groups: {groups.Length}\nSub-mesh instances: {instanceCount}\n" +
                    $"Source renderers to disable: {sourceRenderers.Length}\n\n" +
                    "New mesh assets will be written under Assets/MicroiGenerated/CombinedMeshes. Continue?",
                    "Combine",
                    "Cancel"))
            {
                return;
            }

            Undo.IncrementCurrentGroup();
            var undoGroup = Undo.GetCurrentGroup();
            Undo.SetCurrentGroupName("Microi mesh combine");
            GameObject container = null;
            var generatedMeshes = new List<Mesh>();

            try
            {
                var assetFolder = EnsureAssetFolder("Assets/MicroiGenerated/CombinedMeshes");
                container = new GameObject($"MicroiCombined_{Sanitize(root.name)}");
                Undo.RegisterCreatedObjectUndo(container, "Create Microi combined meshes");
                container.transform.SetParent(root.transform, false);

                for (var index = 0; index < groups.Length; index++)
                {
                    var group = groups[index];
                    EditorUtility.DisplayProgressBar(
                        "Microi mesh combine",
                        group.Material == null ? "Material" : group.Material.name,
                        index / (float)groups.Length);

                    var mesh = new Mesh
                    {
                        name = $"{Sanitize(root.name)}_{Sanitize(group.Material.name)}",
                        indexFormat = IndexFormat.UInt32
                    };
                    mesh.CombineMeshes(group.Instances.ToArray(), true, true, false);
                    mesh.RecalculateBounds();

                    var assetPath = AssetDatabase.GenerateUniqueAssetPath(
                        $"{assetFolder}/{mesh.name}.asset");
                    AssetDatabase.CreateAsset(mesh, assetPath);
                    generatedMeshes.Add(mesh);

                    var child = new GameObject(group.Material.name);
                    Undo.RegisterCreatedObjectUndo(child, "Create Microi combined material group");
                    child.transform.SetParent(container.transform, false);
                    child.AddComponent<MeshFilter>().sharedMesh = mesh;
                    child.AddComponent<MeshRenderer>().sharedMaterial = group.Material;
                }

                Undo.RecordObjects(sourceRenderers, "Disable Microi source renderers");
                foreach (var renderer in sourceRenderers)
                {
                    renderer.enabled = false;
                    EditorUtility.SetDirty(renderer);
                }

                var marker = Undo.AddComponent<MicroiMeshCombineMarker>(container);
                marker.Initialize(sourceRenderers.Cast<Renderer>().ToArray(), generatedMeshes.ToArray());
                EditorUtility.SetDirty(marker);

                AssetDatabase.SaveAssets();
                EditorSceneManager.MarkSceneDirty(root.scene);
                Undo.CollapseUndoOperations(undoGroup);
                Selection.activeGameObject = container;
                EditorUtility.DisplayDialog(
                    "Combine complete",
                    $"Created {generatedMeshes.Count} combined meshes.\nDisabled {sourceRenderers.Length} source renderers.\n\n" +
                    "Use Restore combine under selection or Edit → Undo to revert the scene change.",
                    "OK");
            }
            catch (Exception exception)
            {
                Debug.LogException(exception);
                Undo.RevertAllDownToGroup(undoGroup);
                EditorUtility.DisplayDialog(
                    "Mesh combine failed",
                    exception.Message + "\n\nScene changes were reverted. Any generated asset is retained for review.",
                    "OK");
            }
            finally
            {
                EditorUtility.ClearProgressBar();
            }
        }

        private Dictionary<Material, CombineGroup> BuildGroups(GameObject root)
        {
            var groups = new Dictionary<Material, CombineGroup>();
            var rootToLocal = root.transform.worldToLocalMatrix;

            foreach (var filter in root.GetComponentsInChildren<MeshFilter>(includeInactive))
            {
                var mesh = filter.sharedMesh;
                var renderer = filter.GetComponent<MeshRenderer>();
                if (mesh == null || renderer == null || !renderer.enabled ||
                    (!includeInactive && !filter.gameObject.activeInHierarchy) ||
                    filter.GetComponentInParent<MicroiMeshCombineMarker>() != null)
                {
                    continue;
                }

                var materials = renderer.sharedMaterials;
                var subMeshCount = Math.Min(mesh.subMeshCount, materials.Length);
                for (var subMeshIndex = 0; subMeshIndex < subMeshCount; subMeshIndex++)
                {
                    var material = materials[subMeshIndex];
                    if (material == null)
                    {
                        continue;
                    }

                    if (!groups.TryGetValue(material, out var group))
                    {
                        group = new CombineGroup { Material = material };
                        groups.Add(material, group);
                    }

                    group.Instances.Add(new CombineInstance
                    {
                        mesh = mesh,
                        subMeshIndex = subMeshIndex,
                        transform = rootToLocal * filter.transform.localToWorldMatrix
                    });
                    group.Renderers.Add(renderer);
                }
            }

            return groups;
        }

        private static void Restore(GameObject selection)
        {
            var markers = selection.GetComponentsInChildren<MicroiMeshCombineMarker>(true);
            if (markers.Length == 0)
            {
                var parentMarker = selection.GetComponentInParent<MicroiMeshCombineMarker>();
                markers = parentMarker == null ? Array.Empty<MicroiMeshCombineMarker>() : new[] { parentMarker };
            }

            if (markers.Length == 0)
            {
                EditorUtility.DisplayDialog("Nothing to restore", "No Microi mesh-combine marker was found.", "OK");
                return;
            }

            if (!EditorUtility.DisplayDialog(
                    "Restore combined meshes",
                    $"Restore {markers.Length} combine operation(s)? Generated mesh assets will be retained for recoverability.",
                    "Restore",
                    "Cancel"))
            {
                return;
            }

            Undo.IncrementCurrentGroup();
            var undoGroup = Undo.GetCurrentGroup();
            Undo.SetCurrentGroupName("Restore Microi combined meshes");
            var restored = 0;
            var scenes = new HashSet<UnityEngine.SceneManagement.Scene>();

            foreach (var marker in markers.Distinct())
            {
                var renderers = marker.SourceRenderers.Where(item => item != null).ToArray();
                Undo.RecordObjects(renderers, "Restore Microi source renderers");
                foreach (var renderer in renderers)
                {
                    renderer.enabled = true;
                    EditorUtility.SetDirty(renderer);
                    restored++;
                }

                scenes.Add(marker.gameObject.scene);
                Undo.DestroyObjectImmediate(marker.gameObject);
            }

            foreach (var scene in scenes)
            {
                if (scene.IsValid())
                {
                    EditorSceneManager.MarkSceneDirty(scene);
                }
            }

            Undo.CollapseUndoOperations(undoGroup);
            EditorUtility.DisplayDialog(
                "Restore complete",
                $"Re-enabled {restored} source renderers. Generated mesh assets were retained.",
                "OK");
        }

        private static long GetTriangleCount(Mesh mesh, int subMeshIndex)
        {
            return mesh == null || subMeshIndex < 0 || subMeshIndex >= mesh.subMeshCount
                ? 0
                : (long)mesh.GetIndexCount(subMeshIndex) / 3L;
        }

        private static string EnsureAssetFolder(string path)
        {
            var parts = path.Split('/');
            var current = parts[0];
            for (var index = 1; index < parts.Length; index++)
            {
                var next = current + "/" + parts[index];
                if (!AssetDatabase.IsValidFolder(next))
                {
                    AssetDatabase.CreateFolder(current, parts[index]);
                }

                current = next;
            }

            return current;
        }

        private static string Sanitize(string value)
        {
            var invalid = Path.GetInvalidFileNameChars();
            var chars = (value ?? "Mesh").Select(character => invalid.Contains(character) || character == ' ' ? '_' : character).ToArray();
            return new string(chars);
        }
    }
}
