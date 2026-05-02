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

    public record KeycloakSession(string Id, string Username, string IpAddress, long Start, long LastAccess, Dictionary<string, string>? Clients);

    public async Task<List<KeycloakSession>> ListSessionsAsync(string keycloakUserId, CancellationToken ct = default)
    {
        var req = await AuthedAsync(HttpMethod.Get, $"/users/{keycloakUserId}/sessions", null, ct);
        using var resp = await _http.SendAsync(req, ct);
        if (!resp.IsSuccessStatusCode) return new();
        var arr = await resp.Content.ReadFromJsonAsync<List<JsonElement>>(cancellationToken: ct) ?? new();
        return arr.Select(j => new KeycloakSession(
            Id: j.GetProperty("id").GetString() ?? "",
            Username: j.TryGetProperty("username", out var u) ? u.GetString() ?? "" : "",
            IpAddress: j.TryGetProperty("ipAddress", out var ip) ? ip.GetString() ?? "" : "",
            Start: j.TryGetProperty("start", out var s) ? s.GetInt64() : 0,
            LastAccess: j.TryGetProperty("lastAccess", out var la) ? la.GetInt64() : 0,
            Clients: j.TryGetProperty("clients", out var cl) && cl.ValueKind == JsonValueKind.Object
                ? cl.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetString() ?? "")
                : null
        )).ToList();
    }

    public async Task DeleteSessionAsync(string sessionId, CancellationToken ct = default)
    {
        var req = await AuthedAsync(HttpMethod.Delete, $"/sessions/{sessionId}", null, ct);
        using var resp = await _http.SendAsync(req, ct);
        // Keycloak 204 NoContent veya 404 (session zaten yok) — ikisi de OK.
        if (!resp.IsSuccessStatusCode && resp.StatusCode != System.Net.HttpStatusCode.NotFound)
            resp.EnsureSuccessStatusCode();
    }

    /// <summary>Bütün aktif oturumları sonlandır (yeni login zorunlu).</summary>
    public async Task LogoutAllAsync(string keycloakUserId, CancellationToken ct = default)
    {
        var req = await AuthedAsync(HttpMethod.Post, $"/users/{keycloakUserId}/logout", null, ct);
        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
    }

    /// <summary>
    ///   Bir kullanıcıya CONFIGURE_TOTP required-action ekler — kullanıcı bir
    ///   sonraki login'de zorunlu olarak Google Authenticator / Authy ile
    ///   QR code okutup TOTP kurmak zorunda kalır. Mevcut required actions'ı
    ///   bozmaz (read-then-write).
    /// </summary>
    public async Task RequireTotpAsync(string keycloakUserId, CancellationToken ct = default)
    {
        // 1) get current actions
        var getReq = await AuthedAsync(HttpMethod.Get, $"/users/{keycloakUserId}", null, ct);
        using var getResp = await _http.SendAsync(getReq, ct);
        getResp.EnsureSuccessStatusCode();
        var json = await getResp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
        var actions = new HashSet<string>();
        if (json.TryGetProperty("requiredActions", out var ra) && ra.ValueKind == JsonValueKind.Array)
            foreach (var el in ra.EnumerateArray()) if (el.GetString() is { } s) actions.Add(s);
        actions.Add("CONFIGURE_TOTP");

        // 2) put back
        var putReq = await AuthedAsync(HttpMethod.Put, $"/users/{keycloakUserId}",
            new { requiredActions = actions.ToArray() }, ct);
        using var putResp = await _http.SendAsync(putReq, ct);
        putResp.EnsureSuccessStatusCode();
    }

    /// <summary>
    ///   Bir kullanıcının TOTP credential'ı kurulu mu? (self-service security
    ///   sayfası bunu çekip "2FA: aktif" göstermek için kullanır.)
    /// </summary>
    public async Task<bool> HasTotpAsync(string keycloakUserId, CancellationToken ct = default)
    {
        var req = await AuthedAsync(HttpMethod.Get, $"/users/{keycloakUserId}/credentials", null, ct);
        using var resp = await _http.SendAsync(req, ct);
        if (!resp.IsSuccessStatusCode) return false;
        var arr = await resp.Content.ReadFromJsonAsync<List<JsonElement>>(cancellationToken: ct) ?? new();
        foreach (var c in arr)
        {
            var type = c.TryGetProperty("type", out var t) ? t.GetString() : null;
            if (type is "otp" or "totp") return true;
        }
        return false;
    }

    /// <summary>Aynı simetri: RemoveTotpAsync — TOTP credential'ları siler.</summary>
    public async Task RemoveTotpAsync(string keycloakUserId, CancellationToken ct = default)
    {
        // List credentials, find the TOTP/OTP ones, delete each.
        var listReq = await AuthedAsync(HttpMethod.Get, $"/users/{keycloakUserId}/credentials", null, ct);
        using var listResp = await _http.SendAsync(listReq, ct);
        if (!listResp.IsSuccessStatusCode) return;
        var arr = await listResp.Content.ReadFromJsonAsync<List<JsonElement>>(cancellationToken: ct) ?? new();
        foreach (var c in arr)
        {
            var type = c.TryGetProperty("type", out var t) ? t.GetString() : null;
            if (type is not ("otp" or "totp")) continue;
            var credId = c.GetProperty("id").GetString();
            if (credId is null) continue;
            var delReq = await AuthedAsync(HttpMethod.Delete, $"/users/{keycloakUserId}/credentials/{credId}", null, ct);
            using var _ = await _http.SendAsync(delReq, ct);
        }
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
