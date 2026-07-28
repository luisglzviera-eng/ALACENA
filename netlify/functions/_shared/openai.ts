const API = 'https://api.openai.com/v1/responses';

export type AITask =
  | 'receipt_ocr'
  | 'recipe_suggestions'
  | 'fridge_analysis'
  | 'leftovers'
  | 'diet_analysis'
  | 'household_optimization';

type OpenAIContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

type OpenAIResponse = {
  id?: string;
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string; code?: string; type?: string };
};

type CallOptions = {
  task: AITask;
  maxOutputTokens?: number;
  forceTier?: 'fast' | 'advanced';
  timeoutMs?: number;
};

function extractText(data: OpenAIResponse): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;
  return (data.output || [])
    .flatMap(item => item.content || [])
    .map(item => item.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parseJSON(text: string): Record<string, unknown> {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(clean) as Record<string, unknown>;
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>;
    }
    return {
      suggestions: clean
        .split(/\n+/)
        .map(line => line.replace(/^[-*\d.)\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 8)
        .map(name => ({ name, why: '' })),
      answer: clean,
    };
  }
}

function selectModel(task: AITask, forceTier?: 'fast' | 'advanced') {
  const fastModel = process.env.OPENAI_MODEL_FAST || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const advancedModel = process.env.OPENAI_MODEL_ADVANCED || fastModel;

  if (forceTier === 'advanced') return { model: advancedModel, tier: 'advanced' as const };
  if (forceTier === 'fast') return { model: fastModel, tier: 'fast' as const };

  const advancedTasks: AITask[] = ['diet_analysis', 'household_optimization'];
  return advancedTasks.includes(task)
    ? { model: advancedModel, tier: 'advanced' as const }
    : { model: fastModel, tier: 'fast' as const };
}

async function postOpenAI(
  key: string,
  model: string,
  inputContent: Array<Record<string, unknown>>,
  maxOutputTokens: number,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: [{ role: 'user', content: inputContent }],
        max_output_tokens: maxOutputTokens,
        text: { format: { type: 'json_object' } },
      }),
    });

    const raw = await response.text();
    let data: OpenAIResponse;
    try {
      data = JSON.parse(raw) as OpenAIResponse;
    } catch {
      throw new Error(`OpenAI devolvió una respuesta ilegible (${response.status})`);
    }

    if (!response.ok) {
      const message = data.error?.message || `OpenAI respondió con estado ${response.status}`;
      throw new Error(message);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function callOpenAI(content: OpenAIContent[], options: CallOptions) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Falta OPENAI_API_KEY en Netlify');

  const { model, tier } = selectModel(options.task, options.forceTier);
  const inputContent = content.map(item =>
    item.type === 'text'
      ? { type: 'input_text', text: item.text }
      : {
          type: 'input_image',
          image_url: `data:${item.source.media_type};base64,${item.source.data}`,
          detail: 'auto',
        },
  );

  const startedAt = Date.now();
  console.log('[Alacena IA] Solicitud iniciada', { task: options.task, model, tier });

  try {
    const data = await postOpenAI(
      key,
      model,
      inputContent,
      options.maxOutputTokens || 1500,
      options.timeoutMs || 25000,
    );
    const text = extractText(data);
    if (!text) throw new Error('OpenAI no devolvió contenido');

    console.log('[Alacena IA] Solicitud completada', {
      task: options.task,
      model,
      responseId: data.id,
      durationMs: Date.now() - startedAt,
    });

    return {
      ...parseJSON(text),
      _ai: { model, tier, task: options.task, responseId: data.id },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    const normalized = error instanceof Error && error.name === 'AbortError'
      ? 'La IA tardó demasiado en responder. Intenta nuevamente.'
      : message;
    console.error('[Alacena IA] Error', {
      task: options.task,
      model,
      durationMs: Date.now() - startedAt,
      message: normalized,
    });
    throw new Error(normalized);
  }
}

export function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}
