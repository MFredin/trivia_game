export default function Plate({ children, className = '', style, noGilt = false }) {
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
