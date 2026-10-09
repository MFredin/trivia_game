// The home screen and the way to the first question: choose a mode, then category, difficulty and canon source, and
// start. Also the Daily Challenge, the featured weekly challenge and opening a challenge by code. It is the first thing a
// player sees after signing in, so it must stay quick: it loads only what it needs (the rest of the app is lazy).
import { useContext, useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import DifficultySlider from './DifficultySlider.jsx';
import HouseDevice from './HouseDevice.jsx';
import HolidaySeal from './HolidaySeal.jsx';
import { HolidayContext } from '../features/holiday/holidayContext.js';
import { HOLIDAYS } from '../constants/holidays.js';
import { createChallenge, getFeaturedChallenge, getSeasonChallenge } from '../api/challenges.js';
import { getProfile } from '../api/profile.js';
import { copyToClipboard } from '../lib/shareResult.js';
import { HOUSES, DEFAULT_HOUSE } from '../constants/houses.js';

const HOUSE_BY_ID = Object.fromEntries(HOUSES.map((h) => [h.id, h]));

const MODE_ORDER = ['classic', 'daily', 'blitz', 'survival', 'gauntlet'];

const MODE_INFO = {
  classic: {
    label: 'Classic Quiz',
    description: 'Ten questions, no clock pressure beyond the norm — one clean measure of what you know.',
    ledgerNote: 'Counts toward the Classic ledger.',
  },
  daily: {
    label: 'Daily Challenge',
    description:
      'One shared set of ten questions for everyone today, refreshed at midnight. Everyone who plays sees the exact same run.',
    ledgerNote: "Counts toward today's Daily Challenge.",
  },
  blitz: {
    label: 'Blitz',
    description:
      'Sixty seconds, as many questions as you can answer. The clock never resets between questions — speed is the whole game.',
    ledgerNote: 'Counts toward the Blitz ledger.',
  },
  survival: {
    label: 'Survival',
    description: 'One wrong answer, or one timeout, ends the run. How far can you get before a single mistake stops you?',
    ledgerNote: 'Counts toward the Survival ledger.',
  },
  gauntlet: {
    label: 'Gauntlet',
    description: "Three strikes and you're out — a little more forgiving than Survival, a lot more than Classic.",
    ledgerNote: 'Counts toward the Gauntlet ledger.',
  },
};

// The same three sources the segmented control offers, phrased as a sentence for the
// featured card rather than as a button label.
const CANON_LABEL = {
  combined: 'Books and films',
  books: 'Books only',
  movies: 'Films only',
};

const CANON_OPTIONS = [
  { value: 'books', label: 'Books' },
  { value: 'movies', label: 'Films' },
  { value: 'combined', label: 'Combined' },
];

// Mirrors backend CHALLENGE_QUESTION_COUNT_OPTIONS (lib/modes.js) — a challenge link's length
// is a fixed menu, not free text, same as category/difficulty.
const CHALLENGE_QUESTION_COUNT_OPTIONS = [10, 15, 25, 30];

export default function StartScreen({ categories, currentUser, onStart, error, token, onOpenChallenge }) {
  const [mode, setMode] = useState('classic');
  const [category, setCategory] = useState('');
  const [canonSource, setCanonSource] = useState('combined');
  const [difficulty, setDifficulty] = useState('');
  const [dayStreak, setDayStreak] = useState(0);
  const [challengeQuestionCount, setChallengeQuestionCount] = useState(10);
  const [challengeLink, setChallengeLink] = useState(null);
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy link');
  const [featured, setFeatured] = useState(null);
  const [season, setSeason] = useState(null);

  const house = HOUSE_BY_ID[currentUser?.theme ?? DEFAULT_HOUSE] ?? HOUSE_BY_ID[DEFAULT_HOUSE];
  // While a holiday with its own colours is on, the house rests and the card says what the room is dressed for instead.
  const holiday = useContext(HolidayContext);
  const boundHoliday = HOLIDAYS[holiday]?.bound ? HOLIDAYS[holiday] : null;

  // Asking for it is also what creates it: the server makes this week's row on first
  // request. Failing quietly is right — a missing featured card costs the player nothing,
  // and the rest of the start screen must not depend on it.
  useEffect(() => {
    getFeaturedChallenge()
      .then(setFeatured)
      .catch(() => setFeatured(null));
  }, []);

  // The same quiet rule for the season: null between seasons, and a failed fetch leaves the screen as it was.
  useEffect(() => {
    getSeasonChallenge()
      .then((data) => setSeason(data.season))
      .catch(() => setSeason(null));
  }, []);

  useEffect(() => {
    getProfile(currentUser.username, token)
      .then((data) => setDayStreak(data.current_day_streak))
      .catch(() => {});
  }, [currentUser.username, token]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onStart({
      mode,
      category: mode === 'daily' || category === '' ? null : category,
      canonSource: mode === 'daily' ? 'combined' : canonSource,
      difficulty: mode === 'daily' || difficulty === '' ? null : difficulty,
    });
  };

  const handleCreateChallenge = async () => {
    setCreatingChallenge(true);
    try {
      const data = await createChallenge(
        { category: category || null, canonSource, difficulty: difficulty || null, questionCount: challengeQuestionCount },
        token,
      );
      setChallengeLink(`${window.location.origin}/?challenge=${data.code}`);
    } catch {
      // Silent — this is an optional secondary action; the "Create a Challenge Link" button
      // simply stays put for another try rather than surfacing a whole error banner over it.
    } finally {
      setCreatingChallenge(false);
    }
  };

  const handleCopyChallengeLink = async () => {
    if (!challengeLink) return;
    await copyToClipboard(challengeLink);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy link'), 2000);
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">New Enquiry</p>
          <h2 className="screen-title has-dropcap">Begin an Enquiry</h2>
        </div>
        <span className="explanation" style={{ margin: 0 }}>
          Playing as <b>{currentUser.username}</b>
          {dayStreak >= 2 && <> &middot; 🔥 {dayStreak}-day streak</>}
        </span>
      </div>

      <Plate
        className="book-spread--exlibris"
        secondary={
          <div className="exlibris-card">
            <div className="exlibris-header">
              {boundHoliday ? (
                <HolidaySeal size={40} className="exlibris-house-device" />
              ) : (
                <HouseDevice house={house.id} size={40} className="exlibris-house-device" />
              )}
              <div>
                <p className="screen-eyebrow" style={{ fontSize: '0.66rem', margin: 0 }}>
                  {boundHoliday ? 'Dressed for' : 'Bound in'}
                </p>
                <p className="exlibris-house">{boundHoliday ? boundHoliday.label : house.label}</p>
              </div>
            </div>
            <div className="rule-rubric" />
            <div>
              <p className="screen-eyebrow" style={{ fontSize: '0.66rem', margin: 0 }}>
                Mode
              </p>
              <p className="exlibris-mode">{MODE_INFO[mode].label}</p>
            </div>
            <p className="explanation" style={{ margin: 0 }}>
              {MODE_INFO[mode].description}
            </p>
            <p className="exlibris-note">{MODE_INFO[mode].ledgerNote}</p>
            <div className="exlibris-footer">
              <span>Ex Libris</span>
              <span>Second Edition</span>
            </div>
          </div>
        }
      >
        <form className="start-form" onSubmit={handleSubmit}>
          {error && <div className="error-banner">{error}</div>}

          <div className="start-form-field">
            <span className="field-label">Choose a volume</span>
            <div className="spine-shelf">
              {MODE_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`mode-spine ${mode === key ? 'is-active' : ''}`}
                  onClick={() => setMode(key)}
                  aria-pressed={mode === key}
                >
                  <span className="mode-spine-band" />
                  <span className="mode-spine-title">{MODE_INFO[key].label}</span>
                  <span className="mode-spine-band" />
                </button>
              ))}
            </div>
          </div>

          {mode !== 'daily' && (
            <>
              <label>
                Category
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">All categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
              <div className="start-form-field">
                <span className="field-label">Canon source</span>
                <div className="seg-control">
                  {CANON_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`seg ${canonSource === opt.value ? 'is-active' : ''}`}
                      onClick={() => setCanonSource(opt.value)}
                      aria-pressed={canonSource === opt.value}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="start-form-field">
                <span className="field-label">Difficulty</span>
                <DifficultySlider value={difficulty} onChange={setDifficulty} />
              </div>
            </>
          )}
          <button type="submit" className="primary-button">
            Begin
          </button>
        </form>
        {mode === 'classic' && currentUser.challenges !== 'off' && (
          <div style={{ marginTop: '1.2rem' }}>
            {challengeLink ? (
              <div className="invite-link-row">
                <input type="text" readOnly value={challengeLink} onFocus={(e) => e.target.select()} />
                <button type="button" className="secondary-button" onClick={handleCopyChallengeLink}>
                  {copyLabel}
                </button>
              </div>
            ) : (
              <>
                <div className="start-form-field" role="group" aria-labelledby="challenge-length-label">
                  <span className="field-label" id="challenge-length-label">
                    Challenge a friend
                  </span>
                  <p className="field-hint">
                    Make a link anyone can open. They answer the same questions as you, with the category, canon and
                    difficulty chosen above, and you compare scores.
                  </p>
                  <span className="field-sublabel">How many questions?</span>
                  <div className="seg-control">
                    {CHALLENGE_QUESTION_COUNT_OPTIONS.map((count) => (
                      <button
                        key={count}
                        type="button"
                        className={`seg seg--count ${challengeQuestionCount === count ? 'is-active' : ''}`}
                        onClick={() => setChallengeQuestionCount(count)}
                        aria-pressed={challengeQuestionCount === count}
                        aria-label={`${count} questions`}
                      >
                        <span className="seg-number">{count}</span>
                        <span className="seg-unit">questions</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" className="secondary-button" onClick={handleCreateChallenge} disabled={creatingChallenge}>
                  {creatingChallenge ? 'Creating…' : `Create a ${challengeQuestionCount}-question challenge link`}
                </button>
              </>
            )}
          </div>
        )}
      </Plate>

      {/* A seasonal bundle, for the few weeks around its occasion. The same card and the same screen as the weekly
          challenge below: nothing is lost by skipping it, and it comes back next year. */}
      {season && (
        <Plate className="featured-week season-card">
          <div className="featured-week-body">
            <div>
              <p className="screen-eyebrow">In season</p>
              <h3 className="featured-week-title">{season.label}</h3>
              <p className="featured-week-note">
                {season.blurb}
                {season.players > 0 &&
                  ` · ${season.players} ${season.players === 1 ? 'player has' : 'players have'} finished it`}
              </p>
            </div>
            <button type="button" className="primary-button" onClick={() => onOpenChallenge(season.code)}>
              Play it
            </button>
          </div>
        </Plate>
      )}

      {/* This week's rotating themed quiz — the Daily Challenge's lighter sibling. Rendered
          only once it has loaded, so a failed fetch leaves the start screen exactly as it was
          rather than showing a broken shelf. */}
      {featured && (
        <Plate className="featured-week">
          <div className="featured-week-body">
            <div>
              <p className="screen-eyebrow">Featured this week</p>
              <h3 className="featured-week-title">{featured.category}</h3>
              <p className="featured-week-note">
                {CANON_LABEL[featured.canon_source] ?? 'Combined canon'}
                {featured.players > 0 &&
                  ` · ${featured.players} ${featured.players === 1 ? 'player has' : 'players have'} finished it`}
              </p>
            </div>
            <button type="button" className="primary-button" onClick={() => onOpenChallenge(featured.code)}>
              Play it
            </button>
          </div>
        </Plate>
      )}
    </div>
  );
}
