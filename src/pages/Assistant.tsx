import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Camera, ChefHat, Mic, PackagePlus, Send, Sparkles, Utensils } from 'lucide-react';
import { Page } from '../components/UI';
import { useApp } from '../context/AppContext';
import { fileToBase64 } from '../lib/utils';

export default function Assistant() {
  const { pantry, recipes, preferences, weeks, leftovers, saveLeftover, deleteLeftover, generateSmartList } = useApp();
  const location = useLocation();
  const [result, setResult] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [left, setLeft] = useState('');
  const [question, setQuestion] = useState('');
  const file = useRef<HTMLInputElement>(null);

  async function ask(mode: string, image?: File, customPrompt?: string) {
    setLoading(true);
    try {
      let imageBase64;
      let mediaType;
      if (image) {
        imageBase64 = await fileToBase64(image);
        mediaType = image.type;
      }
      const response = await fetch('/.netlify/functions/home-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, customPrompt, pantry, recipes, preferences, leftovers, recentMeals: weeks.slice(0, 6), imageBase64, mediaType }),
      });
      const data = await response.json();
      setResult((data.suggestions || data.detected || []).map((item: any) => typeof item === 'string' ? item : item.name || item.idea));
    } catch {
      setResult(['Tostadas de pollo', 'Omelette de verduras', 'Arroz salteado con huevo']);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const prompt = (location.state as { prompt?: string } | null)?.prompt;
    if (!prompt) return;
    setQuestion(prompt);
    const normalized = prompt.toLowerCase();
    const mode = normalized.includes('lista') || normalized.includes('costco') ? 'shopping' : normalized.includes('vencer') ? 'expiring' : 'general';
    void ask(mode, undefined, prompt);
    window.history.replaceState({}, document.title);
  }, []);

  function voice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('El dictado no está disponible en este navegador.');
      return;
    }
    const recognition = new SR();
    recognition.lang = 'es-MX';
    recognition.onresult = (event: any) => setQuestion(event.results[0][0].transcript);
    recognition.start();
  }

  return (
    <Page title="Alacena IA" subtitle="Pregunta usando tu despensa, menú y hábitos de compra">
      <form className="assistant-command" onSubmit={(event) => { event.preventDefault(); if (question.trim()) void ask('general', undefined, question.trim()); }}>
        <Sparkles size={21} />
        <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="¿Qué quieres organizar o cocinar?" />
        <button type="button" className="icon-btn" onClick={voice}><Mic size={19} /></button>
        <button type="submit" className="primary icon"><Send size={18} /></button>
      </form>

      <div className="assistant-actions">
        <button className="feature-btn" onClick={() => ask('cook')}><ChefHat /><strong>¿Qué cocinar hoy?</strong><span>Usa despensa, dietas y recetas</span></button>
        <button className="feature-btn" onClick={() => ask('leftovers')}><Utensils /><strong>Aprovechar sobrantes</strong><span>Ideas para no desperdiciar</span></button>
        <button className="feature-btn" onClick={async () => alert(`Se agregaron ${await generateSmartList()} ingredientes faltantes.`)}><PackagePlus /><strong>Generar lista inteligente</strong><span>Menú menos lo que ya tienes</span></button>
        <button className="feature-btn" onClick={() => file.current?.click()}><Camera /><strong>Foto del refrigerador</strong><span>Detectar alimentos visibles</span></button>
        <input hidden ref={file} type="file" accept="image/*" capture="environment" onChange={(event) => event.target.files?.[0] && ask('fridge', event.target.files[0])} />
      </div>

      <div className="card">
        <h3>Registrar sobrante</h3>
        <div className="voice-row">
          <input value={left} onChange={(event) => setLeft(event.target.value)} placeholder="Ej. pollo asado, 2 porciones" />
          <button className="icon-btn" onClick={voice}><Mic /></button>
          <button className="primary small" onClick={() => { if (left) { saveLeftover({ name: left, quantity: '1', expires_on: null }); setLeft(''); } }}>Guardar</button>
        </div>
        {leftovers.map((item) => <div className="simple-row" key={item.id}><span>{item.name}</span><button className="ghost danger" onClick={() => deleteLeftover(item.id)}>Quitar</button></div>)}
      </div>

      {loading && <div className="loading"><Sparkles />Pensando…</div>}
      {result.length > 0 && <div className="card result-list"><h3>Sugerencias</h3>{result.map((item, index) => <div key={index}><Sparkles size={16} /><span>{item}</span></div>)}</div>}
    </Page>
  );
}
