namespace Altaris.Domain.Permissions;

/// <summary>
///   Granular capabilities — the unit of authorization in Altaris.
///   Endpoints check capabilities via <c>requireCapability(ctx, "X")</c>;
///   defaults come from RoleDefaults; per-user overrides come from
///   <c>user_capabilities</c> table.
///
///   When adding a new capability:
///     1. Add the constant here.
///     2. Update RoleDefaults so existing users keep working.
///     3. Add the requireCapability check to the endpoint.
///     4. Mention it in the UI's capability matrix label map.
/// </summary>
public static class Capabilities
{
    // Chat
    public const string ChatUse           = "chat.use";
    public const string ChatAttachFiles   = "chat.attach_files";

    // Sessions / transcript
    public const string SessionCreate     = "session.create";
    public const string SessionViewOwn    = "session.view_own";
    public const string SessionViewAll    = "session.view_all";

    // Vaults
    public const string VaultRead         = "vault.read";
    public const string VaultWrite        = "vault.write";
    public const string VaultCreate       = "vault.create";
    public const string VaultDelete       = "vault.delete";
    public const string VaultShare        = "vault.share";

    // Remote Control
    public const string RemoteControlPublish  = "remote_control.publish";
    public const string RemoteControlView     = "remote_control.view";
    public const string RemoteControlTakeover = "remote_control.takeover";

    // Admin (tenant scope)
    public const string AdminUsers        = "admin.users";
    public const string AdminProviders    = "admin.providers";
    public const string AdminAudit        = "admin.audit";
    public const string AdminInvitations  = "admin.invitations";

    // Admin (platform scope — only platform_admin role grants by default)
    public const string AdminTenants      = "admin.tenants";

    // API keys
    public const string ApiKeyCreate      = "api_key.create";
    public const string ApiKeyListOwn     = "api_key.list_own";
    public const string ApiKeyListAll     = "api_key.list_all";

    /// <summary>Tüm bilinen capability adları — UI matrix için.</summary>
    public static readonly IReadOnlyList<string> All = new[]
    {
        ChatUse, ChatAttachFiles,
        SessionCreate, SessionViewOwn, SessionViewAll,
        VaultRead, VaultWrite, VaultCreate, VaultDelete, VaultShare,
        RemoteControlPublish, RemoteControlView, RemoteControlTakeover,
        AdminUsers, AdminProviders, AdminAudit, AdminInvitations, AdminTenants,
        ApiKeyCreate, ApiKeyListOwn, ApiKeyListAll,
    };
}

/// <summary>
///   Default capability sets for the three built-in roles.
///   Effective set for a user = RoleDefaults[user.role] ∪ allow-overrides ∖ deny-overrides.
/// </summary>
public static class RoleDefaults
{
    public static readonly IReadOnlySet<string> Member = new HashSet<string>
    {
        Capabilities.ChatUse, Capabilities.ChatAttachFiles,
        Capabilities.SessionCreate, Capabilities.SessionViewOwn,
        Capabilities.VaultRead, Capabilities.VaultWrite, Capabilities.VaultCreate,
        Capabilities.RemoteControlPublish,
        Capabilities.ApiKeyCreate, Capabilities.ApiKeyListOwn,
    };

    public static readonly IReadOnlySet<string> TenantAdmin = new HashSet<string>(Member)
    {
        Capabilities.SessionViewAll,
        Capabilities.VaultDelete, Capabilities.VaultShare,
        Capabilities.RemoteControlView, Capabilities.RemoteControlTakeover,
        Capabilities.AdminUsers, Capabilities.AdminProviders,
        Capabilities.AdminAudit, Capabilities.AdminInvitations,
        Capabilities.ApiKeyListAll,
    };

    public static readonly IReadOnlySet<string> PlatformAdmin = new HashSet<string>(TenantAdmin)
    {
        Capabilities.AdminTenants,
    };

    public static IReadOnlySet<string> ForRole(string role) => role switch
    {
        "platform_admin" => PlatformAdmin,
        "tenant_admin"   => TenantAdmin,
        _                => Member,
    };
}
