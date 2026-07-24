import type { ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";

type PageProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function Page({
  title,
  subtitle,
  action,
  children
}: PageProps) {
  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>

        {action && <div className="page-action">{action}</div>}
      </div>

      <div className="page-content">
        {children}
      </div>
    </section>
  );
}

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({
  children,
  className = ""
}: CardProps) {
  return (
    <div className={`card ${className}`.trim()}>
      {children}
    </div>
  );
}

type EmptyProps = {
  children?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
};

export function Empty({
  children,
  title = "Todavía no hay información",
  description = "Agrega el primer elemento para comenzar.",
  action
}: EmptyProps) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={28} />
      </div>

      {children || (
        <>
          <h3>{title}</h3>
          <p>{description}</p>
          {action && <div className="empty-action">{action}</div>}
        </>
      )}
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="demo-banner">
      <AlertCircle size={20} />

      <div>
        <strong>Modo demostración</strong>
        <span>
          Configura Supabase para activar cuentas y sincronización.
        </span>
      </div>
    </div>
  );
}
