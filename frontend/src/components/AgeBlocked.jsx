import { MINIMUM_AGE } from '../lib/ageGate.js';

// A private address for parents, set where the app is built. Without one, the page says what it can and
// does not point a child's parent at a public tracker.
const PARENT_CONTACT = import.meta.env.VITE_PARENT_CONTACT_EMAIL;

/** What a player under the minimum age sees instead of the rest of the form. Nothing they typed was kept. */
export default function AgeBlocked({ onLogin }) {
  return (
    <div className="start-form age-blocked" role="status">
      <p className="age-blocked-title">The Restricted Section is for players aged {MINIMUM_AGE} and over.</p>
      <p className="explanation">
        We have not kept anything you entered, and no account has been made.
        {PARENT_CONTACT ? (
          <>
            {' '}
            If you are a parent or guardian and have a question, write to <a href={`mailto:${PARENT_CONTACT}`}>{PARENT_CONTACT}</a>.
          </>
        ) : (
          ' If you are a parent or guardian and have a question, please contact us through the Submit Feedback link at the foot of the page, without including a child’s details.'
        )}
      </p>
      <button type="button" className="secondary-button" onClick={onLogin}>
        I already have an account
      </button>
    </div>
  );
}
