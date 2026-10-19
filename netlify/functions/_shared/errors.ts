/** Convierte errores técnicos de OpenAI en mensajes claros y nunca deja pasar fragmentos de la llave. */
export function friendlyAIError(raw: string): string {
  const message = raw.replace(/sk-[A-Za-z0-9_-]+/g, '[llave oculta]');
  if (/api key|invalid_api_key|incorrect api key|unauthorized|401/i.test(message)) {
    return 'OpenAI rechazó la llave. Revisa que OPENAI_API_KEY en Netlify sea correcta y vuelve a publicar.';
  }
  if (/quota|billing|insufficient_quota|rate limit|429/i.test(message)) {
    return 'Tu cuenta de OpenAI no tiene saldo disponible o llegó a su límite. Revisa Billing en platform.openai.com.';
  }
  if (/model.*(not found|does not exist|access)|does not have access to model/i.test(message)) {
    return 'El modelo de OpenAI configurado no está disponible para tu cuenta. Revisa OPENAI_MODEL_FAST en Netlify.';
  }
  return message;
}
