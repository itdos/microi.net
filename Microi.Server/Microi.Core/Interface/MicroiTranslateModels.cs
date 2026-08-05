using System.Collections.Generic;

namespace Microi.net
{
    /// <summary>
    /// Text translation through the provider configured for the current tenant.
    /// Provider URL and credentials are deliberately absent from this contract so
    /// V8/API/MCP callers cannot turn it into an arbitrary proxy. BaseParam retains
    /// the legacy OsClient member, but HTTP overwrites it from the validated token
    /// and V8 enforces the active V8TenantContext before configuration is read.
    /// </summary>
    public sealed class MicroiTranslateTextParam : BaseParam
    {
        public string SourceText { get; set; }
        public List<string> SourceTexts { get; set; }
        public string FromLang { get; set; }
        public string Lang { get; set; }
        public string Format { get; set; }
        public int? Alternatives { get; set; }
    }

    public sealed class MicroiTranslateDetectParam : BaseParam
    {
        public string SourceText { get; set; }
    }

    public sealed class MicroiTranslateFileParam : BaseParam
    {
        public string FileByteBase64 { get; set; }
        public string FileName { get; set; }
        public string FromLang { get; set; }
        public string Lang { get; set; }
    }

    public sealed class MicroiTranslateSuggestParam : BaseParam
    {
        public string SourceText { get; set; }
        public string SuggestedText { get; set; }
        public string FromLang { get; set; }
        public string Lang { get; set; }
    }

    public sealed class MicroiTranslateDetection
    {
        public string Language { get; set; }
        public decimal Confidence { get; set; }
    }

    public sealed class MicroiTranslateTextResult
    {
        public string Provider { get; set; }
        public bool IsBatch { get; set; }
        public string SourceLanguage { get; set; }
        public string TargetLanguage { get; set; }
        public string Format { get; set; }
        public string TranslatedText { get; set; }
        public List<string> TranslatedTexts { get; set; } = new List<string>();
        public MicroiTranslateDetection DetectedLanguage { get; set; }
        public List<MicroiTranslateDetection> DetectedLanguages { get; set; } = new List<MicroiTranslateDetection>();
        public List<string> Alternatives { get; set; } = new List<string>();
        public List<List<string>> AlternativeGroups { get; set; } = new List<List<string>>();
    }

    public sealed class MicroiTranslateLanguage
    {
        public string Code { get; set; }
        public string Name { get; set; }
        public List<string> Targets { get; set; } = new List<string>();
    }

    public sealed class MicroiTranslateFileResult
    {
        public string Provider { get; set; }
        public string FileName { get; set; }
        public string ContentType { get; set; }
        public string FileByteBase64 { get; set; }
        public long ByteLength { get; set; }
    }

    public sealed class MicroiTranslateSuggestionResult
    {
        public string Provider { get; set; }
        public bool Success { get; set; }
    }

    public sealed class MicroiTranslateHealthResult
    {
        public string Provider { get; set; }
        public string Status { get; set; }
        public bool Healthy { get; set; }
        public bool SupportsBatch { get; set; }
        public bool SupportsHtml { get; set; }
        public bool SupportsAlternatives { get; set; }
        public bool SupportsDetection { get; set; }
        public bool SupportsFiles { get; set; }
        public bool SupportsSuggestions { get; set; }
    }
}
