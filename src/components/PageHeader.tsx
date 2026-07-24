import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  action
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 28,
        gap: 20,
        flexWrap: "wrap"
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 36,
            fontFamily: "DM Serif Display"
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <p
            style={{
              marginTop: 8,
              color: "#6B7280",
              fontSize: 16
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}
