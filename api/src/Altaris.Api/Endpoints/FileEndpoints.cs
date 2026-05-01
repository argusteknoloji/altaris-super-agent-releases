using System.Text;
using Altaris.Infrastructure.MultiTenancy;
using Microsoft.AspNetCore.Mvc;
using UglyToad.PdfPig;

namespace Altaris.Api.Endpoints;

/// <summary>
///   /api/v1/files/extract — multipart upload, returns extracted text.
///   Used by the web chat to pull plaintext out of PDFs / text-like files
///   client-side so the model can read them as a text message part.
///
///   Limits:
///     • single file per request, 16 MB max
///     • supported types: PDF (PdfPig), text/* and a curated allow-list
///       of source-code / data MIMEs (json, csv, yaml, sh, ts, py …).
///     • binary unsupported types return 415 with the file's metadata so
///       the caller can decide whether to mention the attachment by name.
/// </summary>
public static class FileEndpoints
{
    private const long MaxBytes = 16 * 1024 * 1024;

    private static readonly HashSet<string> TextMimes = new(StringComparer.OrdinalIgnoreCase)
    {
        "text/plain", "text/markdown", "text/csv", "text/html", "text/css",
        "text/x-csrc", "text/x-c++src", "text/x-python", "text/x-shellscript",
        "application/json", "application/xml", "application/x-yaml",
        "application/javascript", "application/typescript",
        "application/x-sh", "application/sql", "application/x-toml"
    };

    private static readonly HashSet<string> TextExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".txt", ".md", ".markdown", ".rst", ".log",
        ".json", ".jsonl", ".ndjson", ".yaml", ".yml", ".toml", ".ini", ".env",
        ".csv", ".tsv", ".tab",
        ".html", ".htm", ".css", ".scss", ".less",
        ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx",
        ".py", ".rb", ".go", ".rs", ".java", ".kt", ".swift", ".cs", ".vb", ".fs",
        ".c", ".h", ".cc", ".cpp", ".hpp", ".m", ".mm",
        ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd",
        ".sql", ".graphql", ".gql",
        ".xml", ".svg", ".plist",
        ".dockerfile", ".gitignore", ".editorconfig", ".npmrc", ".prettierrc"
    };

    public static IEndpointRouteBuilder MapFileEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/files/extract", ExtractAsync)
            .RequireAuthorization()
            .DisableAntiforgery();
        return app;
    }

    private static async Task<IResult> ExtractAsync(
        HttpContext ctx,
        [FromForm] IFormFile file,
        ITenantContext tc,
        CancellationToken cancel)
    {
        if (tc.TenantId is null) return Results.Forbid();
        if (file is null || file.Length == 0) return Results.BadRequest(new { error = "no file" });
        if (file.Length > MaxBytes)
            return Results.Json(new { error = "file too large", maxBytes = MaxBytes }, statusCode: 413);

        var name = file.FileName;
        var mime = (file.ContentType ?? "").ToLowerInvariant();
        var ext  = Path.GetExtension(name).ToLowerInvariant();

        try
        {
            // PDF → PdfPig
            if (mime == "application/pdf" || ext == ".pdf")
            {
                using var stream = file.OpenReadStream();
                using var ms = new MemoryStream();
                await stream.CopyToAsync(ms, cancel);
                ms.Position = 0;
                var sb = new StringBuilder();
                using (var doc = PdfDocument.Open(ms))
                {
                    var pageNo = 0;
                    foreach (var page in doc.GetPages())
                    {
                        pageNo++;
                        sb.Append("--- PDF page ").Append(pageNo).AppendLine(" ---");
                        sb.AppendLine(page.Text);
                        sb.AppendLine();
                    }
                }
                return Results.Ok(new
                {
                    name, mime = "application/pdf", kind = "pdf",
                    bytes = file.Length, text = sb.ToString().Trim()
                });
            }

            // Text-like → readAsString
            if (mime.StartsWith("text/") || TextMimes.Contains(mime) || TextExtensions.Contains(ext))
            {
                using var reader = new StreamReader(file.OpenReadStream(), Encoding.UTF8, true);
                var text = await reader.ReadToEndAsync(cancel);
                // Cap individual file payload at ~250 KB to avoid blowing up the model context
                const int maxChars = 250_000;
                var truncated = false;
                if (text.Length > maxChars)
                {
                    text = text[..maxChars];
                    truncated = true;
                }
                return Results.Ok(new
                {
                    name, mime, kind = "text",
                    bytes = file.Length, text, truncated
                });
            }

            return Results.Json(new
            {
                error = "Unsupported binary file type",
                name, mime, bytes = file.Length,
                hint = "Only PDF and text/code files are extracted. Send the binary as an image if it's a screenshot."
            }, statusCode: 415);
        }
        catch (Exception ex)
        {
            return Results.Json(new { error = ex.Message, name, mime }, statusCode: 500);
        }
    }
}
