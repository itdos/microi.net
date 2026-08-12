using System.Runtime.InteropServices;
using UnityEngine;

namespace Microi.Unity
{
    public static class MicroiWebGLBridge
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern void MicroiUnity_NotifyReady();

        [DllImport("__Internal")]
        private static extern void MicroiUnity_NotifyAuthorizationRotated(string token, string requestToken);

        [DllImport("__Internal")]
        private static extern void MicroiUnity_Emit(string eventName, string jsonPayload);
#endif

        public static void NotifyReady()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            MicroiUnity_NotifyReady();
#endif
        }

        public static void NotifyAuthorizationRotated(string token, string requestToken)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            MicroiUnity_NotifyAuthorizationRotated(token ?? string.Empty, requestToken ?? string.Empty);
#endif
        }

        public static void Emit(string eventName, string jsonPayload)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            MicroiUnity_Emit(eventName ?? string.Empty, jsonPayload ?? "{}");
#else
            Debug.Log($"[Microi.Unity] {eventName}: {jsonPayload}");
#endif
        }
    }
}
