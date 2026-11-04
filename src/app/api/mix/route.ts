import { NextRequest, NextResponse } from "next/server";
import type { SetlistItem } from "@/lib/types";
import { buildMixPlan } from "@/lib/engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/mix
 * Body: { items: SetlistItem[], description, targetGenre, creativity }
 * Uses an LLM when OPENAI_API_KEY is set (it refines transitions + title),
 * otherwise the deterministic engine builds the plan so the flow always works.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "No tracks provided." }, { status: 400 });
  }
  const items: SetlistItem[] = body.items;
  const description: string = body.description ?? "";
  const targetGenre: string = body.targetGenre ?? "House";
  const creativity: number = Math.min(1, Math.max(0, Number(body.creativity) || 0.5));

  const base = buildMixPlan(items, { description, targetGenre, creativity });

  const key = process.env.OPENAI_API_KEY;
  if (key) {
    try {
      const prompt = [
        "You are a working DJ and mashup producer.",
        "Given a setlist and a creative brief, return ONLY valid JSON with exactly these keys:",
        "{",
        '  "title": string — a catchy MASHUP NAME the producer would give the blend (max 6 words, creative, never a copy of the brief),',
        '  "description": string — one vivid sentence describing the final vibe,',
        '  "notes": string[3] — three SHORT, SPECIFIC DJ notes about transitions, energy curve, or genre fusion (no generic filler)',
        "}",
        "Do NOT echo the brief as the title. Invent something with flair.",
        "",
        "Setlist:",
        JSON.stringify(
          items.map((i) => ({
            title: i.track.title,
            artist: i.track.artist,
            bpm: i.track.bpm,
            energy: i.track.energy,
            genres: i.track.genres,
          }))
        ),
        `Brief: ${description || "(none given)"}`,
        `Target genre: ${targetGenre}`,
        `Creativity (0-1, higher = bolder): ${creativity}`,
      ].join("\n");

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a JSON-only API. Return a single JSON object and nothing else — no prose, no markdown fences.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.8,
          response_format: { type: "json_object" },
        }),
      });
      const j = await r.json();
      const content = j.choices?.[0]?.message?.content;
      if (!content) {
        // OpenAI returned an error payload (e.g. 429 quota) — fall back honestly.
        throw new Error("llm-no-content:" + (j.error?.message ?? r.status));
      }
      const parsed = JSON.parse(content);
      return NextResponse.json({
        plan: {
          ...base,
          title: parsed.title ?? base.title,
          description: parsed.description ?? base.description,
          notes: parsed.notes ?? base.notes,
          generatedBy: "llm" as const,
        },
      });
    } catch (e: any) {
      console.log("[mix] LLM call failed:", e?.message ?? String(e));
      // fall through to heuristic
    }
  }

  return NextResponse.json({ plan: base });
}
