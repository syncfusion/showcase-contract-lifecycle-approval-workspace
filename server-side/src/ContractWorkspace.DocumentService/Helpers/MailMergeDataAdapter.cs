using System.Text.Json;
using System.Xml.Linq;

namespace ContractWorkspace.DocumentService.Helpers;

/// <summary>
/// Lightweight mail-merge data adapter used to convert a JSON object provided
/// by the client into the <see cref="System.Data.DataTable"/> expected by
/// Syncfusion DocIO <c>MailMerge.Execute</c>. The JSON root contains a single
/// group whose array of records becomes the merge rows.
/// </summary>
public static class MailMergeDataAdapter
{
    /// <summary>
    /// Builds a data table from a JSON mail-merge payload. The JSON structure
    /// is a named group of records: { "GroupName": [ {...} ] }.
    /// </summary>
    /// <param name="mailMergeJson">Raw JSON string coming from the client.</param>
    /// <returns>A populated DataTable whose columns map to the merge-field tokens.</returns>
    /// <exception cref="ArgumentException">Thrown when the JSON is empty or malformed.</exception>
    public static System.Data.DataTable ToDataTable(string? mailMergeJson)
    {
        if (string.IsNullOrWhiteSpace(mailMergeJson))
        {
            throw new ArgumentException("Mail-merge data cannot be null or empty.");
        }

        using var document = JsonDocument.Parse(mailMergeJson!);
        var root = document.RootElement;

        // The payload wraps the rows inside a group array.
        JsonElement recordArray = root.ValueKind == JsonValueKind.Array
            ? root
            : root.EnumerateObject().FirstOrDefault().Value;

        var table = new System.Data.DataTable();

        if (recordArray.ValueKind != JsonValueKind.Array || recordArray.GetArrayLength() == 0)
        {
            return table;
        }

        // Build columns from the first record (DocIO merge tokens map by name).
        var firstRecord = recordArray.EnumerateArray().First();
        foreach (var property in firstRecord.EnumerateObject())
        {
            table.Columns.Add(property.Name, typeof(string));
        }

        // Add each record as a row.
        foreach (var record in recordArray.EnumerateArray())
        {
            var row = table.NewRow();
            foreach (var property in record.EnumerateObject())
            {
                if (table.Columns.Contains(property.Name))
                {
                    row[property.Name] = property.Value.ValueKind switch
                    {
                        JsonValueKind.String => property.Value.GetString() ?? string.Empty,
                        JsonValueKind.Number => property.Value.GetRawText(),
                        JsonValueKind.True or JsonValueKind.False => property.Value.GetBoolean().ToString(),
                        JsonValueKind.Null => DBNull.Value,
                        _ => property.Value.GetRawText()
                    };
                }
            }
            table.Rows.Add(row);
        }

        return table;
    }
}

/// <summary>
/// Utility for converting between the file extensions supported by the
/// Syncfusion Document Editor and the DocIO <see cref="Syncfusion.DocIO.FormatType"/>
/// and <see cref="Syncfusion.EJ2.DocumentEditor.FormatType"/> enums used by the
/// service endpoints.
/// </summary>
public static class FormatTypeResolver
{
    /// <summary>
    /// Maps a file extension to the DocIO <see cref="Syncfusion.DocIO.FormatType"/>.
    /// </summary>
    /// <param name="format">A file extension including the leading dot (e.g. ".docx").</param>
    /// <returns>The matching DocIO <see cref="Syncfusion.DocIO.FormatType"/>.</returns>
    /// <exception cref="NotSupportedException">Thrown when the format is not supported.</exception>
    public static Syncfusion.DocIO.FormatType ToDocIOFormat(string? format)
    {
        if (string.IsNullOrEmpty(format))
        {
            throw new NotSupportedException("EJ2 DocumentEditor does not support this file format.");
        }

        return format.ToLowerInvariant() switch
        {
            ".dotx" or ".docx" or ".docm" or ".dotm" => Syncfusion.DocIO.FormatType.Docx,
            ".dot" or ".doc" => Syncfusion.DocIO.FormatType.Doc,
            ".rtf" => Syncfusion.DocIO.FormatType.Rtf,
            ".txt" => Syncfusion.DocIO.FormatType.Txt,
            ".xml" => Syncfusion.DocIO.FormatType.WordML,
            ".html" or ".htm" => Syncfusion.DocIO.FormatType.Html,
            _ => throw new NotSupportedException($"EJ2 DocumentEditor does not support the '{format}' file format.")
        };
    }

    /// <summary>
    /// Maps a file extension to the EJ2 <see cref="Syncfusion.EJ2.DocumentEditor.FormatType"/>.
    /// </summary>
    /// <param name="format">A file extension including the leading dot (e.g. ".docx").</param>
    /// <returns>The matching EJ2 <see cref="Syncfusion.EJ2.DocumentEditor.FormatType"/>.</returns>
    /// <exception cref="NotSupportedException">Thrown when the format is not supported.</exception>
    public static Syncfusion.EJ2.DocumentEditor.FormatType ToEditorFormat(string? format)
    {
        if (string.IsNullOrEmpty(format))
        {
            throw new NotSupportedException("EJ2 DocumentEditor does not support this file format.");
        }

        return format.ToLowerInvariant() switch
        {
            ".dotx" or ".docx" or ".docm" or ".dotm" => Syncfusion.EJ2.DocumentEditor.FormatType.Docx,
            ".dot" or ".doc" => Syncfusion.EJ2.DocumentEditor.FormatType.Doc,
            ".rtf" => Syncfusion.EJ2.DocumentEditor.FormatType.Rtf,
            ".txt" => Syncfusion.EJ2.DocumentEditor.FormatType.Txt,
            ".xml" => Syncfusion.EJ2.DocumentEditor.FormatType.WordML,
            ".html" or ".htm" => Syncfusion.EJ2.DocumentEditor.FormatType.Html,
            _ => throw new NotSupportedException($"EJ2 DocumentEditor does not support the '{format}' file format.")
        };
    }

    /// <summary>
    /// Extracts the file extension (including the leading dot) from a file name,
    /// defaulting to <c>.docx</c> when the name has no recognizable extension.
    /// </summary>
    /// <param name="fileName">File name to inspect.</param>
    /// <returns>The lower-cased extension including the leading dot.</returns>
    public static string GetExtension(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return ".docx";
        }

        var index = fileName!.LastIndexOf('.');
        return index > -1 && index < fileName.Length - 1
            ? fileName.Substring(index).ToLowerInvariant()
            : ".docx";
    }
}
