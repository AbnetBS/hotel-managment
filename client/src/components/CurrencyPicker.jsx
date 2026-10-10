import { useMemo, useRef, useState } from 'react';
import { ALL_CURRENCIES, COMMON_CURRENCIES, CURRENCY_BY_CODE } from '../../../shared/currencies.js';
import { Icon } from '../lib/icons.jsx';

/**
 * The currency box on the check-in form: ETB by default; clicking opens a
 * searchable list — the common ten first, then almost every currency below.
 * A foreign guest is the normal reason to reach for it, so "dollar", "euro"
 * or "birr" must all find their way.
 */
export default function CurrencyPicker({ value = 'ETB', onChange }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const boxRef = useRef(null);

  const selected = CURRENCY_BY_CODE[value] || { code: value, name: value, symbol: '' };

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const hit = (c) => !needle
      || c.code.toLowerCase().includes(needle)
      || c.name.toLowerCase().includes(needle);
    return {
      common: COMMON_CURRENCIES.filter(hit),
      all: ALL_CURRENCIES.filter((c) => c.code !== 'ETB').filter(hit),
    };
  }, [term]);

  const pick = (code) => {
    onChange(code);
    setOpen(false);
    setTerm('');
  };

  return (
    <div className="cur-picker" ref={boxRef}>
      <button type="button" className="cur-button" onClick={() => setOpen((v) => !v)}>
        <span className="cur-code">{selected.code}</span>
        <span className="cur-name">{selected.name}</span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open ? (
        <div className="cur-menu">
          <div className="cur-search">
            <Icon name="search" size={14} />
            <input
              autoFocus
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search currency — dollar, euro, birr…"
            />
          </div>
          <div className="cur-list">
            {term.trim() ? null : (
              <>
                <div className="cur-group">Common</div>
                {[{ code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br' }, ...COMMON_CURRENCIES].map((c) => (
                  <button type="button" key={c.code} className={`cur-row ${c.code === value ? 'on' : ''}`} onClick={() => pick(c.code)}>
                    <span className="cur-code">{c.code}</span>
                    <span className="cur-name">{c.name}</span>
                  </button>
                ))}
              </>
            )}
            <div className="cur-group">{term.trim() ? 'Results' : 'All currencies'}</div>
            {(term.trim() ? [...matches.common, ...matches.all.filter((c) => !matches.common.some((m) => m.code === c.code))] : matches.all).map((c) => (
              <button type="button" key={c.code} className={`cur-row ${c.code === value ? 'on' : ''}`} onClick={() => pick(c.code)}>
                <span className="cur-code">{c.code}</span>
                <span className="cur-name">{c.name}</span>
              </button>
            ))}
            {term.trim() && !matches.common.length && !matches.all.length ? (
              <div className="cur-empty">No currency matches “{term}”.</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
