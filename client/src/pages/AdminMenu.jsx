import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Icon } from '../lib/icons.jsx';
import { money } from '../lib/format.js';
import { Card, Field, Modal, Empty, Pill } from '../lib/ui.jsx';
import { STATIONS } from '../../../shared/billing.js';

const STATION_OPTIONS = Object.values(STATIONS);

/** Menu and the station each item is made in — this is what routes tickets. */
export default function AdminMenu() {
  const { menu, toast, loadMenu } = useApp();
  const [itemModal, setItemModal] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null);
  const [filter, setFilter] = useState('all');

  const refresh = async () => {
    await loadMenu();
  };

  const items = menu.items.filter((item) => (filter === 'all' ? true : item.category_id === filter));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Food &amp; drink</div>
          <h1>Menu &amp; stations</h1>
          <p className="page-desc">
            Every item belongs to a station: <strong>kitchen</strong>, <strong>barista</strong> or <strong>juice</strong>. That is how an order
            splits itself between the right screens — so the barista never sees a doro wat.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setCategoryModal({ name: '', station: 'kitchen' })}>
            <Icon name="plus" size={14} /> New category
          </button>
          <button className="btn btn-primary" onClick={() => setItemModal({ station: 'kitchen', category_id: menu.categories[0]?.id, available: true, price: 0 })}>
            <Icon name="plus" size={15} /> New item
          </button>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        {Object.values(STATIONS).filter((station) => station.key !== 'bar').map((station) => (
          <Card key={station.key} title={station.label} subtitle={`${menu.items.filter((item) => item.station === station.key).length} item(s)`}>
            <div className="row">
              <div className="avatar"><Icon name={station.icon} size={16} /></div>
              <div className="small muted">Tickets for these items go straight to the {station.label.toLowerCase()} screen.</div>
            </div>
          </Card>
        ))}
      </div>

      <Card
        title="Menu"
        subtitle={`${menu.items.length} items in ${menu.categories.length} categories`}
        action={
          <div className="chips">
            <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>Everything</button>
            {menu.categories.map((category) => (
              <button key={category.id} className={`chip ${filter === category.id ? 'on' : ''}`} onClick={() => setFilter(category.id)}>
                {category.name}
              </button>
            ))}
          </div>
        }
        noBody
      >
        {items.length === 0 ? (
          <Empty title="No items" hint="Add the first dish or drink." icon="utensils" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Station</th>
                <th>Price</th>
                <th>Prep</th>
                <th>On the menu</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.emoji} {item.name}</strong>
                    <div className="tiny muted">{item.name_am || item.description}</div>
                  </td>
                  <td className="small">{menu.categories.find((category) => category.id === item.category_id)?.name || '—'}</td>
                  <td><Pill status="sent">{STATIONS[item.station]?.label || item.station}</Pill></td>
                  <td><strong>{money(item.price)}</strong></td>
                  <td className="small muted">{item.prep_minutes} min</td>
                  <td>
                    <button
                      className={`chip ${item.available ? 'on' : ''}`}
                      onClick={async () => {
                        await api.patch(`/admin/menu/items/${item.id}`, { available: !item.available });
                        toast(item.available ? `${item.name} is off the menu (still on old bills).` : `${item.name} is back on the menu.`);
                        refresh();
                      }}
                    >
                      {item.available ? 'Available' : 'Sold out'}
                    </button>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row tight" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => setItemModal(item)}><Icon name="pencil" size={13} /></button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={async () => {
                          await api.del(`/admin/menu/items/${item.id}`);
                          toast(`${item.name} removed from the menu.`);
                          refresh();
                        }}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div style={{ height: 16 }} />

      <Card title="Categories" subtitle="Grouping shown to guests and to the cashier">
        <div className="grid grid-3">
          {menu.categories.map((category) => (
            <div className="row" key={category.id} style={{ justifyContent: 'space-between', border: '1px solid var(--line)', borderRadius: 11, padding: 12, background: '#fff' }}>
              <div>
                <strong className="small">{category.name}</strong>
                <div className="tiny muted">{category.name_am || ''} · {STATIONS[category.station]?.label}</div>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => setCategoryModal(category)}>
                <Icon name="pencil" size={13} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {itemModal ? <ItemModal value={itemModal} categories={menu.categories} onClose={() => setItemModal(null)} onDone={() => { setItemModal(null); refresh(); }} /> : null}
      {categoryModal ? <CategoryModal value={categoryModal} onClose={() => setCategoryModal(null)} onDone={() => { setCategoryModal(null); refresh(); }} /> : null}
    </>
  );
}

