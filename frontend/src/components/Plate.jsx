// Most screens render a single parchment "page" (the default below). Start and Question pass
// a `secondary` node to get the two-page book-spread treatment instead — the same parchment
// sheet split into a left and right leaf with a real binding-groove shadow down the middle,
// rather than a plain single card.
export default function Plate({ children, secondary, className = '', style, noGilt = false }) {
  if (secondary) {
    return (
      <div className={`book-spread ${className}`} style={style}>
        <div className="book-spread-leaf left">
          <span className="plate-corner tl" />
          <span className="plate-corner bl" />
          {secondary}
        </div>
        <div className="book-spread-leaf right">
          <span className="plate-corner tr" />
          <span className="plate-corner br" />
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={`plate ${noGilt ? 'plate--no-gilt' : ''} ${className}`} style={style}>
      <span className="plate-corner tl" />
      <span className="plate-corner tr" />
      <span className="plate-corner bl" />
      <span className="plate-corner br" />
      {children}
    </div>
  );
}
