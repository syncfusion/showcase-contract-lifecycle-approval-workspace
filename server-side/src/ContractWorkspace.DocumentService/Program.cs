using Microsoft.AspNetCore.OpenApi;

namespace ContractWorkspace.DocumentService;

/// <summary>
/// Stateless Document Editor web service for the Contract Lifecycle &amp;
/// Approval Workspace showcase. Hosts the Syncfusion Document Editor
/// server-side operations (Import, SystemClipboard, RestrictEditing, SpellCheck,
/// SpellCheckByPage, ExportSFDT, Save, MailMerge, GetMergeFieldNames),
/// the showcase-specific ExportPdf (clean PDF via DocIO + DocIORenderer) and
/// CompareDocuments (DocIO Compare) endpoints, plus static
/// template payloads under <c>wwwroot/Templates/</c>.
/// </summary>
public sealed class Program
{
    /// <summary>
    /// Application entry point. Configures MVC controllers, CORS, OpenAPI, and
    /// static-files middleware (for serving template DOCX files). The Kestrel
    /// listen address comes from configuration/environment: local development
    /// binds <c>http://localhost:5212</c> (appsettings.Development.json), while
    /// hosted environments (e.g. Azure App Service) honor the platform-provided
    /// binding such as <c>http://*:8080</c>.
    /// </summary>
    /// <param name="args">Command-line arguments.</param>
    public static void Main(string[] args)
    {
        Syncfusion.Licensing.SyncfusionLicenseProvider
            .RegisterLicense(Environment.GetEnvironmentVariable("SYNCFUSION_LICENSE_KEY") ?? string.Empty);

        var builder = WebApplication.CreateBuilder(args);

        // Controllers + JSON defaults that play well with SFDT payloads.
        builder.Services.AddControllers()
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.PropertyNamingPolicy = null;
            });

        // CORS: dev/demo AllowAllOrigins; production should override in appsettings.
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowAllOrigins", policy => policy
                .AllowAnyOrigin()
                .AllowAnyMethod()
                .AllowAnyHeader());
        });

        // OpenAPI document (Microsoft.AspNetCore.OpenApi).
        builder.Services.AddOpenApi();

        // MVC testing harness so the integration test project can boot the API in-process.
        builder.Services.AddHttpClient();

        var app = builder.Build();

        // Order matters: UseStaticFiles must precede UseRouting so static
        // assets short-circuit, but UseCors must sit BETWEEN UseRouting and
        // MapControllers so routed endpoints decorated with [EnableCors] resolve
        // their CORS metadata. To emit Access-Control-Allow-Origin on the static
        // wwwroot/Templates responses (which bypass routing), a minimal custom
        // middleware injects the header before UseStaticFiles.
        app.Use(async (ctx, next) =>
        {
            // Echo the requesting origin (browsers set it on cross-origin fetches)
            // for the static template assets so the React client can fetch them.
            if (ctx.Request.Path.StartsWithSegments("/Templates") && ctx.Request.Headers.Origin.Count > 0)
            {
                ctx.Response.Headers.AccessControlAllowOrigin = ctx.Request.Headers.Origin;
                ctx.Response.Headers.AccessControlAllowHeaders = "*";
                ctx.Response.Headers.AccessControlAllowMethods = "GET, OPTIONS";
                // Preflight for a simple GET is rare, but respond quickly.
                if (HttpMethods.IsOptions(ctx.Request.Method))
                {
                    ctx.Response.StatusCode = StatusCodes.Status204NoContent;
                    return;
                }
            }
            await next();
        });
        app.UseStaticFiles();
        app.UseRouting();
        app.UseCors("AllowAllOrigins");
        app.UseAuthorization();

        // Map controllers and the OpenAPI document for development/documentation contexts.
        app.MapControllers();
        app.MapGet("/", () => "Document Editor Web Service is running");

        app.MapOpenApi();

        // Ensure template + App_Data directories exist.
        Directory.CreateDirectory(Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "Templates"));
        Directory.CreateDirectory(Path.Combine(builder.Environment.ContentRootPath, "App_Data"));

        app.Run();
    }
}
