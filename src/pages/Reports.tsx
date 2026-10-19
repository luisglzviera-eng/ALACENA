import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { money } from '../lib/utils';
import { monthKey, monthReport } from '../lib/shopping';
import { Empty, Page } from '../components/UI';

const COLORS = ['#22392C', '#C99A2E', '#6f8f7a', '#b3472f', '#8a6d3b', '#9db3a5'];

export default function Reports() {
  const { purchases, preferences } = useApp();
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = monthKey(d);
      return { key, label: d.toLocaleDateString('es-MX', { month: 'short' }), total: monthReport(purchases, key).total };
    });
  }, [purchases]);
  const [selected, setSelected] = useState(monthKey());
  const report = useMemo(() => monthReport(purchases, selected), [purchases, selected]);
  const index = months.findIndex(m => m.key === selected);
  const previous = index > 0 ? months[index - 1].total : 0;
  const diff = previous > 0 ? ((report.total - previous) / previous) * 100 : null;
  const budget = Number(preferences.monthly_budget) || 0;
  const monthName = new Date(`${selected}-01T12:00:00`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

  return (
    <Page title="Reportes" subtitle="Así se mueve el gasto de la casa">
      <div className="stats">
        <div className="stat"><small>Gasto de {monthName}</small><strong>{money(report.total)}</strong></div>
        <div className="stat"><small>Contra mes anterior</small><strong>{diff == null ? 'Sin comparación' : `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`}</strong></div>
        <div className="stat"><small>Presupuesto</small><strong>{budget > 0 ? (report.total <= budget ? `Te quedan ${money(budget - report.total)}` : `Te pasaste ${money(report.total - budget)}`) : 'Sin definir'}</strong></div>
        <div className="stat"><small>Tickets · promedio</small><strong>{report.count} · {money(report.average)}</strong></div>
      </div>

      <div className="card chart">
        <h3>Últimos 6 meses</h3>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={months} onClick={s => { const m = months.find(x => x.label === s?.activeLabel); if (m) setSelected(m.key); }}>
            <XAxis dataKey="label" /><YAxis /><Tooltip formatter={v => money(Number(v))} />
            <Bar dataKey="total" radius={[8, 8, 0, 0]}>{months.map(m => <Cell key={m.key} fill={m.key === selected ? '#22392C' : '#C99A2E'} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
        <small className="muted">Toca una barra para ver ese mes.</small>
      </div>

      {report.count === 0 ? <Empty>No hay tickets en este mes. Guarda uno en la pestaña Tickets.</Empty> : (
        <>
          <div className="card chart">
            <h3>Por tienda</h3>
            {report.byStore.map(s => <p className="category-total" key={s.name}><span>{s.name}</span><b>{money(s.value)}</b></p>)}
          </div>
          <div className="card chart">
            <h3>Gasto por categoría</h3>
            {report.byCategory.length ? (
              <>
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart><Pie data={report.byCategory} dataKey="value" nameKey="name" outerRadius={85}>{report.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={v => money(Number(v))} /></PieChart>
                </ResponsiveContainer>
                {report.byCategory.map(c => <p className="category-total" key={c.name}><span>{c.name}</span><b>{money(c.value)}</b></p>)}
              </>
            ) : <p className="muted">Los tickets de este mes no tienen productos.</p>}
          </div>
          {report.topItems.length > 0 && (
            <div className="card chart">
              <h3>Donde más se va</h3>
              {report.topItems.map(t => <p className="category-total" key={t.name}><span>{t.name}{t.times > 1 ? ` · ${t.times} veces` : ''}</span><b>{money(t.value)}</b></p>)}
            </div>
          )}
        </>
      )}
    </Page>
  );
}
