namespace ContractWorkspace.DocumentService;

/// <summary>
/// Models submitted to the <c>/api/documenteditor/SystemClipboard</c> endpoint
/// containing clipboard HTML/RTF content to be converted into SFDT.
/// </summary>
public sealed class ClipboardParameter
{
    /// <summary>HTML or RTF clipboard content.</summary>
    public string? Content { get; set; }

    /// <summary>Mime type of the clipboard content (e.g. text/html, text/rtf).</summary>
    public string? Type { get; set; }
}

/// <summary>
/// Models submitted to the <c>/api/documenteditor/RestrictEditing</c> endpoint
/// carrying the password/salt/spin-count/algorithm-name payload used by the
/// Syncfusion Document Editor to compute a protection hash.
/// </summary>
public sealed class RestrictEditingParameter
{
    /// <summary>Base64-encoded password.</summary>
    public string? PasswordBase64 { get; set; }

    /// <summary>Base64-encoded salt.</summary>
    public string? SaltBase64 { get; set; }

    /// <summary>Hash spin count.</summary>
    public int SpinCount { get; set; }

    /// <summary>Hash algorithm sid (e.g. "SHA1").</summary>
    public string? AlgorithmSid { get; set; }
}

/// <summary>
/// Models submitted to the <c>/SpellCheck</c> and <c>/SpellCheckByPage</c>
/// endpoints carrying the text to spell-check and the requested options.
/// </summary>
public sealed class SpellCheckParameter
{
    /// <summary>Hunspell language id (e.g. 1033 for en_US).</summary>
    public int LanguageID { get; set; }

    /// <summary>Text to verify.</summary>
    public string? TexttoCheck { get; set; }

    /// <summary>Whether to perform spelling validation.</summary>
    public bool CheckSpelling { get; set; }

    /// <summary>Whether to return suggestions for flagged words.</summary>
    public bool CheckSuggestion { get; set; }

    /// <summary>Whether to add the word to the personal dictionary.</summary>
    public bool AddWord { get; set; }
}

/// <summary>
/// Models submitted to the <c>/ExportSFDT</c> and <c>/Save</c> endpoints
/// containing SFDT content and a target file name (extension drives format).
/// </summary>
public sealed class SaveParameter
{
    /// <summary>SFDT serialized document content.</summary>
    public string? Content { get; set; }

    /// <summary>Target file name (extension determines output format).</summary>
    public string? FileName { get; set; }

    /// <summary>Optional explicit format (e.g. ".pdf").</summary>
    public string? Format { get; set; }
}

/// <summary>
/// Models submitted to the <c>/MailMerge</c> endpoint combining a base64-encoded
/// DOCX document with a JSON mail-merge data payload.
/// </summary>
public sealed class MailMergeParameter
{
    /// <summary>Target file name for the merged document.</summary>
    public string? FileName { get; set; }

    /// <summary>Base64-encoded DOCX bytes (with or without data: prefix).</summary>
    public string? DocumentData { get; set; }

    /// <summary>JSON-serialized mail-merge data (object or named group).</summary>
    public string? MailMergeData { get; set; }

    /// <summary>
    /// When <c>true</c> (default), merge fields with no matching data column are
    /// cleared. Set to <c>false</c> for a single-field merge so the remaining
    /// unfilled MERGEFIELDs are preserved for later population.
    /// </summary>
    public bool ClearFields { get; set; } = true;
}

/// <summary>
/// Models submitted to the <c>/CompareDocuments</c> endpoint to produce a
/// redlined comparison document between an original and a revised DOCX.
/// </summary>
public sealed class CompareParameter
{
    /// <summary>Base64-encoded original DOCX bytes.</summary>
    public string? OriginalDocumentData { get; set; }

    /// <summary>Base64-encoded revised DOCX bytes.</summary>
    public string? RevisedDocumentData { get; set; }

    /// <summary>Author label applied to detected changes.</summary>
    public string? Author { get; set; }
}

/// <summary>
/// Response model returned by <c>/GetMergeFields</c> listing the merge-field
/// names present in an uploaded/imported document.
/// </summary>
public sealed class MergeFieldNamesResponse
{
    /// <summary>Merge-field names found in the document.</summary>
    public string[] MergeFields { get; set; } = Array.Empty<string>();
}
