import type { ReactNode } from 'react';
import { AlertCircle, PackageOpen } from 'lucide-react';

export function Page({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">ALACENA</span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action && <div className="page-action">{action}</div>}
      </header>
      {children}
    </section>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><PackageOpen size={24} /></span>
      <strong>Todo listo por ahora</strong>
      <p>{children}</p>
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="demo-banner">
      <AlertCircle size={18} />
      <span>Modo demostración. Configura Supabase para sincronizar tu hogar.</span>
    </div>
  );
}
