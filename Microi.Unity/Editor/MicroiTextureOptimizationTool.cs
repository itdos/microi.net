using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Microi.Unity.Editor
{
    public sealed class MicroiTextureOptimizationTool : EditorWindow
    {
        [Serializable]
        private sealed class TextureBackup
        {
            public string format = "Microi.Unity.TextureImportBackup/1";
            public string createdAtUtc;
            public TextureBackupRecord[] textures = Array.Empty<TextureBackupRecord>();
        }

        [Serializable]
        private sealed class TextureBackupRecord
        {
            public string assetPath;
            public int maxTextureSize;
            public bool mipmapEnabled;
            public int textureCompression;
            public bool crunchedCompression;
            public int compressionQuality;
            public bool isReadable;
            public bool streamingMipmaps;
            public bool webGlOverridden;
            public int webGlMaxTextureSize;
            public int webGlFormat;
            public int webGlCompressionQuality;
        }

        private int maxTextureSize = 1024;
        private bool mipmaps = true;
        private bool compression = true;
        private int compressionQuality = 60;
        private Vector2 scroll;

        [MenuItem("Microi/Unity/Toolbox/Texture Optimization...")]
        public static void Open()
        {
            GetWindow<MicroiTextureOptimizationTool>("Microi Textures");
        }

        private void OnGUI()
        {
            scroll = EditorGUILayout.BeginScrollView(scroll);
            EditorGUILayout.LabelField("Scoped texture optimization", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox(
                "Select one or more folders in the Project window. Only textures beneath those folders are analyzed or changed. " +
                "Before applying changes, the complete importer settings are backed up under ProjectSettings/MicroiUnityBackups.",
                MessageType.Info);

            var folders = GetSelectedAssetFolders();
            EditorGUILayout.LabelField("Selected folders", folders.Length == 0 ? "None" : string.Join(", ", folders));
            maxTextureSize = EditorGUILayout.IntPopup(
                "Maximum texture size",
                maxTextureSize,
                new[] { "256", "512", "1024", "2048", "4096" },
                new[] { 256, 512, 1024, 2048, 4096 });
            mipmaps = EditorGUILayout.Toggle("Enable mipmaps", mipmaps);
            compression = EditorGUILayout.Toggle("Enable compression", compression);
            using (new EditorGUI.DisabledScope(!compression))
            {
                compressionQuality = EditorGUILayout.IntSlider("Compression quality", compressionQuality, 0, 100);
            }

            using (new EditorGUI.DisabledScope(folders.Length == 0))
            {
                if (GUILayout.Button("Analyze selected folders"))
                {
                    Analyze(folders);
                }

                if (GUILayout.Button("Back up and apply", GUILayout.Height(34)))
                {
                    Apply(folders);
                }
            }

            EditorGUILayout.Space(14);
            if (GUILayout.Button("Restore from backup JSON..."))
            {
                Restore();
            }

            EditorGUILayout.HelpBox(
                "The tool does not change Read/Write or streaming flags, does not touch Packages, and never applies a project-wide wildcard. " +
                "Commit or archive the generated backup JSON before large production changes.",
                MessageType.None);
            EditorGUILayout.EndScrollView();
        }

        private static void Analyze(string[] folders)
        {
            var paths = FindTexturePaths(folders);
            long sourceBytes = 0;
            var large = 0;
            var uncompressed = 0;
            var withoutMipmaps = 0;

            foreach (var path in paths)
            {
                var importer = AssetImporter.GetAtPath(path) as TextureImporter;
                if (importer == null)
                {
                    continue;
                }

                var absolute = Path.GetFullPath(path);
                if (File.Exists(absolute))
                {
                    sourceBytes += new FileInfo(absolute).Length;
                }

                if (importer.maxTextureSize > 1024)
                {
                    large++;
                }

                if (importer.textureCompression == TextureImporterCompression.Uncompressed)
                {
                    uncompressed++;
                }

                if (!importer.mipmapEnabled)
                {
                    withoutMipmaps++;
                }
            }

            EditorUtility.DisplayDialog(
                "Microi texture analysis",
                $"Textures: {paths.Length}\nSource size: {sourceBytes / (1024d * 1024d):N1} MB\n" +
                $"Larger than 1024: {large}\nUncompressed: {uncompressed}\nWithout mipmaps: {withoutMipmaps}\n\nNo changes were made.",
                "OK");
        }

        private void Apply(string[] folders)
        {
            var paths = FindTexturePaths(folders);
            if (paths.Length == 0)
            {
                EditorUtility.DisplayDialog("Nothing to optimize", "No Texture2D assets were found under the selected folders.", "OK");
                return;
            }

            if (!EditorUtility.DisplayDialog(
                    "Back up and optimize textures",
                    $"Textures: {paths.Length}\nMaximum size: {maxTextureSize}\nMipmaps: {mipmaps}\n" +
                    $"Compression: {(compression ? "Compressed" : "Uncompressed")}\n\n" +
                    "A restorable JSON backup will be written before any importer is changed. Continue?",
                    "Back up and apply",
                    "Cancel"))
            {
                return;
            }

            var backup = new TextureBackup
            {
                createdAtUtc = DateTime.UtcNow.ToString("O"),
                textures = paths.Select(CreateBackupRecord).Where(item => item != null).ToArray()
            };
            var backupPath = WriteBackup(backup);
            var changed = new List<string>();

            try
            {
                for (var index = 0; index < backup.textures.Length; index++)
                {
                    var record = backup.textures[index];
                    EditorUtility.DisplayProgressBar(
                        "Microi texture optimization",
                        record.assetPath,
                        index / (float)Math.Max(1, backup.textures.Length));
                    var importer = AssetImporter.GetAtPath(record.assetPath) as TextureImporter;
                    if (importer == null)
                    {
                        continue;
                    }

                    importer.maxTextureSize = Math.Min(importer.maxTextureSize, maxTextureSize);
                    importer.mipmapEnabled = mipmaps;
                    importer.textureCompression = compression
                        ? TextureImporterCompression.Compressed
                        : TextureImporterCompression.Uncompressed;
                    importer.compressionQuality = compressionQuality;

                    var webGl = importer.GetPlatformTextureSettings("WebGL");
                    webGl.overridden = true;
                    webGl.maxTextureSize = Math.Min(record.webGlMaxTextureSize > 0 ? record.webGlMaxTextureSize : maxTextureSize, maxTextureSize);
                    webGl.compressionQuality = compressionQuality;
                    importer.SetPlatformTextureSettings(webGl);
                    if (AssetDatabase.WriteImportSettingsIfDirty(record.assetPath))
                    {
                        changed.Add(record.assetPath);
                    }
                }

                for (var index = 0; index < changed.Count; index++)
                {
                    EditorUtility.DisplayProgressBar(
                        "Reimporting optimized textures",
                        changed[index],
                        index / (float)Math.Max(1, changed.Count));
                    AssetDatabase.ImportAsset(changed[index], ImportAssetOptions.ForceUpdate);
                }

                EditorUtility.DisplayDialog(
                    "Texture optimization complete",
                    $"Changed importers: {changed.Count}\nBackup: {backupPath}\n\nUse Restore from backup JSON to recover the exact previous settings.",
                    "OK");
            }
            catch (Exception exception)
            {
                Debug.LogException(exception);
                EditorUtility.DisplayDialog(
                    "Texture optimization interrupted",
                    exception.Message + $"\n\nBackup retained at:\n{backupPath}",
                    "OK");
            }
            finally
            {
                EditorUtility.ClearProgressBar();
            }
        }

        private static void Restore()
        {
            var defaultDirectory = GetBackupDirectory();
            var path = EditorUtility.OpenFilePanel("Restore Microi texture importer backup", defaultDirectory, "json");
            if (string.IsNullOrWhiteSpace(path))
            {
                return;
            }

            TextureBackup backup;
            try
            {
                backup = JsonUtility.FromJson<TextureBackup>(File.ReadAllText(path));
            }
            catch (Exception exception)
            {
                EditorUtility.DisplayDialog("Invalid backup", exception.Message, "OK");
                return;
            }

            if (backup?.textures == null || backup.format != "Microi.Unity.TextureImportBackup/1")
            {
                EditorUtility.DisplayDialog("Invalid backup", "This is not a supported Microi texture backup.", "OK");
                return;
            }

            if (!EditorUtility.DisplayDialog(
                    "Restore texture importers",
                    $"Restore {backup.textures.Length} importer records from {backup.createdAtUtc}?",
                    "Restore",
                    "Cancel"))
            {
                return;
            }

            var restored = new List<string>();
            try
            {
                for (var index = 0; index < backup.textures.Length; index++)
                {
                    var record = backup.textures[index];
                    EditorUtility.DisplayProgressBar("Restoring texture importers", record.assetPath, index / (float)Math.Max(1, backup.textures.Length));
                    var importer = AssetImporter.GetAtPath(record.assetPath) as TextureImporter;
                    if (importer == null)
                    {
                        continue;
                    }

                    importer.maxTextureSize = record.maxTextureSize;
                    importer.mipmapEnabled = record.mipmapEnabled;
                    importer.textureCompression = (TextureImporterCompression)record.textureCompression;
                    importer.crunchedCompression = record.crunchedCompression;
                    importer.compressionQuality = record.compressionQuality;
                    importer.isReadable = record.isReadable;
                    importer.streamingMipmaps = record.streamingMipmaps;

                    var webGl = importer.GetPlatformTextureSettings("WebGL");
                    webGl.overridden = record.webGlOverridden;
                    webGl.maxTextureSize = record.webGlMaxTextureSize;
                    webGl.format = (TextureImporterFormat)record.webGlFormat;
                    webGl.compressionQuality = record.webGlCompressionQuality;
                    importer.SetPlatformTextureSettings(webGl);
                    AssetDatabase.WriteImportSettingsIfDirty(record.assetPath);
                    restored.Add(record.assetPath);
                }

                foreach (var assetPath in restored)
                {
                    AssetDatabase.ImportAsset(assetPath, ImportAssetOptions.ForceUpdate);
                }

                EditorUtility.DisplayDialog("Restore complete", $"Restored {restored.Count} texture importers.", "OK");
            }
            finally
            {
                EditorUtility.ClearProgressBar();
            }
        }

        private static TextureBackupRecord CreateBackupRecord(string path)
        {
            var importer = AssetImporter.GetAtPath(path) as TextureImporter;
            if (importer == null)
            {
                return null;
            }

            var webGl = importer.GetPlatformTextureSettings("WebGL");
            return new TextureBackupRecord
            {
                assetPath = path,
                maxTextureSize = importer.maxTextureSize,
                mipmapEnabled = importer.mipmapEnabled,
                textureCompression = (int)importer.textureCompression,
                crunchedCompression = importer.crunchedCompression,
                compressionQuality = importer.compressionQuality,
                isReadable = importer.isReadable,
                streamingMipmaps = importer.streamingMipmaps,
                webGlOverridden = webGl.overridden,
                webGlMaxTextureSize = webGl.maxTextureSize,
                webGlFormat = (int)webGl.format,
                webGlCompressionQuality = webGl.compressionQuality
            };
        }

        private static string[] GetSelectedAssetFolders()
        {
            return Selection.objects
                .Select(AssetDatabase.GetAssetPath)
                .Where(path => !string.IsNullOrWhiteSpace(path))
                .Select(path => AssetDatabase.IsValidFolder(path) ? path : Path.GetDirectoryName(path)?.Replace('\\', '/'))
                .Where(path => !string.IsNullOrWhiteSpace(path) && (path == "Assets" || path.StartsWith("Assets/", StringComparison.Ordinal)))
                .Distinct(StringComparer.Ordinal)
                .ToArray();
        }

        private static string[] FindTexturePaths(string[] folders)
        {
            return AssetDatabase.FindAssets("t:Texture2D", folders)
                .Select(AssetDatabase.GUIDToAssetPath)
                .Where(path => path.StartsWith("Assets/", StringComparison.Ordinal))
                .Distinct(StringComparer.Ordinal)
                .ToArray();
        }

        private static string WriteBackup(TextureBackup backup)
        {
            var directory = GetBackupDirectory();
            Directory.CreateDirectory(directory);
            var path = Path.Combine(directory, $"texture-import-{DateTime.UtcNow:yyyyMMdd-HHmmss}.json");
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
