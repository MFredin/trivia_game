/**
 * A data table that may be wider than the screen: it scrolls sideways inside this box instead of widening the
 * page. That is what WCAG's reflow rule allows for tables, and it only comes into play at large text sizes or on
 * the narrowest phones. The box takes keyboard focus (tabIndex) so the table can be scrolled without a pointer,
 * and is named so a screen reader says what it is.
 */
export default function TableScroll({ label, children }) {
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
