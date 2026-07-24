import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ShoppingBasket, Sparkles } from 'lucide-react';
import { isConfigured, supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (!isConfigured) return <Navigate to="/inicio" replace />;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) setError(authError.message);
    else navigate('/inicio');
  }

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="login-brand"><span><ShoppingBasket size={24} /></span><b>Alacena</b></div>
        <div className="login-copy">
          <span className="hero-kicker"><Sparkles size={15} /> TU COCINA, MÁS INTELIGENTE</span>
          <h1>Organiza tu hogar con la sencillez que esperas de Apple.</h1>
          <p>Compras, despensa, recetas, tickets y menú semanal en una experiencia privada, elegante y compartida.</p>
          <ul>
            <li><Check /> Sincronización en tiempo real</li>
            <li><Check /> IA para compras y recetas</li>
            <li><Check /> Control de gasto y caducidades</li>
          </ul>
        </div>
        <img src="/images/kitchen-hero.svg" alt="Alacena organizada" />
      </section>

      <section className="login-form-wrap">
        <form className="login-card" onSubmit={submit}>
          <span className="login-logo"><ShoppingBasket size={31} /></span>
          <div><span className="eyebrow">BIENVENIDO</span><h2>Entra a tu hogar</h2><p>Continúa donde lo dejaste.</p></div>
          <label>Correo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" required /></label>
          <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required /></label>
          {error && <div className="error">{error}</div>}
          <button className="primary login-submit" disabled={loading}>{loading ? 'Entrando…' : <>Entrar <ArrowRight size={18} /></>}</button>
          <small>Tu información permanece privada y segura.</small>
        </form>
      </section>
    </div>
  );
}