function ItemModal({ value, categories, onClose, onDone }) {
  const { toast } = useApp();
  const [form, setForm] = useState({ ...value, price: value.price ?? 0, station: value.station || 'kitchen' });
  const set = (key) => (fieldValue) => setForm((current) => ({ ...current, [key]: fieldValue }));

  return (
    <Modal
      title={value.id ? `Edit ${value.name}` : 'New menu item'}
      subtitle="The station decides which screen gets the ticket."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!form.name}
            onClick={async () => {
              const payload = {
                name: form.name, name_am: form.name_am, description: form.description, emoji: form.emoji,
                price: Number(form.price) || 0, category_id: form.category_id, station: form.station,
                prep_minutes: Number(form.prep_minutes) || 15,
              };
              try {
                if (value.id) await api.patch(`/admin/menu/items/${value.id}`, payload);
                else await api.post('/admin/menu/items', payload);
                toast(value.id ? 'Item updated.' : `${form.name} added to the menu.`);
                onDone?.();
              } catch (error) {
                toast(error.message, 'error');
              }
            }}
          >
            <Icon name="check" size={15} /> Save
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Name" required>
          <input value={form.name || ''} onChange={(event) => set('name')(event.target.value)} />
        </Field>
        <Field label="Amharic name">
          <input value={form.name_am || ''} onChange={(event) => set('name_am')(event.target.value)} />
        </Field>
        <Field label="Price (ETB)" required>
          <input type="number" value={form.price} onChange={(event) => set('price')(event.target.value)} />
        </Field>
        <Field label="Emoji">
          <input value={form.emoji || ''} onChange={(event) => set('emoji')(event.target.value)} placeholder="🍲" maxLength={4} />
        </Field>
        <Field label="Category">
          <select value={form.category_id || ''} onChange={(event) => set('category_id')(event.target.value)}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Station" required hint="Where it is prepared">
          <select value={form.station} onChange={(event) => set('station')(event.target.value)}>
            {STATION_OPTIONS.map((station) => (
              <option key={station.key} value={station.key}>{station.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Prep time (minutes)">
          <input type="number" value={form.prep_minutes || 15} onChange={(event) => set('prep_minutes')(event.target.value)} />
        </Field>
        <Field label="Description" full>
          <input value={form.description || ''} onChange={(event) => set('description')(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function CategoryModal({ value, onClose, onDone }) {
  const { toast } = useApp();
  const [form, setForm] = useState({ ...value });
  const set = (key) => (fieldValue) => setForm((current) => ({ ...current, [key]: fieldValue }));

  return (
    <Modal
      title={value.id ? `Edit ${value.name}` : 'New category'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!form.name}
            onClick={async () => {
              try {
                if (value.id) await api.patch(`/admin/menu/categories/${value.id}`, form);
                else await api.post('/admin/menu/categories', form);
                toast('Category saved.');
                onDone?.();
              } catch (error) {
                toast(error.message, 'error');
              }
            }}
          >
            <Icon name="check" size={15} /> Save
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Name" required>
          <input value={form.name || ''} onChange={(event) => set('name')(event.target.value)} />
        </Field>
        <Field label="Amharic name">
          <input value={form.name_am || ''} onChange={(event) => set('name_am')(event.target.value)} />
        </Field>
        <Field label="Default station" full hint="Items in this category start on this station.">
          <select value={form.station || 'kitchen'} onChange={(event) => set('station')(event.target.value)}>
            {STATION_OPTIONS.map((station) => (
              <option key={station.key} value={station.key}>{station.label}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
