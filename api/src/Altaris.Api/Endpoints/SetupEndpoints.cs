namespace Altaris.Api.Endpoints;

/// <summary>
///   /setup helpers — the web portal "Setup" page asks here for the per-OS
///   CLI download URLs and one-line install commands. Release assets are
///   produced by the .github/workflows/release.yml matrix and uploaded to
///   GitHub Releases on every <c>v*</c> tag.
///
///   Versioning: <c>?version=latest</c> (default) resolves to the GitHub
///   "latest release download" alias; an explicit version (e.g. v0.2.0)
///   pins to a tag for air-gapped reproducibility.
/// </summary>
public static class SetupEndpoints
{
    // Source code (private): argusteknoloji/altaris-super-agent
    // CI build artifacts go to a SEPARATE public repo so anonymous browsers
    // can hit /releases/latest/download/* without a GitHub token.
    private const string DefaultRepo = "argusteknoloji/altaris-super-agent-releases";

    public static IEndpointRouteBuilder MapSetupEndpoints(this IEndpointRouteBuilder app)
    {
        // Authorization not required — install instructions are public; the
        // CLI itself still needs `altaris login` to do anything useful.
        app.MapGet("/api/v1/setup/cli", GetCliInstallers);
        return app;
    }

    public record CliAsset(
        string Os,
        string Arch,
        string Filename,
        string DownloadUrl,
        string InstallScript,
        string PostInstallHint);

    private static IResult GetCliInstallers(HttpContext ctx, IConfiguration cfg)
    {
        var version = ctx.Request.Query["version"].ToString();
        if (string.IsNullOrWhiteSpace(version)) version = "latest";
        var repo = cfg["Setup:GithubRepo"] ?? DefaultRepo;

        // GitHub serves /releases/latest/download/{asset} as a permanent alias.
        // For pinned versions we use /releases/download/{tag}/{asset}.
        string Url(string asset) =>
            version == "latest"
                ? $"https://github.com/{repo}/releases/latest/download/{asset}"
                : $"https://github.com/{repo}/releases/download/{version}/{asset}";

        var apiBase = cfg["Setup:PublicApiBase"] ?? "http://localhost:5050";

        var assets = new[]
        {
            new CliAsset(
                Os: "macos", Arch: "arm64",
                Filename: "altaris-darwin-arm64",
                DownloadUrl: Url("altaris-darwin-arm64"),
                InstallScript:
                    $"curl -fsSL -o /tmp/altaris {Url("altaris-darwin-arm64")} \\\n" +
                    "  && chmod +x /tmp/altaris \\\n" +
                    "  && mkdir -p ~/.local/bin \\\n" +
                    "  && mv /tmp/altaris ~/.local/bin/altaris \\\n" +
                    "  && echo 'export PATH=\"$HOME/.local/bin:$PATH\"' >> ~/.zshrc",
                PostInstallHint: $"altaris login   # API: {apiBase}"),
            new CliAsset(
                Os: "macos", Arch: "x64",
                Filename: "altaris-darwin-x64",
                DownloadUrl: Url("altaris-darwin-x64"),
                InstallScript:
                    $"curl -fsSL -o /tmp/altaris {Url("altaris-darwin-x64")} \\\n" +
                    "  && chmod +x /tmp/altaris \\\n" +
                    "  && mkdir -p ~/.local/bin && mv /tmp/altaris ~/.local/bin/altaris",
                PostInstallHint: $"altaris login   # API: {apiBase}"),
            new CliAsset(
                Os: "linux", Arch: "x64",
                Filename: "altaris-linux-x64",
                DownloadUrl: Url("altaris-linux-x64"),
                InstallScript:
                    $"curl -fsSL -o /tmp/altaris {Url("altaris-linux-x64")} \\\n" +
                    "  && chmod +x /tmp/altaris \\\n" +
                    "  && sudo mv /tmp/altaris /usr/local/bin/altaris",
                PostInstallHint: $"altaris login   # API: {apiBase}"),
            new CliAsset(
                Os: "linux", Arch: "arm64",
                Filename: "altaris-linux-arm64",
                DownloadUrl: Url("altaris-linux-arm64"),
                InstallScript:
                    $"curl -fsSL -o /tmp/altaris {Url("altaris-linux-arm64")} \\\n" +
                    "  && chmod +x /tmp/altaris \\\n" +
                    "  && sudo mv /tmp/altaris /usr/local/bin/altaris",
                PostInstallHint: $"altaris login   # API: {apiBase}"),
            new CliAsset(
                Os: "windows", Arch: "x64",
                Filename: "altaris-windows-x64.exe",
                DownloadUrl: Url("altaris-windows-x64.exe"),
                InstallScript:
                    "# PowerShell (Run as Administrator değil, normal user yeter):\n" +
                    "$ErrorActionPreference = 'Stop'\n" +
                    "$dir = \"$env:LOCALAPPDATA\\Altaris\"\n" +
                    "New-Item -ItemType Directory -Force -Path $dir | Out-Null\n" +
                    $"Invoke-WebRequest -Uri '{Url("altaris-windows-x64.exe")}' -OutFile \"$dir\\altaris.exe\"\n" +
                    "$path = [Environment]::GetEnvironmentVariable('Path', 'User')\n" +
                    "if ($path -notlike \"*$dir*\") {\n" +
                    "  [Environment]::SetEnvironmentVariable('Path', \"$path;$dir\", 'User')\n" +
                    "}\n" +
                    "Write-Host 'Yeni terminal aç, sonra: altaris login'",
                PostInstallHint: $"altaris login   # API: {apiBase}"),
        };

        return Results.Ok(new
        {
            version,
            repo,
            apiBase,
            webBase = cfg["Setup:PublicWebBase"] ?? "http://localhost:3000",
            assets
        });
    }
}
