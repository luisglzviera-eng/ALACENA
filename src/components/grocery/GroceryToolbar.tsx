import { RefreshCw, WandSparkles } from "lucide-react";

type Props = {
  onGenerateSmartList: () => Promise<number>;
  onRunRecurring: () => Promise<number>;
};

export default function GroceryToolbar({
  onGenerateSmartList,
  onRunRecurring,
}: Props) {
  return (
    <div className="smart-tools">
      <button
        className="secondary"
        type="button"
        onClick={async () =>
          alert(
            `Se agregaron ${await onGenerateSmartList()} faltantes del menú y productos bajos.`
          )
        }
      >
        <WandSparkles size={17} />
        Lista inteligente
      </button>
      <button
        className="secondary"
        type="button"
        onClick={async () =>
          alert(`Se agregaron ${await onRunRecurring()} compras recurrentes.`)
        }
      >
        <RefreshCw size={17} />
        Compras habituales
      </button>
    </div>
  );
}
