using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Microi.Unity.Editor
{
    public static class MicroiWebGLBuildUtility
    {
        [MenuItem("Microi/Unity/Build Enabled Scenes to WebGL")]
        public static void BuildEnabledScenes()
        {
            var projectRoot = Directory.GetParent(Application.dataPath)?.FullName ?? Directory.GetCurrentDirectory();
            var output = Path.Combine(projectRoot, "Builds", "WebGL");
            var scenes = EditorBuildSettings.scenes
                .Where(scene => scene.enabled)
                .Select(scene => scene.path)
                .ToArray();

            Build(output, scenes);
        }

        public static BuildReport Build(string outputDirectory, string[] scenes, bool developmentBuild = false)
        {
            if (scenes == null || scenes.Length == 0)
            {
                throw new InvalidOperationException("至少需要一个已启用的 Unity 场景。" );
            }

            Directory.CreateDirectory(outputDirectory);
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
            PlayerSettings.WebGL.decompressionFallback = true;
            PlayerSettings.WebGL.nameFilesAsHashes = true;
            PlayerSettings.runInBackground = true;

            var options = developmentBuild ? BuildOptions.Development : BuildOptions.None;
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = outputDirectory,
                target = BuildTarget.WebGL,
                options = options
            });

            if (report.summary.result != BuildResult.Succeeded)
            {
                throw new InvalidOperationException($"Microi WebGL build failed: {report.summary.result}");
            }

            Debug.Log($"Microi WebGL build completed: {Path.GetFullPath(outputDirectory)}");
            return report;
        }
    }
}
