using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Microi.Unity.Editor
{
    public static class MicroiSceneDiagnosticsTool
    {
        [MenuItem("Microi/Unity/Toolbox/Analyze Active Scene")]
        public static void AnalyzeActiveScene()
        {
            var scene = SceneManager.GetActiveScene();
            var filters = scene.GetRootGameObjects()
                .SelectMany(root => root.GetComponentsInChildren<MeshFilter>(true))
                .Where(filter => filter.sharedMesh != null)
                .ToArray();
            var renderers = filters.Select(filter => filter.GetComponent<MeshRenderer>()).Where(item => item != null).ToArray();
            var cameras = scene.GetRootGameObjects().SelectMany(root => root.GetComponentsInChildren<Camera>(true)).ToArray();
            var lights = scene.GetRootGameObjects().SelectMany(root => root.GetComponentsInChildren<Light>(true)).ToArray();
            var materials = new HashSet<Material>(renderers.SelectMany(renderer => renderer.sharedMaterials).Where(item => item != null));

            long vertices = 0;
            long triangles = 0;
            foreach (var filter in filters)
            {
                vertices += filter.sharedMesh.vertexCount;
                for (var subMesh = 0; subMesh < filter.sharedMesh.subMeshCount; subMesh++)
                {
                    triangles += (long)filter.sharedMesh.GetIndexCount(subMesh) / 3L;
                }
            }

            var activeRenderers = renderers.Count(renderer => renderer.enabled && renderer.gameObject.activeInHierarchy);
            var cameraPoints = cameras.Count(camera => camera.name.StartsWith("CameraPoint_", StringComparison.Ordinal));
            var report =
                $"Scene: {scene.name}\n" +
                $"Mesh filters: {filters.Length} ({activeRenderers} active renderers)\n" +
                $"Vertices: {vertices:N0}\nTriangles: {triangles:N0}\n" +
                $"Unique materials: {materials.Count}\nCameras: {cameras.Length}\nLights: {lights.Length}\n" +
                $"CameraPoint Camera components: {cameraPoints}\n\n" +
                "These are structural counts, not an FPS prediction. Use the Unity Profiler and a target-browser capture for performance acceptance.";

            Debug.Log("[Microi.Unity] " + report);
            EditorUtility.DisplayDialog("Microi scene diagnostics", report, "OK");
        }

        [MenuItem("Microi/Unity/Toolbox/Analyze Camera Depth Precision")]
        public static void AnalyzeCameraDepthPrecision()
        {
            var scene = SceneManager.GetActiveScene();
            var cameras = scene.GetRootGameObjects().SelectMany(root => root.GetComponentsInChildren<Camera>(true)).ToArray();
            if (cameras.Length == 0)
            {
                EditorUtility.DisplayDialog("Camera depth precision", "No cameras exist in the active scene.", "OK");
                return;
            }

            var lines = cameras.Select(camera =>
            {
                var ratio = camera.farClipPlane / Mathf.Max(0.001f, camera.nearClipPlane);
                var level = ratio <= 1000f ? "good" : ratio <= 5000f ? "review" : "high risk";
                return $"{camera.name}: near {camera.nearClipPlane:0.###}, far {camera.farClipPlane:0.#}, ratio {ratio:0} ({level})";
            });
            var report = string.Join("\n", lines) +
                         "\n\nDepth ratio is a diagnostic signal only. Increase the near plane or reduce the far plane only after checking close-up clipping.";
            Debug.Log("[Microi.Unity] Camera depth precision\n" + report);
            EditorUtility.DisplayDialog("Camera depth precision", report, "OK");
        }

        [MenuItem("Microi/Unity/Toolbox/Remove Camera Components From Selected CameraPoints")]
        public static void RemoveSelectedCameraPointCameras()
        {
            var roots = Selection.gameObjects.Where(item => item.scene.IsValid()).ToArray();
            var cameras = roots
                .SelectMany(root => root.GetComponentsInChildren<Camera>(true))
                .Where(camera => camera.name.StartsWith("CameraPoint_", StringComparison.Ordinal))
                .Distinct()
                .ToArray();
            if (cameras.Length == 0)
            {
                EditorUtility.DisplayDialog("Nothing to remove", "No CameraPoint_ Camera components exist under the selection.", "OK");
                return;
            }

            if (!EditorUtility.DisplayDialog(
                    "Remove selected Camera components",
                    $"Remove {cameras.Length} Camera components under the selected roots? Transform camera points are retained and the operation supports Unity Undo.",
                    "Remove",
                    "Cancel"))
            {
                return;
            }

            var scenes = new HashSet<Scene>();
            foreach (var camera in cameras)
            {
                scenes.Add(camera.gameObject.scene);
                Undo.DestroyObjectImmediate(camera);
            }

            foreach (var scene in scenes)
            {
                EditorSceneManager.MarkSceneDirty(scene);
            }
        }
    }

    public sealed class MicroiWebGLQualityTool : EditorWindow
    {
        [Serializable]
        private sealed class QualityBackup
        {
            public string format = "Microi.Unity.QualityBackup/1";
            public string createdAtUtc;
            public string qualityLevel;
            public int shadows;
            public float shadowDistance;
            public int shadowCascades;
            public int antiAliasing;
            public int pixelLightCount;
            public int shadowResolution;
            public bool softParticles;
            public bool realtimeReflectionProbes;
            public int anisotropicFiltering;
            public int vSyncCount;
        }

        private enum Preset
        {
            Balanced,
            HighDefinition
        }

        private Preset preset = Preset.HighDefinition;
        private float cameraNearPlane = 0.3f;
        private float cameraFarPlane = 800f;
        private Vector2 scroll;

        [MenuItem("Microi/Unity/Toolbox/WebGL Quality and Depth...")]
        public static void Open()
        {
            GetWindow<MicroiWebGLQualityTool>("Microi WebGL Quality");
        }

        private void OnGUI()
        {
            scroll = EditorGUILayout.BeginScrollView(scroll);
            EditorGUILayout.LabelField("Reversible WebGL quality preset", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox(
                "The selected preset affects only the currently active Unity quality level. A JSON snapshot is saved before changes. " +
                "High Definition favors the requested visual quality; Balanced is intended for lower-power browsers.",
                MessageType.Info);
            EditorGUILayout.LabelField("Active quality level", QualitySettings.names[QualitySettings.GetQualityLevel()]);
            preset = (Preset)EditorGUILayout.EnumPopup("Preset", preset);
            if (GUILayout.Button("Back up and apply preset"))
            {
                ApplyPreset();
            }

            if (GUILayout.Button("Restore quality backup JSON..."))
            {
                RestorePreset();
            }

            EditorGUILayout.Space(16);
            EditorGUILayout.LabelField("Selected-camera depth", EditorStyles.boldLabel);
            cameraNearPlane = EditorGUILayout.FloatField("Near clip plane", cameraNearPlane);
            cameraFarPlane = EditorGUILayout.FloatField("Far clip plane", cameraFarPlane);
            var selectedCameras = Selection.gameObjects
                .SelectMany(item => item.GetComponentsInChildren<Camera>(true))
                .Distinct()
                .ToArray();
            EditorGUILayout.LabelField("Selected cameras", selectedCameras.Length.ToString());
            using (new EditorGUI.DisabledScope(selectedCameras.Length == 0 || cameraNearPlane <= 0f || cameraFarPlane <= cameraNearPlane))
            {
                if (GUILayout.Button("Apply depth to selected cameras"))
                {
                    ApplyCameraDepth(selectedCameras);
                }
            }

            EditorGUILayout.HelpBox(
                "Camera changes use Unity Undo. Preview close-up geometry after increasing the near plane, then validate the real WebGL build in a target browser.",
                MessageType.None);
            EditorGUILayout.EndScrollView();
        }

        private void ApplyPreset()
        {
            var backupPath = WriteQualityBackup(CreateQualityBackup());
            if (!EditorUtility.DisplayDialog(
                    "Apply WebGL quality preset",
                    $"Preset: {preset}\nQuality level: {QualitySettings.names[QualitySettings.GetQualityLevel()]}\n\n" +
                    $"Backup: {backupPath}\n\nContinue?",
                    "Apply",
                    "Cancel"))
            {
                return;
            }

            if (preset == Preset.HighDefinition)
            {
                QualitySettings.shadows = ShadowQuality.All;
                QualitySettings.shadowDistance = 100f;
                QualitySettings.shadowCascades = 2;
                QualitySettings.antiAliasing = 4;
                QualitySettings.pixelLightCount = 4;
                QualitySettings.shadowResolution = ShadowResolution.High;
                QualitySettings.softParticles = true;
                QualitySettings.realtimeReflectionProbes = false;
                QualitySettings.anisotropicFiltering = AnisotropicFiltering.Enable;
            }
            else
            {
                QualitySettings.shadows = ShadowQuality.HardOnly;
                QualitySettings.shadowDistance = 60f;
                QualitySettings.shadowCascades = 2;
                QualitySettings.antiAliasing = 2;
                QualitySettings.pixelLightCount = 2;
                QualitySettings.shadowResolution = ShadowResolution.Medium;
                QualitySettings.softParticles = false;
                QualitySettings.realtimeReflectionProbes = false;
                QualitySettings.anisotropicFiltering = AnisotropicFiltering.Enable;
            }

            QualitySettings.vSyncCount = 0;
            EditorUtility.DisplayDialog("Preset applied", $"Applied {preset}. Backup retained at:\n{backupPath}", "OK");
        }

        private static void ApplyCameraDepth(Camera[] cameras)
        {
            var window = GetWindow<MicroiWebGLQualityTool>();
            if (!EditorUtility.DisplayDialog(
                    "Apply selected-camera depth",
                    $"Cameras: {cameras.Length}\nNear: {window.cameraNearPlane}\nFar: {window.cameraFarPlane}\n\nContinue?",
                    "Apply",
                    "Cancel"))
            {
                return;
            }

            Undo.RecordObjects(cameras, "Apply Microi WebGL camera depth");
            var scenes = new HashSet<Scene>();
            foreach (var camera in cameras)
            {
                camera.nearClipPlane = window.cameraNearPlane;
                camera.farClipPlane = window.cameraFarPlane;
                camera.allowMSAA = true;
                EditorUtility.SetDirty(camera);
                scenes.Add(camera.gameObject.scene);
            }

            foreach (var scene in scenes)
            {
                EditorSceneManager.MarkSceneDirty(scene);
            }
        }

        private static QualityBackup CreateQualityBackup()
        {
            return new QualityBackup
            {
                createdAtUtc = DateTime.UtcNow.ToString("O"),
                qualityLevel = QualitySettings.names[QualitySettings.GetQualityLevel()],
                shadows = (int)QualitySettings.shadows,
                shadowDistance = QualitySettings.shadowDistance,
                shadowCascades = QualitySettings.shadowCascades,
                antiAliasing = QualitySettings.antiAliasing,
                pixelLightCount = QualitySettings.pixelLightCount,
                shadowResolution = (int)QualitySettings.shadowResolution,
                softParticles = QualitySettings.softParticles,
                realtimeReflectionProbes = QualitySettings.realtimeReflectionProbes,
                anisotropicFiltering = (int)QualitySettings.anisotropicFiltering,
                vSyncCount = QualitySettings.vSyncCount
            };
        }

        private static void RestorePreset()
        {
            var path = EditorUtility.OpenFilePanel("Restore Microi quality backup", GetBackupDirectory(), "json");
            if (string.IsNullOrWhiteSpace(path))
            {
                return;
            }

            QualityBackup backup;
            try
            {
                backup = JsonUtility.FromJson<QualityBackup>(File.ReadAllText(path));
            }
            catch (Exception exception)
            {
                EditorUtility.DisplayDialog("Invalid backup", exception.Message, "OK");
                return;
            }

            if (backup == null || backup.format != "Microi.Unity.QualityBackup/1")
            {
                EditorUtility.DisplayDialog("Invalid backup", "This is not a supported Microi quality backup.", "OK");
                return;
            }

            if (!EditorUtility.DisplayDialog(
                    "Restore quality settings",
                    $"Backup quality level: {backup.qualityLevel}\nCreated: {backup.createdAtUtc}\n\n" +
                    "Values will be applied to the currently active quality level. Continue?",
                    "Restore",
                    "Cancel"))
            {
                return;
            }

            QualitySettings.shadows = (ShadowQuality)backup.shadows;
            QualitySettings.shadowDistance = backup.shadowDistance;
            QualitySettings.shadowCascades = backup.shadowCascades;
            QualitySettings.antiAliasing = backup.antiAliasing;
            QualitySettings.pixelLightCount = backup.pixelLightCount;
            QualitySettings.shadowResolution = (ShadowResolution)backup.shadowResolution;
            QualitySettings.softParticles = backup.softParticles;
            QualitySettings.realtimeReflectionProbes = backup.realtimeReflectionProbes;
            QualitySettings.anisotropicFiltering = (AnisotropicFiltering)backup.anisotropicFiltering;
            QualitySettings.vSyncCount = backup.vSyncCount;
        }

        private static string WriteQualityBackup(QualityBackup backup)
        {
            var directory = GetBackupDirectory();
            Directory.CreateDirectory(directory);
            var path = Path.Combine(directory, $"quality-{DateTime.UtcNow:yyyyMMdd-HHmmss}.json");
            File.WriteAllText(path, JsonUtility.ToJson(backup, true));
            return path;
        }

        private static string GetBackupDirectory()
        {
            var projectRoot = Directory.GetParent(Application.dataPath)?.FullName ?? Directory.GetCurrentDirectory();
            return Path.Combine(projectRoot, "ProjectSettings", "MicroiUnityBackups");
        }
    }
}
