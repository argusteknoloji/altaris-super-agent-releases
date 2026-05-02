using Altaris.Infrastructure.Permissions;

namespace Altaris.Api.Permissions;

public static class CapabilityHttpExtensions
{
    /// <summary>
    ///   Endpoint guard: if user lacks the capability, return 403 + diagnostic.
    ///   Returns null when authorised — caller continues; otherwise returns
    ///   IResult to short-circuit.
    ///
    ///   Usage:
    ///     var deny = await ctx.RequireCapabilityAsync(resolver, Capabilities.VaultWrite);
    ///     if (deny is not null) return deny;
    /// </summary>
    public static async Task<IResult?> RequireCapabilityAsync(
        this HttpContext _, CapabilityResolver resolver, string capability, CancellationToken ct = default)
    {
        if (await resolver.HasAsync(capability, ct)) return null;
        return Results.Json(
            new { error = "forbidden", missing_capability = capability },
            statusCode: StatusCodes.Status403Forbidden);
    }
}
