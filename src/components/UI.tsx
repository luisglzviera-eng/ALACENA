import type { ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";

type PageProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function Page({ title, subtitle, action, children }: PageProps) {
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action && <div className="page-action">{action}</div>}
      </header>
      <div className="page-content">{children}</div>
    </section>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={27} />
      </span>
      <div>{children}</div>
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="demo-banner">
      <AlertCircle size={19} />
      <div>
        <strong>Modo demostración</strong>
        <span>Configura Supabase para activar cuentas y sincronización.</span>
      </div>
    </div>
  );
}
