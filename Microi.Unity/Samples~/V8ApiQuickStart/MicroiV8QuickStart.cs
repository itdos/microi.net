using System;
using System.Collections;
using UnityEngine;

namespace Microi.Unity.Samples
{
    public sealed class MicroiV8QuickStart : MonoBehaviour
    {
        [Serializable]
        private sealed class BootstrapRequest
        {
            public string ClientVersion = "1.0.0";
        }

        [SerializeField] private MicroiApiClient apiClient;
        [SerializeField] private string bootstrapApiEngineKey = "app_unity_taoyuan_bootstrap";

        private IEnumerator Start()
        {
            if (apiClient == null)
            {
                apiClient = FindObjectOfType<MicroiApiClient>();
            }

            if (apiClient == null)
            {
                Debug.LogWarning("MicroiApiClient is not present in this scene.");
                yield break;
            }

            yield return apiClient.PostJson(
                bootstrapApiEngineKey,
                JsonUtility.ToJson(new BootstrapRequest()),
                response => Debug.Log(response.IsSuccess
                    ? "Microi V8 bootstrap succeeded."
                    : $"Microi V8 bootstrap failed: {response.Msg ?? response.TransportError}"));
        }
    }
}
