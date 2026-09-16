using ContractWorkspace.DocumentService.Helpers;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Syncfusion.DocIO;
using Syncfusion.DocIO.DLS;
using Syncfusion.DocIORenderer;
using Syncfusion.EJ2.DocumentEditor;
using Syncfusion.Pdf;
// Alias disambiguates DocIO's WordDocument from EJ2's WordDocument (both define the name).
using WDocument = Syncfusion.DocIO.DLS.WordDocument;

namespace ContractWorkspace.DocumentService.Controllers;

/// <summary>
/// Stateless web API mirroring the official Syncfusion EJ2 Document Editor
/// web-services surface, adapted for the Contract Lifecycle and Approval
/// Workspace showcase. No database, no business-data persistence — every
/// request is self-contained and operates on the supplied document bytes or
/// SFDT stream only. Serves template payloads from wwwroot/Templates/.
/// </summary>
/// <remarks>
/// Routes follow the api/documenteditor/* convention so the React
/// Document Editor serviceUrl plugs in directly
/// (https://help.syncfusion.com/document-processing/word/word-processor/react/web-services/core).
/// Two showcase-specific endpoints are added on top:
/// <list type="bullet">
/// <item>ExportPdf — DOCX to clean PDF via DocIO + DocIORenderer,
/// comments and tracked changes stripped before conversion.</item>
/// <item>CompareDocuments — DOCX to DOCX comparison produced
/// using DocIO WordDocument.Compare.</item>
/// </list>
/// </remarks>
[ApiController]
[Route("api/documenteditor")]
[EnableCors("AllowAllOrigins")]
public class DocumentEditorController : ControllerBase
{
    private readonly ILogger<DocumentEditorController> _logger;

    // Extension whitelist validates every uploaded payload.
    private static readonly string[] AllowedExtensions =
        { ".docx", ".doc", ".rtf", ".txt", ".xml", ".html", ".htm", ".dotx", ".docm", ".dotm", ".dot" };

    /// <summary>
    /// Creates the controller with the logger used to record Word-to-PDF
    /// conversion failures (Linux native-asset misses surface as 500s).
    /// </summary>
    public DocumentEditorController(ILogger<DocumentEditorController> logger)
    {
        _logger = logger;
    }

    // Cached watermark image bytes (read once from wwwroot/Assets on first use).
    private static byte[]? _watermarkBytes;

    /// <summary>
    /// Stamps the Syncfusion logo behind the body text of every page by adding a
    /// floating picture (<see cref="TextWrappingStyle.Behind"/>) to each section
    /// header. Called before DOCX save and before Word-to-PDF conversion so both
    /// generated outputs carry the branding — the PDF is
    /// rendered from the same <paramref name="document"/> via
    /// <see cref="DocIORenderer.ConvertToPDF(WDocument)"/>, so a single call
    /// covers both. Skips silently when the asset is missing so exports never
    /// fail for a missing watermark.
    /// </summary>
    /// <remarks>
    /// A header-embedded picture is used instead of DocIO's
    /// <c>PictureWatermark</c>: <c>PictureWatermark</c> renders into the PDF (drawn
    /// at conversion time) but does not serialize into the saved <c>.docx</c> in
    /// this version, so the downloaded DOCX showed no watermark. A behind-text
    /// header picture persists in the DOCX and also renders into the PDF.
    /// </remarks>
    private void ApplyLogoWatermark(WDocument document)
    {
        var bytes = LoadWatermarkBytes();
        if (bytes is null)
        {
            return;
        }

        foreach (WSection section in document.Sections)
        {
            // The default (odd) header shows on all pages unless the section opts
            // into different even/first-page headers — add to all three so the
            // watermark appears regardless of the section's header configuration.
            AddWatermarkToHeader(section.HeadersFooters.OddHeader, bytes);
            AddWatermarkToHeader(section.HeadersFooters.EvenHeader, bytes);
            AddWatermarkToHeader(section.HeadersFooters.FirstPageHeader, bytes);
        }
    }

