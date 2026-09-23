import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp, useTopic } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { money } from '../lib/format.js';
import { Card, Empty, Field, Modal, Pill, Stat } from '../lib/ui.jsx';

/**
 * The store room. Two problems it solves:
 *   1. nobody knows what is left, so the kitchen runs out mid-service;
 *   2. nobody knows what a plate costs, so prices are guesswork.
 * Recipes link the two: finishing a dish takes its ingredients off the shelf.
 */
export default function Inventory() {
  const { toast } = useApp();
  const [data, setData] = useState({ items: [], requests: [] });
  const [busy, setBusy] = useState(true);
  const [moving, setMoving] = useState(null); // add / take out
  const [editing, setEditing] = useState(null);
  const [recipeFor, setRecipeFor] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await api.get('/admin/inventory'));
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useTopic('inventory', load);

  const items = useMemo(() => {
    if (filter === 'low') return data.items.filter((item) => item.low || item.runs_out_soon);
    if (filter === 'usage') return [...data.items].filter((item) => item.used_7d).sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999));
    return data.items;
  }, [data.items, filter]);

  const low = data.items.filter((item) => item.low);
  const urgent = data.items.filter((item) => item.runs_out_soon);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Store room · መጋዘን</div>
          <h1>Inventory &amp; recipes</h1>
          <p className="page-desc">
            Stock moves by itself: every dish the kitchen finishes takes its ingredients off the shelf through the recipe.
            You only record deliveries, wastage and purchases.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={load}><Icon name="rotate-ccw" size={14} /> Refresh</button>
          <button className="btn btn-primary" onClick={() => setEditing({ name: '', unit: 'kg', stock: 0, min_stock: 0, cost: 0 })}>
            <Icon name="plus" size={15} /> New item
          </button>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <Stat label="Items tracked" value={data.items.length} icon="box" foot="Across the kitchen and store" />
        <Stat label="Below the minimum" value={low.length} icon="alert" alert={low.length > 0} foot={low.slice(0, 3).map((i) => i.name).join(', ') || 'All good'} />
        <Stat label="Runs out within 3 days" value={urgent.length} icon="trending-up" alert={urgent.length > 0} foot="At this week's pace of use" />
      </div>

      {data.requests?.length ? (
        <Card
          title="Purchase requests waiting"
          subtitle="Raised from a low item — tick them off when the delivery arrives"
          noBody
        >
          <table>
            <thead>
              <tr><th>Item</th><th>Quantity</th><th>Note</th><th>Asked by</th><th /></tr>
            </thead>
            <tbody>
              {data.requests.map((request) => (
                <tr key={request.id}>
                  <td><strong>{request.name}</strong></td>
                  <td>{request.qty} {request.unit}</td>
                  <td className="small muted">{request.note || '—'}</td>
                  <td className="small muted">{request.created_by}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-sm"
                      onClick={async () => {
                        try {
                          await api.post(`/admin/inventory/purchase-requests/${request.id}/close`);
                          toast('Delivery recorded. Add the quantity to the item when it arrives.');
                          load();
                        } catch (error) {
                          toast(error.message, 'error');
                        }
                      }}
                    >
                      <Icon name="check" size={13} /> Received
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <div className="row" style={{ marginBottom: 14 }}>
        <div className="seg">
          {[['all', 'Everything'], ['low', 'Needs buying'], ['usage', 'Used fastest']].map(([key, label]) => (
            <button key={key} className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>
      </div>

      {busy && !data.items.length ? (
        <Card title="Loading the store room…" noBody><div style={{ padding: 18 }} className="muted small">Reading stock…</div></Card>
      ) : items.length === 0 ? (
        <Empty title="Nothing in the store yet" hint="Add the things the kitchen buys — flour, beef, injera, water." icon="box" />
      ) : (
        <Card title="Stock" subtitle={`${items.length} item(s) · ${filter === 'usage' ? 'sorted by how soon they run out' : 'use a move to record deliveries and wastage'}`} noBody>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>In stock</th>
                <th>Minimum</th>
                <th>Used (7 days)</th>
                <th>Lasts</th>
                <th>Unit cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={item.low ? { background: '#fff7f5' } : undefined}>
                  <td>
                    <strong>{item.name}</strong>
                    {item.name_am ? <div className="tiny muted">{item.name_am}</div> : null}
                  </td>
                  <td>
                    <strong>{item.stock} {item.unit}</strong>
                    {item.low ? <div className="tiny" style={{ color: '#b4453a' }}>below minimum</div> : null}
                  </td>
                  <td className="small muted">{item.min_stock} {item.unit}</td>
                  <td className="small">{item.used_7d ? `${Math.round(item.used_7d * 100) / 100} ${item.unit}` : '—'}</td>
                  <td className="small">
                    {item.days_left === null ? <span className="muted">—</span> : (
                      <Pill status={item.runs_out_soon ? 'reserved' : 'open'}>
                        {item.days_left === 0 ? 'today' : `${item.days_left} day(s)`}
                      </Pill>
                    )}
                  </td>
                  <td className="small muted">{item.cost ? money(item.cost) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm" onClick={() => setMoving({ item, kind: 'in' })}>
                        <Icon name="plus" size={13} /> In
                      </button>
                      <button className="btn btn-sm" onClick={() => setMoving({ item, kind: 'out' })}>
                        <Icon name="minus" size={13} /> Out
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditing(item)} title="Edit item">
                        <Icon name="pencil" size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <RecipeButton onOpen={setRecipeFor} />

      {moving ? <MoveModal {...moving} onClose={() => setMoving(null)} onDone={() => { setMoving(null); load(); }} /> : null}
      {editing ? <ItemModal item={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} /> : null}
      {recipeFor !== null ? <RecipeModal menuItemId={recipeFor} onClose={() => setRecipeFor(null)} /> : null}
    </>
  );
}

/** Pick a dish and set what one plate takes off the shelf. */
function RecipeButton({ onOpen }) {
  const { menu } = useApp();
  const [open, setOpen] = useState(false);
  const items = menu?.items || [];

  return (
    <>
      <Card
        title="Recipe cost"
        subtitle="What a plate costs the hotel — the recipe also drives stock automatically"
      >
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {items.slice(0, 8).map((item) => (
            <button key={item.id} className="chip" onClick={() => onOpen(item.id)}>
              <Icon name="utensils" size={12} /> {item.name}
            </button>
          ))}
          <button className="chip" onClick={() => setOpen(true)}>More dishes…</button>
        </div>
      </Card>
      {open ? (
        <Modal title="Choose a dish" subtitle="Set what one plate takes off the shelf" onClose={() => setOpen(false)} footer={<button className="btn" onClick={() => setOpen(false)}>Close</button>}>
          <div className="request-grid">
            {items.map((item) => (
              <button key={item.id} className="request-tile" onClick={() => { setOpen(false); onOpen(item.id); }}>
                <strong>{item.name}</strong>
                <span>{money(item.price)}</span>
              </button>
            ))}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function MoveModal({ item, kind, onClose, onDone }) {
  const { toast } = useApp();
  const [qty, setQty] = useState('');
  const [note, setNote] = useState(kind === 'in' ? 'Delivery' : 'Wastage');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const result = await api.post(`/admin/inventory/${item.id}/move`, {
        qty: kind === 'in' ? Math.abs(Number(qty)) : -Math.abs(Number(qty)),
        kind,
        note,
      });
      toast(`${item.name}: now ${result.stock} ${item.unit}.`);
      onDone?.();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`${kind === 'in' ? 'Add to' : 'Take out of'} ${item.name}`}
      subtitle={`In stock now: ${item.stock} ${item.unit}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!Number(qty) || busy} onClick={submit}>
            <Icon name={kind === 'in' ? 'plus' : 'minus'} size={14} /> Save the move
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={`Quantity (${item.unit})`} required>
          <input type="number" min="0" step="0.01" value={qty} onChange={(event) => setQty(event.target.value)} autoFocus />
        </Field>
        <Field label="Reason">
          <select value={note} onChange={(event) => setNote(event.target.value)}>
            {(kind === 'in'
              ? ['Delivery', 'Returned from kitchen', 'Correction']
              : ['Wastage', 'Spoiled', 'Staff meal', 'Correction']).map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function ItemModal({ item, onClose, onDone }) {
  const { toast } = useApp();
  const isNew = !item.id;
  const [form, setForm] = useState({
    name: item.name || '', name_am: item.name_am || '', unit: item.unit || 'kg',
    stock: item.stock ?? 0, min_stock: item.min_stock ?? 0, cost: item.cost ?? 0, supplier: item.supplier || '',
  });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async () => {
    try {
      if (isNew) await api.post('/admin/inventory', form);
      else await api.patch(`/admin/inventory/${item.id}`, form);
      toast(isNew ? 'Item added to the store room.' : 'Item updated.');
      onDone?.();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  return (
    <Modal
      title={isNew ? 'New stock item' : `Edit ${item.name}`}
      subtitle="The minimum is what triggers the “needs buying” warning"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!form.name} onClick={submit}><Icon name="check" size={14} /> Save</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Name" required><input value={form.name} onChange={set('name')} autoFocus /></Field>
        <Field label="Name in Amharic"><input value={form.name_am} onChange={set('name_am')} placeholder="optional" /></Field>
        <Field label="Unit" hint="kg, L, pcs, rolls…"><input value={form.unit} onChange={set('unit')} /></Field>
        {isNew ? <Field label="Opening stock"><input type="number" value={form.stock} onChange={set('stock')} /></Field> : null}
        <Field label="Minimum stock"><input type="number" value={form.min_stock} onChange={set('min_stock')} /></Field>
        <Field label="Unit cost (birr)"><input type="number" value={form.cost} onChange={set('cost')} /></Field>
        <Field label="Supplier"><input value={form.supplier} onChange={set('supplier')} placeholder="who we buy it from" /></Field>
      </div>
    </Modal>
  );
}

function RecipeModal({ menuItemId, onClose }) {
  const { toast } = useApp();
  const [data, setData] = useState(null);
  const [lines, setLines] = useState([]);
  const [addId, setAddId] = useState('');

  useEffect(() => {
    api.get(`/admin/menu/${menuItemId}/recipe`).then((result) => {
      setData(result);
      setLines(result.lines.map((line) => ({ inventory_item_id: line.inventory_item_id, qty: line.qty })));
    }).catch((error) => toast(error.message, 'error'));
  }, [menuItemId, toast]);

  if (!data) {
    return <Modal title="Recipe" onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}><p className="muted small">Loading…</p></Modal>;
  }

  const unitOf = (id) => data.items.find((item) => item.id === id)?.unit || '';
  const nameOf = (id) => data.items.find((item) => item.id === id)?.name || id;
  const costOf = (id) => data.items.find((item) => item.id === id)?.cost || 0;
  const plateCost = lines.reduce((sum, line) => sum + costOf(line.inventory_item_id) * Number(line.qty || 0), 0);
  const margin = data.menuItem.price ? Math.round(((data.menuItem.price - plateCost) / data.menuItem.price) * 100) : 0;

  return (
    <Modal
      title={`${data.menuItem.name} · recipe`}
      subtitle="One plate, and what it takes off the shelf"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                await api.post(`/admin/menu/${menuItemId}/recipe`, { lines });
                toast('Recipe saved — stock now follows every order.');
                onClose?.();
              } catch (error) {
                toast(error.message, 'error');
              }
            }}
          >
            <Icon name="check" size={14} /> Save recipe
          </button>
        </>
      }
    >
      <div className="grid grid-3" style={{ marginBottom: 14 }}>
        <Stat label="Plate cost" value={money(Math.round(plateCost))} icon="box" foot="Ingredients only" />
        <Stat label="Selling price" value={money(data.menuItem.price)} icon="banknote" foot="On the menu" />
        <Stat label="Margin" value={`${margin}%`} icon="trending-up" alert={margin < 40} foot={margin < 40 ? 'Thin — check the price' : 'Healthy'} />
      </div>

      <table>
        <thead>
          <tr><th>Ingredient</th><th>Quantity</th><th>Cost</th><th /></tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.inventory_item_id}-${index}`}>
              <td><strong>{nameOf(line.inventory_item_id)}</strong></td>
              <td>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={line.qty}
                  style={{ width: 90 }}
                  onChange={(event) => setLines((current) => current.map((entry, i) => (i === index ? { ...entry, qty: event.target.value } : entry)))}
                /> <span className="small muted">{unitOf(line.inventory_item_id)}</span>
              </td>
              <td className="small">{money(Math.round(costOf(line.inventory_item_id) * Number(line.qty || 0)))}</td>
              <td style={{ textAlign: 'right' }}>
                <button className="btn btn-sm btn-ghost" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>
                  <Icon name="trash" size={13} />
                </button>
              </td>
            </tr>
          ))}
          {lines.length === 0 ? (
            <tr><td colSpan={4} className="small muted">Nothing yet — add the ingredients below.</td></tr>
          ) : null}
        </tbody>
      </table>

      <div className="row" style={{ marginTop: 12 }}>
        <select value={addId} onChange={(event) => setAddId(event.target.value)} style={{ flex: 1 }}>
          <option value="">Add an ingredient…</option>
          {data.items.map((item) => (
            <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
          ))}
        </select>
        <button
          className="btn"
          disabled={!addId}
          onClick={() => {
            setLines((current) => [...current, { inventory_item_id: addId, qty: 0.1 }]);
            setAddId('');
          }}
        >
          <Icon name="plus" size={14} /> Add
        </button>
      </div>
    </Modal>
  );
}
