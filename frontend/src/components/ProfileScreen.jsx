import { useState } from 'react';
import Plate from './Plate.jsx';
import HouseDevice from './HouseDevice.jsx';
import Avatar from './Avatar.jsx';
import ProfileActions from './ProfileActions.jsx';
import ProfileFriends from './ProfileFriends.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import ReportModal from './ReportModal.jsx';
import { HOUSES } from '../constants/houses.js';

const HOUSE_BY_ID = Object.fromEntries(HOUSES.map((h) => [h.id, h]));

function Stat({ label, value }) {
  return (
    <div className="qcard-margin-stat" style={{ display: 'inline-block', marginRight: '2rem', marginBottom: '0.6rem' }}>
      <span className="qcard-margin-stat-label">{label}</span>
      <br />
      <span className="qcard-margin-stat-value">{value}</span>
    </div>
  );
}

const joinedLabel = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/**
 * A player's file. Presentational: everything it shows arrives as props from `useProfile`, so
 * the page can be rendered for any player, in any relationship to the viewer, without a server.
 */
export default function ProfileScreen({
  username,
  view,
  ownVisibility,
  onBack,
  onChallenge,
  onViewProfile,
  onEditProfile,
  onChangeVisibility,
  onBlock,
  onReport,
}) {
  const { profile, error, friends, actionError } = view;
  // Which dialog is open, if any. Local, because nothing outside this screen cares.
  const [dialog, setDialog] = useState(null);
  const house = profile ? HOUSE_BY_ID[profile.theme] : null;

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Player File</p>
          <h2 className="screen-title">{username}</h2>
        </div>
        {onBack && (
          <button type="button" className="secondary-button" onClick={onBack}>
            Back
          </button>
        )}
      </div>

      {profile && house && (
        // The subject's own house colours, applied directly rather than through the
        // (viewer-scoped) --rubric/--leaf tokens — this profile may belong to someone
        // bound in a different house than whoever is looking at it.
        <div className="exlibris-card exlibris-card--standalone">
          <div className="profile-head">
            <Avatar username={profile.username} avatar={profile.avatar} style={profile.avatar_style} house={profile.theme} size={88} label={`${profile.username}'s avatar`} />
            <div className="profile-head-text">
              <div className="exlibris-header">
                <HouseDevice house={house.id} size={30} style={{ color: house.ink }} />
                <div>
                  <p className="screen-eyebrow" style={{ fontSize: '0.66rem', margin: 0, color: house.ink }}>
                    Bound in
                  </p>
                  <p className="exlibris-house" style={{ color: house.ink }}>
                    {house.label}
                  </p>
                </div>
              </div>
              <p className="profile-meta">
                <span>Member since {joinedLabel(profile.member_since)}</span>
                {profile.online && (
                  <span className="profile-online">
                    <span className="online-dot is-online" aria-hidden="true" /> Online now
                  </span>
                )}
              </p>
              {profile.bio && <p className="profile-bio">{profile.bio}</p>}
              {(profile.favorite_book || profile.favorite_subject) && (
                <p className="profile-facts">
                  {profile.favorite_book && (
                    <span>
                      <span className="profile-fact-label">Favourite book</span> {profile.favorite_book}
                    </span>
                  )}
                  {profile.favorite_subject && (
                    <span>
                      <span className="profile-fact-label">Favourite subject</span> {profile.favorite_subject}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <ProfileActions
            relationship={profile.relationship}
            onAdd={view.add}
            onAccept={view.accept}
            onDecline={view.decline}
            onChallenge={() => onChallenge(profile.username)}
            onEdit={onEditProfile}
            onRemove={() => setDialog('remove')}
            onBlock={() => setDialog('block')}
            onReport={() => setDialog('report')}
          />
          {actionError && (
            <div className="error-banner" role="alert">
              {actionError}
            </div>
          )}
        </div>
      )}

      {error && (
        <Plate>
          <p className="explanation">{error}</p>
        </Plate>
      )}

      {!error && !profile && (
        <Plate>
          <p className="explanation">Fetching&hellip;</p>
        </Plate>
      )}

      {profile && (
        <>
          <Plate>
            <h3 className="plate-subhead">Lifetime</h3>
            <Stat label="Runs completed" value={profile.total_completed} />
            <Stat label="Questions answered" value={profile.total_questions_answered} />
            <Stat label="Accuracy" value={profile.accuracy_pct != null ? `${profile.accuracy_pct}%` : '—'} />
            <Stat label="Best single-run score" value={profile.best_score} />
            <Stat label="Longest in-run streak" value={profile.max_best_streak} />
            <Stat label="Most played category" value={profile.favorite_category ?? 'No category picked yet'} />
          </Plate>

          <Plate>
            <h3 className="plate-subhead">Consistency</h3>
            <Stat label="Current day streak" value={profile.current_day_streak > 0 ? `🔥 ${profile.current_day_streak}` : '0'} />
            <Stat label="Longest day streak" value={profile.longest_day_streak} />
          </Plate>

          <Plate>
            <h3 className="plate-subhead">Duels &amp; Achievements</h3>
            <Stat label="Duel record" value={`${profile.duels_won}–${profile.duels_completed - profile.duels_won}`} />
            <Stat label="Achievements" value={`${profile.achievements_unlocked} / ${profile.achievements_total}`} />
            {/* The count alone said nothing about what this player is actually good at. These
                are their most recent unlocks; the Achievements screen stays the full list. */}
            {profile.achievements_showcase?.length > 0 && (
              <div className="profile-badges">
                <p className="profile-badges-label">{profile.achievements_pinned ? 'Pinned' : 'Most recent'}</p>
                <div className="achievement-grid achievement-grid--compact">
                  {profile.achievements_showcase.map((a) => (
                    <div key={a.id} className="achievement-card is-unlocked">
                      <div className="achievement-card-head">
                        <span className="achievement-name">{a.name}</span>
                      </div>
                      <p className="achievement-desc">{a.description}</p>
                      <p className="achievement-date">Unlocked {new Date(a.unlocked_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Plate>

          <ProfileFriends
            friends={friends}
            isSelf={profile.relationship === 'self'}
            ownVisibility={ownVisibility}
            onViewProfile={onViewProfile}
            onLoadMore={view.loadMoreFriends}
            onChangeVisibility={onChangeVisibility}
          />
        </>
      )}

      {profile && dialog === 'remove' && (
        <ConfirmModal
          eyebrow="Remove Friend"
          title={`Remove ${profile.username}?`}
          confirmLabel="Remove friend"
          onConfirm={async () => {
            await view.remove();
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        >
          <p>You will no longer be friends. You can send a new request later.</p>
        </ConfirmModal>
      )}
      {profile && dialog === 'block' && (
        <ConfirmModal
          eyebrow="Block Player"
          title={`Block ${profile.username}?`}
          confirmLabel="Block"
          onConfirm={() => onBlock(profile.username)}
          onCancel={() => setDialog(null)}
        >
          <p>
            You will be removed from each other&rsquo;s friends. They will not be able to find you, add you, challenge
            you or see your profile — and they are not told. You can undo this in Settings.
          </p>
        </ConfirmModal>
      )}
      {profile && dialog === 'report' && (
        <ReportModal
          username={profile.username}
          onSubmit={onReport}
          onBlock={() => setDialog('block')}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
