import Modal from './Modal.jsx';

export default function MischiefModal({ onClose, onSuggest }) {
  return (
    <Modal onClose={onClose} labelledBy="mischief-title">
      <p className="screen-eyebrow">Mischief Managed</p>
      <h2 className="screen-title has-dropcap" id="mischief-title">
        You&apos;ve found the restricted shelf.
      </h2>
      <p className="explanation">
        Only a true fan would have typed that here — or tapped their way to it. As a reward,
        you&apos;ve unlocked a way to add your own question to the archive. Every submission is
        reviewed before it ever reaches another player.
      </p>
      <div className="modal-actions">
        <button type="button" className="primary-button" onClick={onSuggest}>
          Suggest a Question
        </button>
        <button type="button" className="secondary-button" onClick={onClose}>
          Mischief Managed
        </button>
      </div>
    </Modal>
  );
}
