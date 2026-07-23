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
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

type CallOptions = {
  task: AITask;
  maxOutputTokens?: number;
  forceTier?: 'fast' | 'advanced';
};

function extractText(data: OpenAIResponse): string {
  if (data.output_text) return data.output_text;
  return (data.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text' || typeof item.text === 'string')
    .map(item => item.text || '')
    .join('');
}

function parseJSON(text: string) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error('OpenAI devolvió una respuesta que no es JSON válido');
  }
}

function selectModel(task: AITask, forceTier?: 'fast' | 'advanced') {
  const fastModel = process.env.OPENAI_MODEL_FAST || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const advancedModel = process.env.OPENAI_MODEL_ADVANCED || 'gpt-5';

  if (forceTier === 'advanced') return { model: advancedModel, tier: 'advanced' as const };
  if (forceTier === 'fast') return { model: fastModel, tier: 'fast' as const };

  const advancedTasks: AITask[] = ['diet_analysis', 'household_optimization'];
  return advancedTasks.includes(task)
    ? { model: advancedModel, tier: 'advanced' as const }
    : { model: fastModel, tier: 'fast' as const };
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
          detail: 'auto'
        }
  );

  const response = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      input: [{ role: 'user', content: inputContent }],
      max_output_tokens: options.maxOutputTokens || 1500,
      text: { format: { type: 'json_object' } }
    })
  });

  const data = (await response.json()) as OpenAIResponse;
  if (!response.ok) throw new Error(data.error?.message || `Error de OpenAI usando ${model}`);

  return {
    ...parseJSON(extractText(data)),
    _ai: { model, tier, task: options.task }
  };
}

export function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}
