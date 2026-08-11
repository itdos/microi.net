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
    public sealed class MicroiCameraPointTool : EditorWindow
    {
        [Serializable]
        private sealed class CameraPointCollection
        {
            public string format = "Microi.Unity.CameraPoints/1";
            public CameraPointRecord[] points = Array.Empty<CameraPointRecord>();
        }

        [Serializable]
        private sealed class CameraPointRecord
        {
            public string hierarchyPath;
            public Vector3 position;
            public Vector3 eulerAngles;
            public Vector3 localScale;
            public bool hasCamera;
            public CameraRecord camera;
        }

        [Serializable]
        private sealed class CameraRecord
        {
            public int clearFlags;
            public Color backgroundColor;
            public int cullingMask;
            public bool orthographic;
            public float fieldOfView;
            public float orthographicSize;
            public float nearClipPlane;
            public float farClipPlane;
            public float depth;
            public int renderingPath;
            public bool allowHdr;
            public bool allowMsaa;
        }

        private string namePrefix = "CameraPoint_";
        private bool includeInactive = true;
        private bool createMissingObjects = true;
        private bool restoreCameraComponents = true;
        private Vector2 scroll;

        [MenuItem("Microi/Unity/Toolbox/Camera Points...")]
        public static void Open()
        {
            GetWindow<MicroiCameraPointTool>("Microi Camera Points");
        }

        private void OnGUI()
        {
            scroll = EditorGUILayout.BeginScrollView(scroll);
            EditorGUILayout.LabelField("Camera point import / export", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox(
                "Only objects in the active scene whose names start with the configured prefix are included. " +
                "The JSON stores a hierarchy path and optional Camera settings; no project asset is overwritten during export.",
                MessageType.Info);

            namePrefix = EditorGUILayout.TextField("Name prefix", namePrefix);
            includeInactive = EditorGUILayout.Toggle("Include inactive objects", includeInactive);

            using (new EditorGUILayout.HorizontalScope())
            {
                if (GUILayout.Button("Preview"))
                {
                    Preview();
                }

                if (GUILayout.Button("Export JSON"))
                {
                    Export();
                }
            }

            EditorGUILayout.Space(16);
            EditorGUILayout.LabelField("Import safeguards", EditorStyles.boldLabel);
            createMissingObjects = EditorGUILayout.Toggle("Create missing objects", createMissingObjects);
            restoreCameraComponents = EditorGUILayout.Toggle("Restore Camera settings", restoreCameraComponents);
            EditorGUILayout.HelpBox(
                "Import is registered with Unity Undo. Existing objects are matched by their complete hierarchy path, " +
                "which avoids the legacy tool's ambiguous name-only lookup.",
                MessageType.None);

            if (GUILayout.Button("Import JSON...", GUILayout.Height(32)))
            {
                Import();
            }

            EditorGUILayout.EndScrollView();
        }

        private void Preview()
        {
            var matches = FindMatchingTransforms().ToArray();
            var cameraCount = matches.Count(item => item.GetComponent<Camera>() != null);
            var preview = string.Join("\n", matches.Take(20).Select(item => "• " + GetHierarchyPath(item)));
            if (matches.Length > 20)
            {
                preview += $"\n… and {matches.Length - 20} more";
            }

            EditorUtility.DisplayDialog(
                "Microi Camera Points",
                $"Matched objects: {matches.Length}\nObjects with Camera: {cameraCount}\n\n{preview}",
                "OK");
        }

        private void Export()
        {
            var matches = FindMatchingTransforms().ToArray();
            if (matches.Length == 0)
            {
                EditorUtility.DisplayDialog("Nothing to export", "No matching camera-point objects were found.", "OK");
                return;
            }

            var path = EditorUtility.SaveFilePanel("Export Microi camera points", "", "MicroiCameraPoints.json", "json");
            if (string.IsNullOrWhiteSpace(path))
            {
                return;
            }

            var payload = new CameraPointCollection
            {
                points = matches.Select(ToRecord).ToArray()
            };
            File.WriteAllText(path, JsonUtility.ToJson(payload, true));
            Debug.Log($"[Microi.Unity] Exported {payload.points.Length} camera points to {path}");
            EditorUtility.RevealInFinder(path);
        }

        private void Import()
        {
            var path = EditorUtility.OpenFilePanel("Import Microi camera points", "", "json");
            if (string.IsNullOrWhiteSpace(path))
            {
                return;
            }

            CameraPointCollection payload;
            try
            {
                payload = JsonUtility.FromJson<CameraPointCollection>(File.ReadAllText(path));
            }
            catch (Exception exception)
            {
                EditorUtility.DisplayDialog("Invalid camera-point JSON", exception.Message, "OK");
                return;
            }

            if (payload?.points == null || payload.points.Length == 0 || payload.format != "Microi.Unity.CameraPoints/1")
            {
                EditorUtility.DisplayDialog("Invalid camera-point JSON", "The file is empty or uses an unsupported format.", "OK");
                return;
            }

            var scene = SceneManager.GetActiveScene();
            var existing = payload.points.Count(point => FindByHierarchyPath(scene, point.hierarchyPath) != null);
            var missing = payload.points.Length - existing;
            if (!EditorUtility.DisplayDialog(
                    "Import Microi camera points",
                    $"Records: {payload.points.Length}\nExisting objects: {existing}\nMissing objects: {missing}\n\n" +
                    "Transforms and optional Camera settings will be updated. Continue?",
                    "Import",
                    "Cancel"))
            {
                return;
            }

            Undo.IncrementCurrentGroup();
            var undoGroup = Undo.GetCurrentGroup();
            Undo.SetCurrentGroupName("Import Microi camera points");
            var changed = 0;
            var skipped = 0;

            foreach (var point in payload.points)
            {
                var target = FindByHierarchyPath(scene, point.hierarchyPath);
                if (target == null && createMissingObjects)
                {
                    target = CreateHierarchy(scene, point.hierarchyPath);
                }

                if (target == null)
                {
                    skipped++;
                    continue;
                }

                Undo.RecordObject(target, "Import Microi camera point");
                target.position = point.position;
                target.eulerAngles = point.eulerAngles;
                target.localScale = point.localScale;

                if (restoreCameraComponents && point.hasCamera && point.camera != null)
                {
                    var camera = target.GetComponent<Camera>() ?? Undo.AddComponent<Camera>(target.gameObject);
                    Undo.RecordObject(camera, "Restore Microi Camera settings");
                    Apply(camera, point.camera);
                    EditorUtility.SetDirty(camera);
                }

                EditorUtility.SetDirty(target);
                changed++;
            }

            Undo.CollapseUndoOperations(undoGroup);
            EditorSceneManager.MarkSceneDirty(scene);
            EditorUtility.DisplayDialog("Import complete", $"Updated: {changed}\nSkipped: {skipped}\n\nUse Edit → Undo to revert.", "OK");
        }

        private IEnumerable<Transform> FindMatchingTransforms()
        {
            if (string.IsNullOrWhiteSpace(namePrefix))
            {
                return Array.Empty<Transform>();
            }

            return EnumerateSceneTransforms(SceneManager.GetActiveScene())
                .Where(item => (includeInactive || item.gameObject.activeInHierarchy) &&
                               item.name.StartsWith(namePrefix, StringComparison.Ordinal));
        }

        private static IEnumerable<Transform> EnumerateSceneTransforms(Scene scene)
        {
            foreach (var root in scene.GetRootGameObjects())
            {
                foreach (var item in root.GetComponentsInChildren<Transform>(true))
                {
                    yield return item;
                }
            }
        }

        private static CameraPointRecord ToRecord(Transform transform)
        {
            var camera = transform.GetComponent<Camera>();
            return new CameraPointRecord
            {
                hierarchyPath = GetHierarchyPath(transform),
                position = transform.position,
                eulerAngles = transform.eulerAngles,
                localScale = transform.localScale,
                hasCamera = camera != null,
                camera = camera == null ? null : new CameraRecord
                {
                    clearFlags = (int)camera.clearFlags,
                    backgroundColor = camera.backgroundColor,
                    cullingMask = camera.cullingMask,
                    orthographic = camera.orthographic,
                    fieldOfView = camera.fieldOfView,
                    orthographicSize = camera.orthographicSize,
                    nearClipPlane = camera.nearClipPlane,
                    farClipPlane = camera.farClipPlane,
                    depth = camera.depth,
                    renderingPath = (int)camera.renderingPath,
                    allowHdr = camera.allowHDR,
                    allowMsaa = camera.allowMSAA
                }
            };
        }

        private static void Apply(Camera camera, CameraRecord record)
        {
            camera.clearFlags = (CameraClearFlags)record.clearFlags;
            camera.backgroundColor = record.backgroundColor;
            camera.cullingMask = record.cullingMask;
            camera.orthographic = record.orthographic;
            camera.fieldOfView = record.fieldOfView;
            camera.orthographicSize = record.orthographicSize;
            camera.nearClipPlane = Mathf.Max(0.001f, record.nearClipPlane);
            camera.farClipPlane = Mathf.Max(camera.nearClipPlane + 0.01f, record.farClipPlane);
            camera.depth = record.depth;
            camera.renderingPath = (RenderingPath)record.renderingPath;
            camera.allowHDR = record.allowHdr;
            camera.allowMSAA = record.allowMsaa;
        }

        private static string GetHierarchyPath(Transform transform)
        {
            var names = new Stack<string>();
            for (var current = transform; current != null; current = current.parent)
            {
                names.Push(current.name);
            }

            return string.Join("/", names);
        }

        private static Transform FindByHierarchyPath(Scene scene, string hierarchyPath)
        {
            if (string.IsNullOrWhiteSpace(hierarchyPath))
            {
                return null;
            }

            var parts = hierarchyPath.Split('/');
            var root = scene.GetRootGameObjects().FirstOrDefault(item => item.name == parts[0]);
            if (root == null)
            {
                return null;
            }

            var current = root.transform;
            for (var index = 1; index < parts.Length; index++)
            {
                current = FindDirectChild(current, parts[index]);
                if (current == null)
                {
                    return null;
                }
            }

            return current;
        }

        private static Transform CreateHierarchy(Scene scene, string hierarchyPath)
        {
            if (string.IsNullOrWhiteSpace(hierarchyPath))
            {
                return null;
            }

            var parts = hierarchyPath.Split('/');
            var root = scene.GetRootGameObjects().FirstOrDefault(item => item.name == parts[0]);
            if (root == null)
            {
                root = new GameObject(parts[0]);
                Undo.RegisterCreatedObjectUndo(root, "Create Microi camera-point hierarchy");
                SceneManager.MoveGameObjectToScene(root, scene);
            }

            var current = root.transform;
            for (var index = 1; index < parts.Length; index++)
            {
                var child = FindDirectChild(current, parts[index]);
                if (child == null)
                {
                    var childObject = new GameObject(parts[index]);
                    Undo.RegisterCreatedObjectUndo(childObject, "Create Microi camera-point object");
                    childObject.transform.SetParent(current, false);
                    child = childObject.transform;
                }

                current = child;
            }

            return current;
        }

        private static Transform FindDirectChild(Transform parent, string name)
        {
            for (var index = 0; index < parent.childCount; index++)
            {
                var child = parent.GetChild(index);
                if (child.name == name)
                {
                    return child;
                }
            }

            return null;
        }
    }
}
