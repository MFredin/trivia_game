// Static catalog of achievement definitions. Unlock state lives in the user_achievements
// table (see services/achievements.js) — this file is just the deploy-time content, the
// same pattern as MODES and OBSCURITY_TIERS.
export const ACHIEVEMENTS = [
  { id: 'milestone_1', category: 'Milestones', name: 'First Steps', description: 'Complete your first run.' },
  { id: 'milestone_10', category: 'Milestones', name: 'Regular', description: 'Complete 10 runs.' },
  { id: 'milestone_50', category: 'Milestones', name: 'Dedicated Scholar', description: 'Complete 50 runs.' },
  {
    id: 'milestone_150',
    category: 'Milestones',
    name: 'Restricted Section Veteran',
    description: 'Complete 150 runs.',
  },

  {
    id: 'mastery_flawless',
    category: 'Mastery',
    name: 'Flawless',
    description: 'Complete a Classic or Daily Challenge run with no wrong answers.',
  },
  {
    id: 'mastery_newt',
    category: 'Mastery',
    name: 'N.E.W.T. Level',
    description: 'Complete a run at N.E.W.T. difficulty.',
  },
  {
    id: 'mastery_phoenix',
    category: 'Mastery',
    name: 'Inner Circle',
    description: 'Complete a run at Order of the Phoenix difficulty.',
  },

  { id: 'streak_10', category: 'Streak', name: 'On a Roll', description: 'Reach a 10-answer streak in a single run.' },
  {
    id: 'streak_20',
    category: 'Streak',
    name: 'Unshakeable',
    description: 'Reach a 20-answer streak in a single run.',
  },
  {
    id: 'streak_40',
    category: 'Streak',
    name: 'Legendary Streak',
    description: 'Reach a 40-answer streak in a single run.',
  },

  {
    id: 'endurance_20',
    category: 'Endurance',
    name: 'Surviving',
    description: 'Reach question 20 in Survival or Gauntlet.',
  },
  {
    id: 'endurance_50',
    category: 'Endurance',
    name: 'Battle-Hardened',
    description: 'Reach question 50 in Survival or Gauntlet.',
  },
  {
    id: 'endurance_100',
    category: 'Endurance',
    name: 'Master of the Gauntlet',
    description: 'Reach question 100 in Survival or Gauntlet.',
  },

  { id: 'speed_1000', category: 'Speed', name: 'Quickdraw', description: 'Score 1,000+ points in a single Blitz run.' },
  {
    id: 'speed_3000',
    category: 'Speed',
    name: 'Lightning Reflexes',
    description: 'Score 3,000+ points in a single Blitz run.',
  },
  {
    id: 'speed_6000',
    category: 'Speed',
    name: 'Speed of Light',
    description: 'Score 6,000+ points in a single Blitz run.',
  },

  {
    id: 'explorer_all_categories',
    category: 'Explorer',
    name: 'Well-Rounded',
    description: 'Complete a run in every category.',
  },
  {
    id: 'explorer_books',
    category: 'Explorer',
    name: 'Bookworm',
    description: 'Complete a run using Books-only canon.',
  },
  {
    id: 'explorer_movies',
    category: 'Explorer',
    name: 'Cinephile',
    description: 'Complete a run using Movies-only canon.',
  },

  {
    id: 'dedication_3',
    category: 'Dedication',
    name: 'Creature of Habit',
    description: 'Play the Daily Challenge on 3 different days.',
  },
  {
    id: 'dedication_7',
    category: 'Dedication',
    name: 'Weekly Regular',
    description: 'Play the Daily Challenge on 7 different days.',
  },
  {
    id: 'dedication_30',
    category: 'Dedication',
    name: 'Daily Devotee',
    description: 'Play the Daily Challenge on 30 different days.',
  },

  { id: 'social_friend', category: 'Social', name: 'Owl Post', description: 'Add your first friend.' },
  { id: 'social_duel', category: 'Social', name: 'Duelist', description: 'Complete your first duel.' },
  { id: 'social_duel_wins_5', category: 'Social', name: 'Duel Champion', description: 'Win 5 duels.' },
  { id: 'social_friends_10', category: 'Social', name: 'Well Connected', description: 'Have 10 friends.' },
  {
    id: 'duel_win_streak_3',
    category: 'Social',
    name: 'Hot Streak',
    description: 'Win 3 duels in a row.',
  },
  {
    id: 'duel_win_streak_5',
    category: 'Social',
    name: 'Reigning Champion',
    description: 'Win 5 duels in a row.',
  },

  // Distinct from dedication_7/30 (distinct *Daily Challenge* days played) — these track a
  // day-streak across ANY mode, so reusing the dedication_* name would conflate two different
  // stats under one badge.
  {
    id: 'consistency_streak_7',
    category: 'Dedication',
    name: 'Habit Forming',
    description: 'Play on 7 consecutive days.',
  },
  {
    id: 'consistency_streak_30',
    category: 'Dedication',
    name: 'Creature of Habit',
    description: 'Play on 30 consecutive days.',
  },

  {
    id: 'social_challenge_creator',
    category: 'Social',
    name: 'Setting the Test',
    description: 'Create a private challenge link.',
  },
  {
    id: 'social_challenge_group',
    category: 'Social',
    name: 'Study Group',
    description: '3 or more players complete one of your challenge links.',
  },
];
