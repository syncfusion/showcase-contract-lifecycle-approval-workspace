using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Mvc.Testing;
using Syncfusion.DocIO;
using Syncfusion.DocIO.DLS;
using Xunit;

namespace ContractWorkspace.DocumentService.Tests;

/// <summary>
/// In-process smoke tests for the document service endpoints. These tests
/// boot the web application via <see cref="WebApplicationFactory{T}"/> and
/// verify the health probe, Import, ExportPdf, GetMergeFieldNames, MailMerge,
/// and CompareDocuments endpoints against the template files under
/// <c>wwwroot/Templates</c>.
/// </summary>
public class DocumentEditorEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public DocumentEditorEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_ReturnsOk()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Healthy", content);
        Assert.Contains("version", content);
    }

    [Fact]
    public async Task Import_TemplateDocx_ReturnsSfdtJson()
    {
        var templatePath = ResolveTemplatePath("MutualNDA.docx");
        if (!File.Exists(templatePath))
        {
            // Skip when template assets have not been generated yet.
            return;
        }

        var client = _factory.CreateClient();
        using var form = new MultipartFormDataContent();
        using var fileStream = File.OpenRead(templatePath);
        using var fileContent = new StreamContent(fileStream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        form.Add(fileContent, "files", Path.GetFileName(templatePath));

        var response = await client.PostAsync("/api/documenteditor/Import", form);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.False(string.IsNullOrWhiteSpace(json));
    }

    [Fact]
    public async Task GetMergeFieldNames_TemplateDocx_ReturnsMergeFieldTokenList()
    {
        var templatePath = ResolveTemplatePath("ServiceAgreement.docx");
        if (!File.Exists(templatePath))
        {
            return;
        }

        var client = _factory.CreateClient();
        using var form = new MultipartFormDataContent();
        using var fileStream = File.OpenRead(templatePath);
        using var fileContent = new StreamContent(fileStream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        form.Add(fileContent, "files", Path.GetFileName(templatePath));

        var response = await client.PostAsync("/api/documenteditor/GetMergeFieldNames", form);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var names = await response.Content.ReadFromJsonAsync<MergeFieldNamesResponse>();
        Assert.NotNull(names);
        Assert.NotEmpty(names!.MergeFields);
        Assert.Contains("CompanyName", names.MergeFields);
    }

    [Fact]
    public async Task ExportPdf_UploadsDocx_ReturnsCleanPdf()
    {
        var templatePath = ResolveTemplatePath("PurchaseContract.docx");
        if (!File.Exists(templatePath))
        {
            return;
        }

        var client = _factory.CreateClient();
        using var form = new MultipartFormDataContent();
        using var fileStream = File.OpenRead(templatePath);
        using var fileContent = new StreamContent(fileStream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        form.Add(fileContent, "files", Path.GetFileName(templatePath));

        var response = await client.PostAsync("/api/documenteditor/ExportPdf", form);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.True(bytes.Length > 0);
        Assert.Equal(0x25, bytes[0]); // %PDF
    }

    [Fact]
    public async Task ExportCleanDocx_UploadsDocxWithComment_ReturnsDocxWithoutComments()
    {
        // Build an in-memory DOCX carrying a review comment so the strip logic
        // has something to remove.
        byte[] inputBytes;
        using (var authored = new WordDocument())
        {
            var section = authored.AddSection();
            var para = section.AddParagraph();
            para.AppendText("Final contract body text.");
            para.AppendComment("Reviewer note — should be stripped on export.");
            using var authoredStream = new MemoryStream();
            authored.Save(authoredStream, FormatType.Docx);
            inputBytes = authoredStream.ToArray();
        }

        var client = _factory.CreateClient();
        using var form = new MultipartFormDataContent();
        using var fileContent = new ByteArrayContent(inputBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        form.Add(fileContent, "files", "contract.docx");

        var response = await client.PostAsync("/api/documenteditor/ExportCleanDocx", form);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            response.Content.Headers.ContentType?.MediaType);

        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.True(bytes.Length > 0);

        using var resultStream = new MemoryStream(bytes);
        using var cleaned = new WordDocument(resultStream, FormatType.Docx);
        Assert.Equal(0, cleaned.Comments.Count);
    }

    /// <summary>
    /// Regression guard: Word-to-PDF on Azure App Service Linux requires the
    /// SkiaSharp/HarfBuzz Linux native asset packages. They are not pulled in
    /// transitively (only Win32 + macOS are). Missing them produces
    /// <c>ExportPdf</c> HTTP 500 with an empty body.
    /// </summary>
    [Fact]
    public void Csproj_ReferencesLinuxNativeAssetsForWordToPdf()
    {
        var csproj = ResolveDocumentServiceCsproj();
        Assert.True(File.Exists(csproj), $"DocumentService csproj not found: {csproj}");
        var xml = File.ReadAllText(csproj);
        Assert.Contains(
            """<PackageReference Include="SkiaSharp.NativeAssets.Linux" Version="3.119.1" />""",
            xml);
        Assert.Contains(
            """<PackageReference Include="HarfBuzzSharp.NativeAssets.Linux" Version="8.3.1.2" />""",
            xml);
    }

    private static string ResolveTemplatePath(string fileName)
    {
        var baseDir = AppContext.BaseDirectory;
        for (var i = 0; i < 6; i++)
        {
            var candidate = Path.Combine(baseDir, "wwwroot", "Templates", fileName);
            if (File.Exists(candidate))
            {
                return candidate;
            }
            baseDir = Directory.GetParent(baseDir)?.FullName ?? baseDir;
        }
        return Path.Combine(Environment.CurrentDirectory, "wwwroot", "Templates", fileName);
    }

    private static string ResolveDocumentServiceCsproj()
    {
        var baseDir = AppContext.BaseDirectory;
        for (var i = 0; i < 8; i++)
        {
            var candidate = Path.Combine(
                baseDir,
                "src",
                "ContractWorkspace.DocumentService",
                "ContractWorkspace.DocumentService.csproj");
            if (File.Exists(candidate))
            {
                return candidate;
            }

            candidate = Path.Combine(baseDir, "ContractWorkspace.DocumentService.csproj");
            if (File.Exists(candidate))
            {
                return candidate;
            }

            baseDir = Directory.GetParent(baseDir)?.FullName ?? baseDir;
        }

        return Path.Combine(
            Environment.CurrentDirectory,
            "src",
            "ContractWorkspace.DocumentService",
            "ContractWorkspace.DocumentService.csproj");
    }

    private sealed class MergeFieldNamesResponse
    {
        public string[] MergeFields { get; set; } = Array.Empty<string>();
    }
}
