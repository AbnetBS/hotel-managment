import { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import { useApp } from './store.jsx';

export function Pill({ status, children, className = '' }) {
  const key = String(status || '').toLowerCase().replace(/\s+/g, '-');
  return (
    <span className={`pill ${key} ${className}`}>
      <i />
      {children}
    </span>
  );
}

export function Stat({ label, value, unit, foot, icon, alert }) {
  return (
    <div className={`stat ${alert ? 'alert' : ''}`}>
      <div className="label">
        <span>{label}</span>
        {icon ? <span style={{ color: 'var(--teal)' }}><Icon name={icon} size={15} /></span> : null}
      </div>
      <div className="value">
        {value}
        {unit ? <small> {unit}</small> : null}
      </div>
      {foot ? <div className="foot">{foot}</div> : null}
    </div>
  );
}

export function Card({ title, subtitle, action, children, className = '', bodyClass = '', noBody }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          <div>
            {title ? <h3>{title}</h3> : null}
            {subtitle ? <div className="sub">{subtitle}</div> : null}
          </div>
          {action}
        </div>
      )}
      {noBody ? children : <div className={`card-body ${bodyClass}`}>{children}</div>}
    </section>
  );
}

export function Modal({ title, subtitle, children, onClose, footer, size = '' }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <div className="sub">{subtitle}</div> : null}
          </div>
          <button className="close-x" onClick={onClose} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Drawer({ title, subtitle, children, onClose, footer, wide }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <aside className={`drawer ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{title}</h2>
            {subtitle ? <div className="sub">{subtitle}</div> : null}
          </div>
          <button className="close-x" onClick={onClose} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer ? <div className="drawer-foot" style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid var(--line)', padding: '14px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>{footer}</div> : null}
      </aside>
    </div>
  );
}

export function Field({ label, hint, required, children, full }) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label>
        {label} {required ? <span className="req">*</span> : null}
      </label>
      {children}
      {hint ? <div className="help">{hint}</div> : null}
    </div>
  );
}

export function Input({ value, onChange, type = 'text', placeholder, ...rest }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(event) => onChange?.(event.target.value, event)}
      {...rest}
    />
  );
}

export function Select({ value, onChange, options, children, ...rest }) {
  return (
    <select value={value ?? ''} onChange={(event) => onChange?.(event.target.value, event)} {...rest}>
      {children}
      {options?.map((option) => (
        <option key={option.value ?? option} value={option.value ?? option}>
          {option.label ?? option}
        </option>
      ))}
    </select>
  );
}

export function Empty({ title, hint, icon = 'grid', action }) {
  return (
    <div className="empty">
      <div style={{ marginBottom: 10, color: 'var(--ink-faint)' }}><Icon name={icon} size={26} /></div>
      <strong>{title}</strong>
      {hint ? <div className="small">{hint}</div> : null}
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  if (!toasts.length) return null;
  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind}`}>
          <Icon name={toast.kind === 'error' ? 'alert' : toast.kind === 'info' ? 'bell' : 'check-circle'} size={16} />
          <span>{toast.message}</span>
          <button onClick={() => dismissToast(toast.id)} aria-label="Dismiss">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map((option) => (
        <button key={option.value} className={value === option.value ? 'on' : ''} onClick={() => onChange(option.value)} type="button">
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars">
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <div className="top">
            <span>{row.label}</span>
            <strong>{row.display ?? row.value}</strong>
          </div>
          <div className="bar-track">
            <div className={`bar-fill ${row.tone || ''}`} style={{ width: `${Math.round((row.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A ticking value — used for the live room clock and running bill. */
export function Ticker({ interval = 1000, children }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), interval);
    return () => clearInterval(id);
  }, [interval]);
  return children(Date.now());
}

export function Toolbar({ children }) {
  return <div className="board-bar">{children}</div>;
}
