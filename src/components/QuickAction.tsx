import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type Props = {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  to: string;
};

export default function QuickAction({
  title,
  subtitle,
  icon,
  to
}: Props) {
  return (
    <Link
      to={to}
      style={{
        textDecoration: "none",
        color: "inherit"
      }}
    >
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          transition: ".25s",
          cursor: "pointer",
          minHeight: 90
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: "#EEF4FF",
            color: "#2563EB",
            display: "grid",
            placeItems: "center",
            flexShrink: 0
          }}
        >
          {icon}
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontWeight: 700,
              marginBottom: 4
            }}
          >
            {title}
          </div>

          {subtitle && (
            <div
              style={{
                color: "#6B7280",
                fontSize: 14
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
