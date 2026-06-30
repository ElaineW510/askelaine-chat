import { AIProjectClient } from "@azure/ai-projects";
import { ClientSecretCredential } from "@azure/identity";

export const runtime = "nodejs";
export const maxDuration = 60;

const AGENT_NAME = process.env.AZURE_AGENT_NAME ?? "AskElaine";
const AGENT_VERSION = process.env.AZURE_AGENT_VERSION ?? "9";

let _client: AIProjectClient | null = null;

function getClient(): AIProjectClient {
  if (!_client) {
    _client = new AIProjectClient(
      process.env.AZURE_PROJECT_ENDPOINT!,
      new ClientSecretCredential(
        process.env.AZURE_TENANT_ID!,
        process.env.AZURE_CLIENT_ID!,
        process.env.AZURE_CLIENT_SECRET!
      )
    );
  }
  return _client;
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

export async function POST(request: Request) {
  let message: string;
  let sessionId: string | undefined;

  try {
    ({ message, sessionId } = await request.json());
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!message?.trim()) {
    return Response.json({ error: '"message" is required' }, { status: 400 });
  }

  try {
    const client = getClient();

    // Create a new session on the first message of a conversation
    if (!sessionId) {
      const session = await client.beta.agents.createSession(AGENT_NAME);
      sessionId = session.agent_session_id;
    }

    // Get an OpenAI client pre-configured for this agent's endpoint
    const openai = client.getOpenAIClient({
      azureConfig: { agentName: AGENT_NAME, allowPreview: true },
    });

    // Call the Responses API — session keeps conversation history
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (openai.responses.create as any)({
      input: message,
      extra_body: { agent_session_id: sessionId },
    });

    return Response.json({
      answer: response.output_text ?? response.output?.[0]?.content?.[0]?.text ?? "No response",
      sessionId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
