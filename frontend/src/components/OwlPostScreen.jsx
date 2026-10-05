import { useState } from 'react';
import OwlInbox from './OwlInbox.jsx';
import OwlThread from './OwlThread.jsx';
import OwlCompose from './OwlCompose.jsx';
import IconButton from './IconButton.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import ReportModal from './ReportModal.jsx';

/**
 * Owl Post: your conversations, and the one you have open. Messages are between friends only,
 * plain text, and deleted after 90 days (the inbox says so). Reporting from inside a conversation
 * offers to send the recent messages along, because a moderator is otherwise never shown them.
 */
export default function OwlPostScreen({ user, owl, withUsername, onOpen, onClose, onViewProfile, onBlock, onReport, onGoToCommunity }) {
  const [dialog, setDialog] = useState(null);
  const [composing, setComposing] = useState(false);

  if (composing && !withUsername) {
    return (
      <OwlCompose
        friends={owl.composeFriends}
        sending={owl.sending}
        error={owl.composeError}
        onLoad={owl.loadComposeFriends}
        onSend={async (message) => {
          if (await owl.compose(message)) {
            setComposing(false);
            onOpen(message.username);
          }
        }}
        onCancel={() => setComposing(false)}
        onGoToCommunity={onGoToCommunity}
      />
    );
  }

  if (!withUsername) {
    return (
      <div>
        <div className="screen-head">
          <div>
            <p className="screen-eyebrow">Correspondence</p>
            <h2 className="screen-title">Owl Post</h2>
          </div>
          {owl.inbox?.length > 0 && (
            <IconButton icon="owl" label="Send an owl" variant="primary" showLabel onClick={() => setComposing(true)} />
          )}
        </div>
        <OwlInbox conversations={owl.inbox} onOpen={onOpen} onCompose={() => setComposing(true)} />
      </div>
    );
  }

  return (
    <>
      <OwlThread
        thread={owl.thread}
        user={user}
        sending={owl.sending}
        sendError={owl.sendError}
        onSend={owl.send}
        onLoadOlder={owl.loadOlder}
        onDelete={owl.remove}
        onBack={onClose}
        onViewProfile={onViewProfile}
        onReport={() => setDialog('report')}
        onBlock={() => setDialog('block')}
      />
      {dialog === 'block' && (
        <ConfirmModal
          eyebrow="Block Player"
          title={`Block ${withUsername}?`}
          confirmLabel="Block"
          onConfirm={async () => {
            await onBlock(withUsername);
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        >
          <p>
            You will be removed from each other&rsquo;s friends and this conversation will disappear for both of you. They
            are not told. You can undo the block in Settings.
          </p>
        </ConfirmModal>
      )}
      {dialog === 'report' && (
        <ReportModal
          username={withUsername}
          conversation
          onSubmit={onReport}
          onBlock={() => setDialog('block')}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