    /// <summary>
    /// Appends the logo as a page-centered floating picture behind the text of a
    /// single header, so it reads as a background watermark.
    /// </summary>
    private static void AddWatermarkToHeader(WTextBody header, byte[] bytes)
    {
        IWParagraph para = header.AddParagraph();
        using var imageStream = new MemoryStream(bytes);
        WPicture picture = (WPicture)para.AppendPicture(imageStream);
        picture.TextWrappingStyle = TextWrappingStyle.Behind;   // sit behind body text
        picture.HorizontalOrigin = HorizontalOrigin.Page;
        picture.VerticalOrigin = VerticalOrigin.Page;
        picture.HorizontalAlignment = ShapeHorizontalAlignment.Center;
        picture.VerticalAlignment = ShapeVerticalAlignment.Center;
        // watermark.png is 219x48 (~4.56:1); keep the aspect ratio, sized as a
        // small background band centered on the page.
        picture.Width = 220f;
        picture.Height = 48f;
    }

    /// <summary>
    /// Loads (and caches) the watermark image from
    /// <c>wwwroot/Assets/watermark.png</c>. Returns null and logs a warning when
    /// the asset is absent.
    /// </summary>
    private byte[]? LoadWatermarkBytes()
    {
        if (_watermarkBytes is not null)
        {
            return _watermarkBytes;
        }

        var path = Path.Combine(
            AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "Assets", "watermark.png");
        if (!System.IO.File.Exists(path))
        {
            _logger.LogWarning("Watermark asset not found at {Path}; skipping watermark.", path);
            return null;
        }

        _watermarkBytes = System.IO.File.ReadAllBytes(path);
        return _watermarkBytes;
    }

    /// <summary>
    /// Converts an uploaded Word/RTF/TXT document into SFDT JSON the editor
    /// can open directly. Cloned from the official Syncfusion web-services sample.
    /// </summary>
    [AcceptVerbs("Post")]
    [HttpPost]
    [Route("Import")]
    public string? Import(IFormCollection data)
    {
        if (data.Files.Count == 0)
        {
            return null;
        }

        IFormFile file = data.Files[0];
        var extension = FormatTypeResolver.GetExtension(file.FileName);
        if (!AllowedExtensions.Contains(extension))
        {
            throw new NotSupportedException($"File extension '{extension}' is not supported.");
        }

        using var stream = new MemoryStream();
        file.CopyTo(stream);
        stream.Position = 0;

        var sfdt = Syncfusion.EJ2.DocumentEditor.WordDocument.Load(stream, FormatTypeResolver.ToEditorFormat(extension));
        var json = Newtonsoft.Json.JsonConvert.SerializeObject(sfdt);
        sfdt.Dispose();
        return json;
    }

    /// <summary>
    /// Converts system <paramref name="param"/> clipboard data (HTML/RTF)
    /// into SFDT so the editor can paste with formatting preserved.
    /// </summary>
    [AcceptVerbs("Post")]
    [HttpPost]
    [Route("SystemClipboard")]
    public string SystemClipboard([FromBody] ClipboardParameter param)
    {
        if (string.IsNullOrEmpty(param?.Content))
        {
            return string.Empty;
        }

        try
        {
            var format = FormatTypeResolver.ToEditorFormat(param.Type ?? ".rtf");
            var document = Syncfusion.EJ2.DocumentEditor.WordDocument.LoadString(param.Content, format);
            var json = Newtonsoft.Json.JsonConvert.SerializeObject(document);
            document.Dispose();
            return json;
        }
        catch
        {
            return string.Empty;
        }
    }

    /// <summary>
    /// Generates a hash pair from the supplied password/salt payload, used by
    /// the editor's restrict-editing feature.
    /// </summary>
    [AcceptVerbs("Post")]
    [HttpPost]
    [Route("RestrictEditing")]
    public string[]? RestrictEditing([FromBody] RestrictEditingParameter param)
    {
        if (string.IsNullOrEmpty(param?.PasswordBase64))
        {
            return null;
        }

        return Syncfusion.EJ2.DocumentEditor.WordDocument.ComputeHash(
            param.PasswordBase64,
            param.SaltBase64,
            param.SpinCount,
            param.AlgorithmSid);
    }

