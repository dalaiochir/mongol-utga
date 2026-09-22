import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST, GET } from "../app/api/run/route";
function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://utga.example/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
test("API fails closed without credentials, rejects cross-origin before upstream access", async () => {
  const saved = {
    key: process.env.OPENAI_API_KEY,
    password: process.env.RESEARCH_PASSWORD,
  };
  delete process.env.OPENAI_API_KEY;
  delete process.env.RESEARCH_PASSWORD;
  try {
    assert.equal((await POST(request({}))).status, 401);
    assert.equal(
      (await POST(request({}, { origin: "https://untrusted.example" }))).status,
      403,
    );
    assert.equal((await GET()).status, 200);
  } finally {
    if (saved.key) process.env.OPENAI_API_KEY = saved.key;
    if (saved.password) process.env.RESEARCH_PASSWORD = saved.password;
  }
});
test("API enforces payload validation and oversized request rejection", async () => {
  const h = { "x-openai-key": "test-not-a-real-secret-key" };
  assert.equal((await POST(request({ text: "x" }, h))).status, 400);
  assert.equal(
    (await POST(request({}, { ...h, "content-length": "30000" }))).status,
    413,
  );
});
test("API records real-shaped provider response; never sends gold answer; mocks only in test", async () => {
  const original = globalThis.fetch;
  let sent: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        status: "completed",
        id: "test-response",
        model: "test-model-snapshot",
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  meaning: "Тестийн утга",
                  explanation: "Тестийн тайлбар",
                }),
              },
            ],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
      { status: 200 },
    );
  };
  try {
    const res = await POST(
      request(
        {
          text: "Гар хумхин суух.",
          context: "Туслалгүй сууна.",
          method: "context",
          model: "test-model",
          expected: "SECRET_GOLD",
        },
        { "x-openai-key": "test-not-a-real-secret-key" },
      ),
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.answer, "Тестийн утга");
    assert.equal(data.model, "test-model-snapshot");
    assert.equal(data.outputTokens, 20);
    assert.ok(!JSON.stringify(sent).includes("SECRET_GOLD"));
    assert.equal(sent?.store, false);
  } finally {
    globalThis.fetch = original;
  }
});
test("upstream authentication and quota errors are visible without exposing provider body", async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [401, 429]) {
      globalThis.fetch = async () =>
        new Response("provider-secret", { status });
      const res = await POST(
        request(
          {
            text: "Хэллэг",
            context: "Нөхцөл",
            method: "plain",
            model: "test-model",
          },
          { "x-openai-key": "test-not-a-real-secret-key" },
        ),
      );
      assert.equal(res.status, status);
      assert.ok(!(await res.text()).includes("provider-secret"));
    }
  } finally {
    globalThis.fetch = original;
  }
});
