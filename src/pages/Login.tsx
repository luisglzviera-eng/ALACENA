import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShoppingBasket } from 'lucide-react';
import { isConfigured, supabase } from '../lib/supabase';
export default function Login(){const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(false);const navigate=useNavigate();
 if(!isConfigured)return <Navigate to="/lista" replace/>;
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setLoading(true);setError('');const {error}=await supabase.auth.signInWithPassword({email,password});setLoading(false);if(error)setError(error.message);else navigate('/lista')};
 return <div className="login-page"><form className="login-card" onSubmit={submit}><span className="login-logo"><ShoppingBasket size={42}/></span><h1>Alacena</h1><p>Todo lo de nuestra casa, en un solo lugar.</p><label>Correo<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<div className="error">{error}</div>}<button className="primary" disabled={loading}>{loading?'Entrando…':'Entrar'}</button></form></div>}
