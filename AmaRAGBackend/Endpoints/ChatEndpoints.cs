namespace AmaRAGBackend.Endpoints;

using AmaRAGBackend.Models;
using AmaRAGBackend.Services;

/// <summary>
/// Extension methods for chat endpoints
/// </summary>
public static class ChatEndpoints
{
    public static RouteGroupBuilder AddChatEndpoints(this RouteGroupBuilder group)
    {
        var chatGroup = group.MapGroup("/chat")
            .WithName("Chat")
            .WithOpenApi();

        chatGroup.MapPost("/ask", Ask)
            .WithName("Ask Question")
            .WithDescription("Ask a question based on indexed documents")
            .Produces<ChatResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);

        return group;
    }

    private static async Task<IResult> Ask(ChatRequest request, IChatService chatService)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Question))
                return Results.BadRequest(new { error = "Question cannot be empty" });

            var response = await chatService.GetAnswerAsync(request);
            return Results.Ok(response);
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }
}
