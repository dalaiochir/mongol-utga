import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
import { z } from "zod";
import { buildPrompt, systemPrompt, promptVersion } from "@/lib/domain";
export const maxDuration = 60;
export const runtime = "nodejs";
const schema = z.object({
  text: z.string().trim().min(3).max(1000),
  context: z.string().trim().min(3).max(2000),
  method: z.enum(["plain", "context", "examples"]),
  model: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._:-]{1,100}$/),
});
const outputSchema = z.object({
  meaning: z.string().min(1).max(12000),
  explanation: z.string().min(1).max(16000),
});
function response(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
function equal(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
export async function POST(req: NextRequest) {
  if (
    req.headers.get("origin") &&
    req.headers.get("origin") !== new URL(req.url).origin
  )
    return response("Хүсэлтийн эх сурвалж тохирохгүй байна.", 403);
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > 20000) return response("Оролтын хэмжээ хэтэрсэн.", 413);
  const ownKey = req.headers.get("x-openai-key");
  const password = req.headers.get("x-research-password") ?? "";
  const shared = !!(
    process.env.OPENAI_API_KEY && process.env.RESEARCH_PASSWORD
  );
  if (!ownKey && (!shared || !equal(password, process.env.RESEARCH_PASSWORD!)))
    return response(
      shared
        ? "Судалгааны нууц үг буруу байна."
        : "AI холболт хэрэгтэй. Тохиргоонд өөрийн OpenAI API түлхүүрийг оруулна уу.",
      401,
    );
  const apiKey = ownKey || process.env.OPENAI_API_KEY!;
  if (apiKey.length < 20 || apiKey.length > 512 || /[\r\n]/.test(apiKey))
    return response("API түлхүүрийн хэлбэр буруу байна.", 400);
  try {
    const raw = await req.text();
    if (raw.length > 20000) return response("Оролтын хэмжээ хэтэрсэн.", 413);
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return response("Хэллэг, нөхцөл, загварын утгыг шалгана уу.", 400);
    const data = parsed.data;
    const models = (process.env.OPENAI_MODELS || "gpt-4.1-mini,gpt-4.1")
      .split(",")
      .map((v) => v.trim());
    if (!ownKey && !models.includes(data.model))
      return response("Энэ загварыг хамтын холболтоор ашиглах эрхгүй.", 400);
    const prompt = buildPrompt(data, data.method);
    const started = Date.now();
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: data.model,
        store: false,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        max_output_tokens: 1500,
        text: {
          format: {
            type: "json_schema",
            name: "mongolian_interpretation",
            strict: true,
            schema: {
              type: "object",
              properties: {
                meaning: { type: "string" },
                explanation: { type: "string" },
              },
              required: ["meaning", "explanation"],
              additionalProperties: false,
            },
          },
        },
      }),
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(50000)]),
    });
    if (!upstream.ok) {
      if (upstream.status === 401)
        return response("OpenAI API түлхүүр хүчингүй байна.", 401);
      if (upstream.status === 429)
        return response(
          "OpenAI-ийн квот эсвэл хүсэлтийн хязгаарт хүрлээ. Төлбөр, лимитээ шалгаад дахин оролдоно уу.",
          429,
        );
      if (upstream.status === 400 || upstream.status === 404)
        return response(
          "Загвар олдсонгүй, эсвэл энэ загвар structured output дэмжихгүй байна. Загварын нэр болон эрхээ шалгана уу.",
          400,
        );
      return response(
        "AI үйлчилгээ түр алдаатай байна. Дараа дахин оролдоно уу.",
        502,
      );
    }
    const result = await upstream.json();
    if (result.status !== "completed")
      return response("Хариу бүрэн үүссэнгүй. Дахин оролдоно уу.", 502);
    const output = (result.output ?? [])
      .flatMap(
        (v: { content?: { type: string; text?: string }[] }) => v.content ?? [],
      )
      .filter((v: { type: string }) => v.type === "output_text")
      .map((v: { text: string }) => v.text)
      .join("");
    const answer = outputSchema.safeParse(JSON.parse(output));
    if (!answer.success)
      return response("AI хариу шаардлагатай бүтэцтэй ирсэнгүй.", 502);
    return NextResponse.json(
      {
        answer: answer.data.meaning,
        explanation: answer.data.explanation,
        prompt: `SYSTEM:\n${systemPrompt}\n\nUSER:\n${prompt}`,
        promptVersion,
        model: result.model ?? data.model,
        responseId: result.id,
        createdAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        inputTokens: result.usage?.input_tokens ?? 0,
        outputTokens: result.usage?.output_tokens ?? 0,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof SyntaxError)
      return response("JSON өгөгдөл эсвэл AI хариу буруу бүтэцтэй байна.", 400);
    return response(
      "Холболт тасарсан эсвэл хариулах хугацаа хэтэрсэн. Хадгалсан үр дүн хэвээр байна.",
      504,
    );
  }
}
export async function GET() {
  return NextResponse.json(
    {
      sharedConfigured: !!(
        process.env.OPENAI_API_KEY && process.env.RESEARCH_PASSWORD
      ),
      models: (process.env.OPENAI_MODELS || "gpt-4.1-mini,gpt-4.1")
        .split(",")
        .map((v) => v.trim()),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
