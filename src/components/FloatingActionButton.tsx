import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  to: string;
};

export default function FloatingActionButton({ to }: Props) {
  return (
    <Link
      to={to}
      style={{
        position: "fixed",
        right: 28,
        bottom: 95,
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: "#2563EB",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 15px 35px rgba(37,99,235,.35)",
        textDecoration: "none",
        zIndex: 999,
        transition: ".25s"
      }}
    >
      <Plus size={30} />
    </Link>
  );
}
