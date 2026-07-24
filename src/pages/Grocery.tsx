import GroceryForm from "../components/grocery/GroceryForm";
import GroceryItem from "../components/grocery/GroceryItem";
import GroceryToolbar from "../components/grocery/GroceryToolbar";
import { DemoBanner, Empty, Page } from "../components/UI";
import { useApp } from "../context/AppContext";
import { CATEGORIES } from "../types";

export default function Grocery() {
  const {
    configured,
    groceries,
    addGrocery,
    toggleGrocery,
    deleteGrocery,
    clearChecked,
    generateSmartList,
    runRecurring,
  } = useApp();

  const pending = groceries.filter((item) => !item.checked).length;
  const checked = groceries.length - pending;

  return (
    <Page
      title="Lista del súper"
      subtitle={`${pending} ${pending === 1 ? "producto pendiente" : "productos pendientes"}`}
      action={
        checked > 0 ? (
          <button className="ghost danger" type="button" onClick={clearChecked}>
            Quitar marcados
          </button>
        ) : undefined
      }
    >
      {!configured && <DemoBanner />}
      <GroceryForm onAdd={addGrocery} />
      <GroceryToolbar
        onGenerateSmartList={generateSmartList}
        onRunRecurring={runRecurring}
      />

      {groceries.length === 0 ? (
        <Empty>Tu lista está vacía. Agrega el primer producto.</Empty>
      ) : (
        <div className="grocery-groups">
          {CATEGORIES.map((category) => {
            const items = groceries.filter((item) => item.category === category);
            if (!items.length) return null;

            return (
              <section className="category-block" key={category}>
                <header>
                  <h3>{category}</h3>
                  <span>{items.length}</span>
                </header>
                <div className="category-items">
                  {items.map((item) => (
                    <GroceryItem
                      key={item.id}
                      item={item}
                      onToggle={toggleGrocery}
                      onDelete={deleteGrocery}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Page>
  );
}
