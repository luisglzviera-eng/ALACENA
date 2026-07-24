import { Trash2 } from "lucide-react";
import type { GroceryItem as GroceryItemType } from "../../types";

type Props = {
  item: GroceryItemType;
  onToggle: (id: string, checked: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export default function GroceryItem({ item, onToggle, onDelete }: Props) {
  return (
    <div className={`grocery-item ${item.checked ? "checked" : ""}`}>
      <label>
        <input
          type="checkbox"
          checked={item.checked}
          onChange={(event) => onToggle(item.id, event.target.checked)}
        />
        <span>
          <strong>{item.text}</strong>
          <small>
            {item.quantity || 1} {item.unit || "pza"}
          </small>
        </span>
      </label>
      <button
        className="icon-btn danger"
        type="button"
        onClick={() => onDelete(item.id)}
        aria-label={`Eliminar ${item.text}`}
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}
