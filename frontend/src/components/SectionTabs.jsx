import { useRef } from 'react';
import Icon from './icons.jsx';

// Spelled out rather than assembled, so the dead-code audit can see each rule is in use.
const VARIANT_CLASS = { rail: 'section-tabs--rail', tabs: 'section-tabs--tabs' };

const tabId = (prefix, id) => `${prefix}-tab-${id}`;

/** What the panel that belongs to a tab carries, so a screen reader can pair the two. */
export const panelProps = (prefix, id) => ({ role: 'tabpanel', id: `${prefix}-panel-${id}`, 'aria-labelledby': tabId(prefix, id), tabIndex: 0 });

/**
 * A row (or, on a wide screen, a column) of sections of which one shows at a time — how Settings and Edit
 * Profile avoid being one long scroll. The ARIA tabs pattern: arrow keys move between sections and Home/End
 * jump to the ends, and only the current one is in the tab order, so the page is one stop rather than one per
 * section. `dirty` puts a dot on a section that holds unsaved changes. `variant="rail"` is the Settings
 * sidebar (an icon, a name and a hint); `variant="tabs"` is the plain underlined row.
 */
export default function SectionTabs({ prefix, label, tabs, active, onChange, variant = 'tabs' }) {
  const refs = useRef({});

  const move = (event, index) => {
    const last = tabs.length - 1;
    const keys = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: last };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = tabs[(keys[event.key] + tabs.length) % tabs.length];
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div className={`section-tabs ${VARIANT_CLASS[variant]}`} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(el) => {
            refs.current[tab.id] = el;
          }}
          type="button"
          role="tab"
          id={tabId(prefix, tab.id)}
          aria-selected={active === tab.id}
          aria-controls={`${prefix}-panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          className="section-tab"
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => move(event, index)}
        >
          {tab.icon && <Icon name={tab.icon} size={20} />}
          <span className="section-tab-label">{tab.label}</span>
          {tab.hint && <span className="section-tab-hint">{tab.hint}</span>}
          {tab.dirty && (
            <>
              <span className="section-tab-pip" aria-hidden="true" />
              <span className="visually-hidden"> (unsaved changes)</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
