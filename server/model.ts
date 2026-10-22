import OpenAI from "openai";
import { toolDefinitions } from "./tools";
import type { Runtime } from "./types";
export type Model = {
  respond(
    input: any[],
    instructions: string,
    options?: { final?: boolean },
  ): Promise<any[]>;
};
export function modelConfig(env: Runtime) {
  const provider =
    env.LLM_PROVIDER ||
    (env.NINEROUTER_URL || env.NINEROUTER_KEY ? "9router" : "openai");
  const key = env.LLM_API_KEY || env.NINEROUTER_KEY || env.OPENAI_API_KEY;
  let baseURL = env.LLM_BASE_URL || env.OPENAI_BASE_URL;
  if (!baseURL && env.NINEROUTER_URL)
    baseURL =
      env.NINEROUTER_URL.replace(/\/$/, "").replace(/\/v1$/, "") + "/v1";
  const model =
    env.LLM_MODEL ||
    env.OPENAI_MODEL ||
    (provider === "openai" ? "gpt-4.1-mini" : "");
  const style =
    env.LLM_API_STYLE ||
    (provider === "9router" ? "chat_completions" : "responses");
  return {
    provider,
    key,
    baseURL,
    model,
    style,
    configured: !!key && !!model && (provider !== "9router" || !!baseURL),
  };
}
// Keep one internal tool protocol so either API style can resume saved turns.
export function toChatMessages(input: any[], instructions: string) {
  const messages: any[] = [{ role: "system", content: instructions }];
  let assistant: any = null;
  const flush = () => {
    if (assistant) {
      if (!assistant.tool_calls?.length) delete assistant.tool_calls;
      messages.push(assistant);
      assistant = null;
    }
  };
  const buffer = () =>
    (assistant ??= { role: "assistant", content: "", tool_calls: [] });
  for (const item of input) {
    if (item.role === "user") {
      flush();
      messages.push({ role: "user", content: item.content });
    } else if (item.type === "function_call") {
      buffer().tool_calls.push({
        id: item.call_id,
        type: "function",
        function: { name: item.name, arguments: item.arguments },
      });
    } else if (item.type === "function_call_output") {
      flush();
      messages.push({
        role: "tool",
        tool_call_id: item.call_id,
        content: item.output,
      });
    } else if (item.type === "router_reasoning") {
      buffer().reasoning_content = item.text;
    } else if (item.type === "message" || item.role === "assistant") {
      const text =
        typeof item.content === "string"
          ? item.content
          : (item.content || [])
              .filter((c: any) => c.type === "output_text" || c.type === "text")
              .map((c: any) => c.text)
              .join("\n");
      buffer().content += text;
    }
  }
  flush();
  return messages;
}
export function createModel(env: Runtime, fetchImpl?: typeof fetch): Model {
  const config = modelConfig(env);
  if (!config.configured) throw Error("MODEL_NOT_CONFIGURED");
  const client = new OpenAI({
    apiKey: config.key,
    baseURL: config.baseURL || undefined,
    timeout: 25000,
    maxRetries: 0,
    fetch: fetchImpl as any,
  });
  return {
    async respond(input, instructions, options) {
      if (config.style === "chat_completions") {
        const response = await client.chat.completions.create({
          model: config.model,
          messages: toChatMessages(input, instructions),
          tools: toolDefinitions.map(
            ({ type, name, description, parameters }) => ({
              type,
              function: { name, description, parameters },
            }),
          ),
          max_tokens: 1600,
          tool_choice: options?.final ? "none" : "auto",
          stream: false,
        });
        const message = response.choices[0]?.message as any;
        if (!message) throw Error("EMPTY_MODEL_REPLY");
        const output: any[] = [];
        if (message.reasoning_content)
          output.push({
            type: "router_reasoning",
            text: message.reasoning_content,
          });
        if (message.content)
          output.push({
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: message.content }],
          });
        for (const call of message.tool_calls || [])
          if (call.type === "function")
            output.push({
              type: "function_call",
              call_id: call.id,
              name: call.function.name,
              arguments: call.function.arguments,
            });
        return output;
      }
      const response = await client.responses.create({
        model: config.model,
        instructions,
        input,
        tools: toolDefinitions as any,
        store: false,
        include: ["reasoning.encrypted_content"],
        max_output_tokens: 1600,
        parallel_tool_calls: false,
        tool_choice: options?.final ? "none" : "auto",
      });
      return response.output;
    },
  };
}
