namespace AmaRAGBackend.Endpoints;

using AmaRAGBackend.Services;

public static class GmailEndpoints
{
    public static RouteGroupBuilder AddGmailEndpoints(this RouteGroupBuilder group)
    {
        var gmailGroup = group.MapGroup("/gmail")
            .WithName("Gmail")
            .WithOpenApi();

        gmailGroup.MapGet("/unread", GetUnreadEmails)
            .WithName("Get Unread Emails")
            .WithDescription("Fetch unread emails through the Python Gmail MCP server");

        gmailGroup.MapGet("/read/{emailId}", ReadEmail)
            .WithName("Read Email")
            .WithDescription("Read an email by id through Gmail MCP");

        gmailGroup.MapPost("/send", SendEmail)
            .WithName("Send Email")
            .WithDescription("Send an email through Gmail MCP");

        gmailGroup.MapPost("/trash/{emailId}", TrashEmail)
            .WithName("Trash Email")
            .WithDescription("Move an email to trash through Gmail MCP");

        gmailGroup.MapPost("/mark-read/{emailId}", MarkEmailAsRead)
            .WithName("Mark Email As Read")
            .WithDescription("Mark an email as read through Gmail MCP");

        return group;
    }

    private static async Task<IResult> GetUnreadEmails(IGmailMcpService gmailMcpService)
    {
        var response = await gmailMcpService.GetUnreadEmailsAsync();
        return ToHttpResult(response);
    }

    private static async Task<IResult> ReadEmail(string emailId, IGmailMcpService gmailMcpService)
    {
        if (string.IsNullOrWhiteSpace(emailId))
            return Results.BadRequest(new { error = "emailId cannot be empty" });

        var response = await gmailMcpService.ReadEmailAsync(emailId);
        return ToHttpResult(response);
    }

    private static async Task<IResult> SendEmail(SendEmailRequest request, IGmailMcpService gmailMcpService)
    {
        if (string.IsNullOrWhiteSpace(request.RecipientId) || string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.Message))
        {
            return Results.BadRequest(new { error = "recipientId, subject, and message are required" });
        }

        var response = await gmailMcpService.SendEmailAsync(request.RecipientId, request.Subject, request.Message);
        return ToHttpResult(response);
    }

    private static async Task<IResult> TrashEmail(string emailId, IGmailMcpService gmailMcpService)
    {
        if (string.IsNullOrWhiteSpace(emailId))
            return Results.BadRequest(new { error = "emailId cannot be empty" });

        var response = await gmailMcpService.TrashEmailAsync(emailId);
        return ToHttpResult(response);
    }

    private static async Task<IResult> MarkEmailAsRead(string emailId, IGmailMcpService gmailMcpService)
    {
        if (string.IsNullOrWhiteSpace(emailId))
            return Results.BadRequest(new { error = "emailId cannot be empty" });

        var response = await gmailMcpService.MarkEmailAsReadAsync(emailId);
        return ToHttpResult(response);
    }

    private static IResult ToHttpResult(GmailMcpToolResult response)
    {
        if (!response.Success && string.IsNullOrWhiteSpace(response.ErrorMessage))
        {
            response.ErrorMessage = "Gmail MCP invocation failed. Verify credentials/token paths and OAuth authorization state.";
        }

        return response.Success ? Results.Ok(response) : Results.BadRequest(response);
    }

    public class SendEmailRequest
    {
        public string RecipientId { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
}
