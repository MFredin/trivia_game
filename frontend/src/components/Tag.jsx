export default function Tag({ children, variant }) {
  const className = variant === 'divergence' ? 'tag tag--divergence' : 'tag';
  return <span className={className}>{children}</span>;
}
