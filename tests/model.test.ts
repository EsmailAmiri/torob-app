import test from "node:test";
import assert from "node:assert/strict";
import { createModel, modelConfig, toChatMessages } from "../server/model";
test("9router requires URL, key and model and defaults to chat completions", () => {
  assert.equal(
    modelConfig({ LLM_PROVIDER: "9router", LLM_API_KEY: "test" }).configured,
    false,
  );
  const config = modelConfig({
    NINEROUTER_KEY: "test-key",
    NINEROUTER_URL: "http://localhost:20128",
    LLM_MODEL: "configured-model",
  });
  assert.equal(config.baseURL, "http://localhost:20128/v1");
  assert.equal(config.style, "chat_completions");
  assert.equal(config.configured, true);
  assert.equal(modelConfig({ OPENAI_API_KEY: "test-key" }).style, "responses");
});
test("Chat tool calls are grouped and reasoning and results survive conversion", () => {
  const messages = toChatMessages(
    [
      { role: "user", content: "Search" },
      { type: "router_reasoning", text: "saved-reasoning" },
      {
        type: "function_call",
        call_id: "call_a",
        name: "search_products",
        arguments: '{"query":"phone"}',
      },
      {
        type: "function_call",
        call_id: "call_b",
        name: "get_shop_details",
        arguments: "{}",
      },
      {
        type: "function_call_output",
        call_id: "call_a",
        output: '{"total":1}',
      },
      { type: "function_call_output", call_id: "call_b", output: "{}" },
    ],
    "instructions",
  );
  assert.equal(messages[2].tool_calls.length, 2);
  assert.equal(messages[2].reasoning_content, "saved-reasoning");
  assert.equal(messages[3].role, "tool");
  assert.equal(messages[3].tool_call_id, "call_a");
});
test("OpenAI SDK adapter sends the correct 9router HTTP tool protocol", async () => {
  let requests = 0;
  const fakeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const body = (await request.json()) as any;
    assert.ok(request.url.endsWith("/v1/chat/completions"));
    assert.equal(request.headers.get("authorization"), "Bearer test-key");
    assert.equal(body.model, "my-configured-model");
    assert.ok(body.tools.some((t: any) => t.function.name === "find_sellers"));
    requests++;
    if (requests === 1)
      return Response.json({
        id: "chat_1",
        object: "chat.completion",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "search_products",
                    arguments: '{"query":"گوشی"}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      });
    assert.equal(body.messages.at(-1).role, "tool");
    assert.equal(body.messages.at(-1).tool_call_id, "call_1");
    return Response.json({
      id: "chat_2",
      object: "chat.completion",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "نتایج بر اساس دیتاست آماده است.",
          },
          finish_reason: "stop",
        },
      ],
    });
  };
  const model = createModel(
    {
      LLM_PROVIDER: "9router",
      LLM_BASE_URL: "https://router.example/v1",
      LLM_API_KEY: "test-key",
      LLM_MODEL: "my-configured-model",
    },
    fakeFetch,
  );
  const input: any[] = [{ role: "user", content: "گوشی می‌خواهم" }];
  const first = await model.respond(input, "instructions");
  assert.equal(first[0].type, "function_call");
  const second = await model.respond(
    [
      ...input,
      ...first,
      {
        type: "function_call_output",
        call_id: "call_1",
        output: '{"total":1}',
      },
    ],
    "instructions",
  );
  assert.equal(second[0].content[0].text, "نتایج بر اساس دیتاست آماده است.");
  assert.equal(requests, 2);
});
