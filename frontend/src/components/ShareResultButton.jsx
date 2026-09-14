import { useRef, useState } from 'react';
import { copyToClipboard } from '../lib/shareResult.js';

export default function ShareResultButton({ text }) {
  const [label, setLabel] = useState('Copy result to share');
  const [showFallback, setShowFallback] = useState(false);
  const fallbackRef = useRef(null);

  const handleClick = async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setShowFallback(false);
      setLabel('Copied!');
      setTimeout(() => setLabel('Copy result to share'), 2000);
    } else {
      setShowFallback(true);
      setTimeout(() => fallbackRef.current?.select(), 0);
    }
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <button type="button" className="secondary-button" onClick={handleClick}>
        {label}
      </button>
      {showFallback && (
        <textarea
          ref={fallbackRef}
          readOnly
          value={text}
          className="share-fallback-textarea"
          onFocus={(e) => e.target.select()}
        />
      )}
    </div>
  );
}
