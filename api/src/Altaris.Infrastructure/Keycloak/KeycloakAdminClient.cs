using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Altaris.Infrastructure.Keycloak;

public record KeycloakUser(
    string? Id,
    string Username,
    string? Email,
    string? FirstName,
    string? LastName,
    bool Enabled,
    bool EmailVerified,
    Dictionary<string, string[]>? Attributes
);

public record CreateKeycloakUserRequest(
    string Email,
    string? FirstName,
    string? LastName,
    string TenantSlug,
    string Password,
    bool TemporaryPassword,
    string[] RealmRoles
);

public class KeycloakAdminClient
{
    private readonly HttpClient _http;
    private readonly KeycloakAdminOptions _opts;
    private readonly object _tokenLock = new();
    private string? _cachedToken;
    private DateTimeOffset _tokenExpiresAt = DateTimeOffset.MinValue;

    public KeycloakAdminClient(HttpClient http, KeycloakAdminOptions opts)
    {
        _http = http;
        _opts = opts;
    }

    private async Task<string> GetAdminTokenAsync(CancellationToken ct)
    {
        lock (_tokenLock)
        {
            if (_cachedToken is not null && DateTimeOffset.UtcNow < _tokenExpiresAt.AddSeconds(-30))
                return _cachedToken;
        }

        var form = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("grant_type", "client_credentials"),
            new KeyValuePair<string, string>("client_id", _opts.AdminClientId),
            new KeyValuePair<string, string>("client_secret", _opts.AdminClientSecret),
        });

        using var resp = await _http.PostAsync($"{_opts.RealmBase}/protocol/openid-connect/token", form, ct);
        resp.EnsureSuccessStatusCode();
        var doc = await resp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
        var token = doc.GetProperty("access_token").GetString()!;
        var expiresIn = doc.GetProperty("expires_in").GetInt32();

        lock (_tokenLock)
        {
            _cachedToken = token;
            _tokenExpiresAt = DateTimeOffset.UtcNow.AddSeconds(expiresIn);
        }
        return token;
    }

    private async Task<HttpRequestMessage> AuthedAsync(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        var token = await GetAdminTokenAsync(ct);
        var req = new HttpRequestMessage(method, $"{_opts.AdminBase}/realms/{_opts.Realm}{path}");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) req.Content = JsonContent.Create(body);
        return req;
    }

    public async Task<List<KeycloakUser>> ListUsersByTenantAsync(string tenantSlug, int max = 200, CancellationToken ct = default)
    {
        var req = await AuthedAsync(HttpMethod.Get, $"/users?max={max}&q=tenant_id:{Uri.EscapeDataString(tenantSlug)}", null, ct);
        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
        var users = await resp.Content.ReadFromJsonAsync<List<KeycloakUser>>(cancellationToken: ct) ?? new();
        return users.Where(u => u.Attributes != null && u.Attributes.TryGetValue("tenant_id", out var v) && v.Contains(tenantSlug)).ToList();
    }

    public async Task<string> CreateUserAsync(CreateKeycloakUserRequest input, CancellationToken ct = default)
    {
        var payload = new
        {
            username = input.Email,
            email = input.Email,
            firstName = input.FirstName,
            lastName = input.LastName,
            enabled = true,
            emailVerified = true,
            attributes = new { tenant_id = new[] { input.TenantSlug } },
            credentials = new[]
            {
                new { type = "password", value = input.Password, temporary = input.TemporaryPassword }
            }
        };

        var req = await AuthedAsync(HttpMethod.Post, "/users", payload, ct);
        using var resp = await _http.SendAsync(req, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var err = await resp.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Keycloak createUser failed: {(int)resp.StatusCode} {err}");
        }

        // Keycloak returns Location header with the new user ID
        var location = resp.Headers.Location?.ToString() ?? "";
        var newId = location.Split('/').LastOrDefault() ?? "";

        if (input.RealmRoles.Length > 0)
            await AssignRealmRolesAsync(newId, input.RealmRoles, ct);

        return newId;
    }

    public async Task DeleteUserAsync(string keycloakUserId, CancellationToken ct = default)
    {
        var req = await AuthedAsync(HttpMethod.Delete, $"/users/{keycloakUserId}", null, ct);
        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
    }

    /// <summary>
    ///   Update Keycloak user attributes. Only non-null fields in the payload
    ///   are sent — partial PUT'lar Keycloak'ta sıfırlanmaz; nullları es geç.
    /// </summary>
    public async Task UpdateUserAsync(
        string keycloakUserId,
        string? email,
        string? firstName,
        string? lastName,
        bool? enabled,
        CancellationToken ct = default)
    {
        var payload = new Dictionary<string, object?>();
        if (email     is not null) payload["email"]     = email;
        if (firstName is not null) payload["firstName"] = firstName;
        if (lastName  is not null) payload["lastName"]  = lastName;
        if (enabled   is not null) payload["enabled"]   = enabled;
        if (payload.Count == 0) return;

        var req = await AuthedAsync(HttpMethod.Put, $"/users/{keycloakUserId}", payload, ct);
        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
    }

    /// <summary>
    ///   Remove the listed realm roles from a user (DELETE role-mappings/realm).
    ///   Used when changing user.role — eski rolü çıkar, yenisini Assign.
    /// </summary>
    public async Task RemoveRealmRolesAsync(string keycloakUserId, IEnumerable<string> roleNames, CancellationToken ct = default)
    {
        var rolesToRemove = new List<JsonElement>();
        foreach (var name in roleNames)
        {
            var r = await AuthedAsync(HttpMethod.Get, $"/roles/{Uri.EscapeDataString(name)}", null, ct);
            using var rr = await _http.SendAsync(r, ct);
            if (rr.IsSuccessStatusCode)
                rolesToRemove.Add(await rr.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct));
        }
        if (rolesToRemove.Count == 0) return;

        var req = await AuthedAsync(HttpMethod.Delete, $"/users/{keycloakUserId}/role-mappings/realm", rolesToRemove, ct);
        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
    }

    public async Task ResetPasswordAsync(string keycloakUserId, string newPassword, bool temporary, CancellationToken ct = default)
    {
        var payload = new { type = "password", value = newPassword, temporary };
        var req = await AuthedAsync(HttpMethod.Put, $"/users/{keycloakUserId}/reset-password", payload, ct);
        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
    }

    public async Task AssignRealmRolesAsync(string keycloakUserId, IEnumerable<string> roleNames, CancellationToken ct = default)
    {
        // 1) fetch realm role definitions for given names
        var rolesAvailable = new List<JsonElement>();
        foreach (var name in roleNames)
        {
            var r = await AuthedAsync(HttpMethod.Get, $"/roles/{Uri.EscapeDataString(name)}", null, ct);
            using var rr = await _http.SendAsync(r, ct);
            if (rr.IsSuccessStatusCode)
            {
                rolesAvailable.Add(await rr.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct));
            }
        }
        if (rolesAvailable.Count == 0) return;

        var req = await AuthedAsync(HttpMethod.Post, $"/users/{keycloakUserId}/role-mappings/realm", rolesAvailable, ct);
        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
    }

    public async Task<List<string>> GetRealmRolesAsync(string keycloakUserId, CancellationToken ct = default)
    {
        var req = await AuthedAsync(HttpMethod.Get, $"/users/{keycloakUserId}/role-mappings/realm", null, ct);
        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
        var roles = await resp.Content.ReadFromJsonAsync<List<JsonElement>>(cancellationToken: ct) ?? new();
        return roles.Select(r => r.GetProperty("name").GetString() ?? "").Where(s => s.Length > 0).ToList();
    }
}

public class KeycloakAdminOptions
{
    public string AdminBase { get; set; } = "http://localhost:8081/admin";
    public string RealmBase { get; set; } = "http://localhost:8081/realms/altaris";
    public string Realm { get; set; } = "altaris";
    public string AdminClientId { get; set; } = "altaris-admin-svc";
    public string AdminClientSecret { get; set; } = "dev-only-altaris-admin-svc-secret-replace-in-prod";
}
