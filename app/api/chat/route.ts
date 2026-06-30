import { AIProjectClient } from "@azure/ai-projects";
import { ClientSecretCredential } from "@azure/identity";

export const runtime = "nodejs";
export const maxDuration = 60;

const AGENT_NAME = process.env.AZURE_AGENT_NAME ?? "AskElaine";

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

  try {
    ({ message } = await request.json());
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!message?.trim()) {
    return Response.json({ error: '"message" is required' }, { status: 400 });
  }

  try {
    const client = getClient();

    const openai = client.getOpenAIClient({
      azureConfig: { agentName: AGENT_NAME, allowPreview: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (openai.responses.create as any)({
      input: message,
    });

    return Response.json({
      answer: response.output_text ?? response.output?.[0]?.content?.[0]?.text ?? "No response",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