    /// <summary>
    /// Performs word-by-word spell check and returns misspelled words plus
    /// suggestions. Requires Hunspell dictionaries under <c>App_Data</c>;
    /// gracefully returns an empty collection when dictionaries are absent.
    /// </summary>
    [AcceptVerbs("Post")]
    [HttpPost]
    [Route("SpellCheck")]
    public string SpellCheck([FromBody] SpellCheckParameter spellChecker)
    {
        try
        {
            var spellCheck = new Syncfusion.EJ2.SpellChecker.SpellChecker();
            spellCheck.GetSuggestions(
                spellChecker.LanguageID,
                spellChecker.TexttoCheck,
                spellChecker.CheckSpelling,
                spellChecker.CheckSuggestion,
                spellChecker.AddWord);
            return Newtonsoft.Json.JsonConvert.SerializeObject(spellCheck);
        }
        catch
        {
            return "{\"SpellCollection\":[],\"HasSpellingError\":false,\"Suggestions\":null}";
        }
    }

    /// <summary>
    /// Performs page-by-page spell check used when optimized spell check is
    /// enabled on the client. Falls back to an empty collection if no
    /// dictionaries are available.
    /// </summary>
    [AcceptVerbs("Post")]
    [HttpPost]
    [Route("SpellCheckByPage")]
    public string SpellCheckByPage([FromBody] SpellCheckParameter spellChecker)
    {
        try
        {
            var spellCheck = new Syncfusion.EJ2.SpellChecker.SpellChecker();
            spellCheck.CheckSpelling(spellChecker.LanguageID, spellChecker.TexttoCheck);
            return Newtonsoft.Json.JsonConvert.SerializeObject(spellCheck);
        }
        catch
        {
            return "{\"SpellCollection\":[],\"HasSpellingError\":false,\"Suggestions\":null}";
        }
    }

    /// <summary>
    /// Exports an SFDT document to a target file format. When the format is
    /// PDF, the conversion uses DocIO + DocIORenderer; for other formats the
    /// SFDT is first converted to a DocIO WordDocument.
    /// </summary>
    [AcceptVerbs("Post")]
    [HttpPost]
    [Route("ExportSFDT")]
    public FileStreamResult ExportSFDT([FromBody] SaveParameter data)
    {
        var fileName = string.IsNullOrWhiteSpace(data.FileName) ? "Document1.docx" : data.FileName!;
        var format = string.IsNullOrWhiteSpace(data.Format)
            ? FormatTypeResolver.GetExtension(fileName)
            : (data.Format!.StartsWith('.') ? data.Format : "." + data.Format).ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(data.Content))
        {
            throw new ArgumentException("SFDT content cannot be null or empty.");
        }

