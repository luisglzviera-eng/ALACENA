import { useState } from "react";
import type { FormEvent } from "react";
import { Mic, Plus } from "lucide-react";

import { CATEGORIES, type Category } from "../../types";

type Props = {
  onAdd: (
    text: string,
    category: Category,
    quantity?: number,
    unit?: string,
    source?: string
  ) => Promise<void>;
};

export default function GroceryForm({ onAdd }: Props) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<Category>("Frutas y verduras");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("pza");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const product = text.trim();
    if (!product) return;
    await onAdd(product, category, quantity, unit);
    setText("");
  }

  function useVoice() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("El dictado no está disponible en este navegador.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-MX";
    recognition.onresult = async (event: any) => {
      const phrase = event.results[0][0].transcript;
      const products = phrase
        .split(/,| y /)
        .map((item: string) => item.trim())
        .filter(Boolean);

      for (const product of products) {
        await onAdd(product, category, 1, "pza", "voice");
      }
    };
    recognition.start();
  }

  return (
    <form className="grocery-form card" onSubmit={submit}>
      <div className="grocery-form-main">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="¿Qué hace falta en casa?"
          autoComplete="off"
        />
        <button className="icon-btn voice-button" type="button" onClick={useVoice}>
          <Mic size={19} />
        </button>
        <button className="primary icon" type="submit">
          <Plus size={20} />
        </button>
      </div>
      <div className="grocery-form-details">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as Category)}
        >
          {CATEGORIES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <input
          className="qty"
          type="number"
          min="0.01"
          step="0.01"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
        />
        <input
          className="unit"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          placeholder="Unidad"
        />
      </div>
    </form>
  );
}
