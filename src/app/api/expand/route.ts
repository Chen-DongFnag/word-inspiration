import { NextRequest } from "next/server";
import type { ExpandRequest, ExpandResponse } from "@/types";

/**
 * POST /api/expand
 * 接收一个词汇，调用 AI 生成 6 个相关词汇用于灵感发散
 *
 * 缓存策略：相同词汇+上下文的请求缓存 5 分钟
 * 去重策略：去除重复词汇 + 去除已存在于图中的词汇
 */

const cache = new Map<string, { words: string[]; expireAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCacheKey(word: string, context?: string): string {
  return `${word}|${context || ""}`;
}

/** 从文本中提取词语：支持 JSON 数组、逗号分隔、顿号分隔等多种格式 */
function extractWords(text: string): string[] {
  // 尝试 JSON 数组
  const jsonMatch = text.match(/\[[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[0]);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch { /* ignore */ }
  }

  // 尝试从引号中提取：如 "词1"、"词2"
  const quoted = text.match(/[""]([^""]+)[""]/g);
  if (quoted && quoted.length >= 3) {
    return quoted.map((s) => s.replace(/[""]/g, "").trim()).filter((s) => s.length >= 2 && s.length <= 6);
  }

  // 尝试逗号/顿号分隔
  const parts = text.split(/[,，、\n]+/).map((s) => s.trim()).filter((s) => s.length >= 2 && s.length <= 6);
  if (parts.length >= 3) return parts.slice(0, 6);

  return [];
}

export async function POST(request: NextRequest): Promise<Response> {
  const { word, context, existingWords = [] }: ExpandRequest = await request.json();

  const cacheKey = getCacheKey(word, context);
  const cached = cache.get(cacheKey);
  if (cached && cached.expireAt > Date.now()) {
    return Response.json({ words: cached.words } satisfies ExpandResponse);
  }

  const apiKey = process.env.AI_API_KEY;
  const apiBase = process.env.AI_API_BASE_URL;
  const model = process.env.AI_MODEL || "qwen-turbo";

  if (!apiKey || apiKey === "your-api-key-here") {
    return Response.json(
      { error: "请先配置 AI API Key，请在 .env.local 中设置 AI_API_KEY" },
      { status: 400 }
    );
  }

  const avoidList = existingWords.length > 0
    ? `\n不要使用：${existingWords.slice(0, 10).join("、")}`
    : "";

  const contextHint = context
    ? `\n联想路径：${context}`
    : "";

  const userMessage = `"${word}"${contextHint}${avoidList}\n联想6个词，2-4字，不同维度，JSON数组`;

  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "词汇联想。输出JSON数组。" },
          { role: "user", content: userMessage },
        ],
        temperature: 0.9,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json(
        { error: `AI API 调用失败: ${response.status} ${errorText}` },
        { status: 502 }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    const reasoningContent = result.choices?.[0]?.message?.reasoning_content || "";
    const textToParse = content || reasoningContent;

    const words = extractWords(textToParse);
    if (words.length === 0) {
      return Response.json({ error: "AI 返回格式异常，请重试" }, { status: 500 });
    }

    // 去重
    const existingSet = new Set(existingWords.map((w) => w.toLowerCase()));
    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const w of words) {
      const lower = w.toLowerCase();
      if (lower === word.toLowerCase()) continue;
      if (existingSet.has(lower)) continue;
      if (seen.has(lower)) continue;
      seen.add(lower);
      deduped.push(w);
    }

    cache.set(cacheKey, { words: deduped, expireAt: Date.now() + CACHE_TTL });
    return Response.json({ words: deduped } satisfies ExpandResponse);
  } catch (err) {
    return Response.json(
      { error: `请求失败: ${err instanceof Error ? err.message : "未知错误"}` },
      { status: 500 }
    );
  }
}
