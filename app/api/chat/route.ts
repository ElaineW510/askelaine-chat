import { ClientSecretCredential } from "@azure/identity";

export const runtime = "nodejs";
export const maxDuration = 60;

// Scope required for Azure AI Foundry / Cognitive Services
const AZURE_SCOPE = "https://cognitiveservices.azure.com/.default";

// Lazy singleton — created on first request so env vars are available
let credential: ClientSecretCredential | null = null;
function getCredential() {
  if (!credential) {
    credential = new ClientSecretCredential(
      process.env.AZURE_TENANT_ID!,
      process.env.AZURE_CLIENT_ID!,
      process.env.AZURE_CLIENT_SECRET!
    );
  }
  return credential;
}

export async function POST(request: Request) {
  let message: string;
  let previousResponseId: string | undefined;

  try {
    ({ message, previousResponseId } = await request.json());
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!message?.trim()) {
    return Response.json({ error: '"message" is required' }, { status: 400 });
  }

  // Get a fresh (or cached) Entra ID bearer token
  const { token } = await getCredential().getToken(AZURE_SCOPE);

  const apiVersion = process.env.AZURE_API_VERSION ?? "1.0";
  const endpoint = `${process.env.AZURE_AGENT_ENDPOINT}?api-version=${apiVersion}`;

  const agentRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      input: message,
      ...(previousResponseId && { previous_response_id: previousResponseId }),
      stream: true,
    }),
  });

  if (!agentRes.ok || !agentRes.body) {
    const text = await agentRes.text();
    return Response.json(
      { error: `Azure returned ${agentRes.status}: ${text}` },
      { status: agentRes.status }
    );
  }

  // Stream the SSE response back to the Framer widget
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (payload: object) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        );

      try {
        const reader = agentRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;

            let event: Record<string, unknown>;
            try {
              event = JSON.parse(raw);
            } catch {
              continue;
            }

            const type = event.type as string | undefined;
            const responseId =
              (event as { response?: { id?: string } }).response?.id;

            if (type === "response.output_text.delta") {
              send({ text: event.delta, responseId });
            } else if (type === "response.completed") {
              send({ done: true, responseId });
            } else if (type === "response.failed") {
              const errMsg =
                (event as { response?: { error?: { message?: string } } })
                  .response?.error?.message ?? "Response failed";
              send({ error: errMsg });
            }
          }
        }
      } catch (err) {
        send({ error: err instanceof Error ? err.message : "Stream error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
