using System;
using UnityEngine;

namespace Microi.Unity
{
    [Serializable]
    public sealed class MicroiHostContext
    {
        public string ApiBaseUrl;
        public string OsClient;
        public string Authorization;
        public string Did;
    }

    [Serializable]
    public sealed class MicroiDosResult<T>
    {
        public int Code;
        public T Data;
        public int DataCount;
        public string Msg;
    }

    [Serializable]
    internal sealed class MicroiDosEnvelope
    {
        public int Code = 0;
        public int DataCount = 0;
        public string Msg = string.Empty;
    }

    public sealed class MicroiRawResponse
    {
        public long HttpStatus { get; internal set; }
        public int Code { get; internal set; }
        public int DataCount { get; internal set; }
        public string Msg { get; internal set; }
        public string RawJson { get; internal set; }
        public string TransportError { get; internal set; }

        public bool IsHttpSuccess => HttpStatus >= 200 && HttpStatus < 300 && string.IsNullOrEmpty(TransportError);
        public bool IsSuccess => IsHttpSuccess && Code == 1;

        public bool TryDeserialize<T>(out MicroiDosResult<T> result)
        {
            result = null;
            if (string.IsNullOrWhiteSpace(RawJson))
            {
                return false;
            }

            try
            {
                result = JsonUtility.FromJson<MicroiDosResult<T>>(RawJson);
                return result != null;
            }
            catch (Exception)
            {
                return false;
            }
        }
    }
}