        var document = Syncfusion.EJ2.DocumentEditor.WordDocument.Save(data.Content);
        return SaveDocument(document, format, fileName);
    }

    /// <summary>
    /// Exports an uploaded DOCX file to a clean PDF — comments and tracked
    /// changes are stripped before conversion so reviewers and signers see the
    /// publication-ready document. Optional flags <c>stripComments</c>/<c>stripTrackedChanges</c>
    /// in the form collection default to <c>true</c>.
    /// </summary>
    [AcceptVerbs("Post")]
    [HttpPost]
    [Route("ExportPdf")]
    public FileStreamResult ExportPdf(IFormCollection data)
    {
        if (data.Files.Count == 0)
        {
            throw new ArgumentException("A DOCX file is required.");
        }

        IFormFile file = data.Files[0];
        var extension = FormatTypeResolver.GetExtension(file.FileName);
        if (extension != ".docx" && extension != ".doc")
        {
            throw new NotSupportedException("ExportPdf accepts Word documents only (.docx/.doc).");
        }

        // Optional flags default to true so callers always get a clean PDF.
        var stripComments = ParseBoolFlag(data, "stripComments", defaultValue: true);
        var stripTrackedChanges = ParseBoolFlag(data, "stripTrackedChanges", defaultValue: true);

        using var stream = new MemoryStream();
        file.CopyTo(stream);
        stream.Position = 0;

        using var document = new WDocument(stream, FormatTypeResolver.ToDocIOFormat(extension));

        if (stripTrackedChanges && document.HasChanges)
        {
            document.Revisions.RejectAll();
        }

        if (stripComments && document.Comments.Count > 0)
        {
            document.Comments.Clear();
        }

        ApplyLogoWatermark(document);

        var pdfName = Path.GetFileNameWithoutExtension(file.FileName) + ".pdf";
        try
        {
            using var renderer = new DocIORenderer();
            renderer.Settings.EmbedFonts = true;
            using var pdfDocument = renderer.ConvertToPDF(document);

            var outputStream = new MemoryStream();
            pdfDocument.Save(outputStream);
            pdfDocument.Close();

            outputStream.Position = 0;
            return new FileStreamResult(outputStream, "application/pdf")
            {
                FileDownloadName = pdfName
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ExportPdf DocIORenderer ConvertToPDF failed for {FileName}", file.FileName);
            throw;
        }
    }

    /// <summary>
    /// Exports an uploaded DOCX file to a clean, publication-ready DOCX —
    /// comments and tracked changes are stripped so the "final" document matches
    /// the clean PDF produced by <see cref="ExportPdf"/>. Optional flags
    /// <c>stripComments</c>/<c>stripTrackedChanges</c> in the form collection
    /// default to <c>true</c>.
    /// </summary>
    [AcceptVerbs("Post")]
    [HttpPost]
    [Route("ExportCleanDocx")]
    public FileStreamResult ExportCleanDocx(IFormCollection data)
    {
        if (data.Files.Count == 0)
        {
            throw new ArgumentException("A DOCX file is required.");
        }

        IFormFile file = data.Files[0];
        var extension = FormatTypeResolver.GetExtension(file.FileName);
        if (extension != ".docx" && extension != ".doc")
        {
            throw new NotSupportedException("ExportCleanDocx accepts Word documents only (.docx/.doc).");
        }

        // Optional flags default to true so callers always get a clean document.
        var stripComments = ParseBoolFlag(data, "stripComments", defaultValue: true);
        var stripTrackedChanges = ParseBoolFlag(data, "stripTrackedChanges", defaultValue: true);

        using var stream = new MemoryStream();
        file.CopyTo(stream);
        stream.Position = 0;

        using var document = new WDocument(stream, FormatTypeResolver.ToDocIOFormat(extension));

        if (stripTrackedChanges && document.HasChanges)
        {
            document.Revisions.RejectAll();
        }

        if (stripComments && document.Comments.Count > 0)
        {
            document.Comments.Clear();
        }

        ApplyLogoWatermark(document);

        var outputStream = new MemoryStream();
        document.Save(outputStream, Syncfusion.DocIO.FormatType.Docx);
        document.Close();

        outputStream.Position = 0;
        var docxName = Path.GetFileNameWithoutExtension(file.FileName) + ".docx";
        return new FileStreamResult(
            outputStream,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        {
            FileDownloadName = docxName
        };
    }

    /// <summary>
    /// Saves the SFDT payload as a Word document to the
    /// <c>wwwroot/Templates/</c> folder.
    /// Path traversal is rejected so the destination stays inside the
    /// templates directory.
    /// </summary>
    [AcceptVerbs("Post")]
    [HttpPost]
    [Route("Save")]
    public IActionResult Save([FromBody] SaveParameter data)
    {
        var fileName = string.IsNullOrWhiteSpace(data.FileName) ? "Document1.docx" : data.FileName!;
        if (!IsValidFileName(fileName))
        {
            return BadRequest("Invalid filename.");
        }

        var format = string.IsNullOrWhiteSpace(data.Format)
            ? FormatTypeResolver.GetExtension(fileName)
            : (data.Format!.StartsWith('.') ? data.Format : "." + data.Format).ToLowerInvariant();

        var templatesPath = Path.Combine(
            AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "Templates");
        Directory.CreateDirectory(templatesPath);

        var safeName = Path.GetFileName(fileName);
        if (!Path.GetExtension(safeName).Equals(format, StringComparison.OrdinalIgnoreCase))
        {
            safeName = Path.GetFileNameWithoutExtension(safeName) + format;
        }

        var fullPath = Path.GetFullPath(Path.Combine(templatesPath, safeName));
        if (!fullPath.StartsWith(Path.GetFullPath(templatesPath), StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("File must be saved within the templates directory.");
        }

        var document = Syncfusion.EJ2.DocumentEditor.WordDocument.Save(data.Content ?? string.Empty);
        using var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.ReadWrite);
        document.Save(fileStream, FormatTypeResolver.ToDocIOFormat(format));
        document.Close();

        return Ok(new { fileName = safeName });
    }

    /// <summary>
    /// Executes a DocIO mail merge on a base64-encoded DOCX using a JSON merge
    /// payload and returns the merged document as SFDT.
    /// </summary>
    [AcceptVerbs("Post")]
    [HttpPost]
    [Route("MailMerge")]
    public string MailMerge([FromBody] MailMergeParameter exportData)
    {
        if (exportData == null || string.IsNullOrEmpty(exportData.DocumentData))
        {
            throw new ArgumentException("Document data cannot be null or empty.");
        }

        var cleanBase64 = exportData.DocumentData.Contains(',')
            ? exportData.DocumentData.Split(',')[1]
            : exportData.DocumentData;
        var bytes = Convert.FromBase64String(cleanBase64);

        using var stream = new MemoryStream();
        stream.Write(bytes, 0, bytes.Length);
        stream.Position = 0;

        using (var document = new WDocument(stream, Syncfusion.DocIO.FormatType.Docx))
        {
            document.MailMerge.RemoveEmptyGroup = true;
            document.MailMerge.RemoveEmptyParagraphs = true;
            document.MailMerge.ClearFields = exportData.ClearFields;
            document.MailMerge.Execute(MailMergeDataAdapter.ToDataTable(exportData.MailMergeData));

            stream.SetLength(0);
            document.Save(stream, Syncfusion.DocIO.FormatType.Docx);
        }

        stream.Position = 0;
        var editorDocument = (Syncfusion.EJ2.DocumentEditor.WordDocument)Syncfusion.EJ2.DocumentEditor.WordDocument.Load(
            stream, Syncfusion.EJ2.DocumentEditor.FormatType.Docx);
        var json = Newtonsoft.Json.JsonConvert.SerializeObject(editorDocument);
        editorDocument.Dispose();
        return json;
    }

    /// <summary>
    /// Enumerates the merge-field names present in an uploaded DOCX file and
    /// returns them so the client can render the merge-fields side panel.
    /// </summary>
    [AcceptVerbs("Post")]
    [HttpPost]
    [Route("GetMergeFieldNames")]
    public MergeFieldNamesResponse GetMergeFieldNames(IFormCollection data)
    {
        if (data.Files.Count == 0)
        {
            return new MergeFieldNamesResponse();
        }

        IFormFile file = data.Files[0];
        var extension = FormatTypeResolver.GetExtension(file.FileName);
        if (!AllowedExtensions.Contains(extension))
        {
            throw new NotSupportedException($"File extension '{extension}' is not supported.");
        }

        using var stream = new MemoryStream();
        file.CopyTo(stream);
        stream.Position = 0;

        using var document = new WDocument(stream, FormatTypeResolver.ToDocIOFormat(extension));
        var names = document.MailMerge.GetMergeFieldNames() ?? Array.Empty<string>();
        return new MergeFieldNamesResponse { MergeFields = names };
    }

    /// <summary>
    /// Compares two uploaded DOCX documents and returns a redlined comparison
    /// document as DOCX using DocIO WordDocument.Compare.
    /// </summary>
    [AcceptVerbs("Post")]
    [HttpPost]
    [Route("CompareDocuments")]
    public FileStreamResult CompareDocuments([FromBody] CompareParameter parameter)
    {
        if (parameter == null
            || string.IsNullOrEmpty(parameter.OriginalDocumentData)
            || string.IsNullOrEmpty(parameter.RevisedDocumentData))
        {
            throw new ArgumentException("Both original and revised document data are required.");
        }

        var originalBytes = DecodeBase64(parameter.OriginalDocumentData);
        var revisedBytes = DecodeBase64(parameter.RevisedDocumentData);

        using var originalStream = new MemoryStream(originalBytes);
        using var originalDocument = new WDocument(originalStream, Syncfusion.DocIO.FormatType.Docx);

        using var revisedStream = new MemoryStream(revisedBytes);
        using var revisedDocument = new WDocument(revisedStream, Syncfusion.DocIO.FormatType.Docx);

        originalDocument.Compare(revisedDocument, parameter.Author ?? "Reviewer", DateTime.Now);

        var outputStream = new MemoryStream();
        originalDocument.Save(outputStream, Syncfusion.DocIO.FormatType.Docx);
        originalDocument.Close();

        outputStream.Position = 0;
        return new FileStreamResult(outputStream,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        {
            FileDownloadName = "Comparison.docx"
        };
    }

    private FileStreamResult SaveDocument(WDocument document, string format, string fileName)
    {
        var stream = new MemoryStream();
        var contentType = string.Empty;

        try
        {
            if (format.Equals(".pdf", StringComparison.OrdinalIgnoreCase))
            {
                contentType = "application/pdf";
                try
                {
                    using var renderer = new DocIORenderer();
                    using var pdfDocument = renderer.ConvertToPDF(document);
                    pdfDocument.Save(stream);
                    pdfDocument.Close();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "ExportSFDT DocIORenderer ConvertToPDF failed for {FileName}", fileName);
                    throw;
                }
            }
            else
            {
                var type = FormatTypeResolver.ToDocIOFormat(format);
                contentType = type switch
                {
                    Syncfusion.DocIO.FormatType.Rtf => "application/rtf",
                    Syncfusion.DocIO.FormatType.WordML => "application/xml",
                    Syncfusion.DocIO.FormatType.Html => "application/html",
                    Syncfusion.DocIO.FormatType.Docx => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    Syncfusion.DocIO.FormatType.Doc or Syncfusion.DocIO.FormatType.Dot => "application/msword",
                    Syncfusion.DocIO.FormatType.Txt => "text/plain",
                    _ => "application/octet-stream"
                };
                document.Save(stream, type);
            }

            document.Close();
            stream.Position = 0;
            return new FileStreamResult(stream, contentType) { FileDownloadName = fileName };
        }
        catch
        {
            stream.Dispose();
            throw;
        }
    }

    private static bool ParseBoolFlag(IFormCollection data, string key, bool defaultValue)
    {
        if (!data.TryGetValue(key, out var values) || values.Count == 0)
        {
            return defaultValue;
        }
        return bool.TryParse(values[0], out var result) ? result : defaultValue;
    }

    private static bool IsValidFileName(string fileName)
    {
        if (string.IsNullOrEmpty(fileName))
        {
            return false;
        }
        if (fileName.Contains("..") || fileName.Contains("/") || fileName.Contains("\\"))
        {
            return false;
        }
        return !Path.GetInvalidFileNameChars().Any(c => fileName.Contains(c));
    }

    private static byte[] DecodeBase64(string value)
    {
        var clean = value.Contains(',') ? value.Split(',')[1] : value;
        return Convert.FromBase64String(clean);
    }
}
