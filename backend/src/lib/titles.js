// Titles: a short label a player can wear beside their name. Deploy-time content, the same pattern as
// ACHIEVEMENTS and MODES. Two kinds, and the difference is who decides:
//
//   earned  — unlocked by an achievement (`requires`), so a player has it as soon as they have earned
//             that and never needs anyone's say-so. Extending this list means extending the
//             achievements (lib/achievements.js) it hangs on.
//   system  — granted by an admin to a specific player (services/titles.js), and nothing else grants it.
//             These are labels, not powers: wearing "Prefect" lets nobody do anything.
//
// The words are generic school and library terms, not licensed names or marks.
export const TITLES = [
  { id: 'newcomer', kind: 'earned', name: 'Newcomer', requires: 'milestone_1' },
  { id: 'reader', kind: 'earned', name: 'Reader', requires: 'milestone_10' },
  { id: 'scholar', kind: 'earned', name: 'Scholar', requires: 'milestone_50' },
  { id: 'section_veteran', kind: 'earned', name: 'Section Veteran', requires: 'milestone_150' },
  { id: 'page_turner', kind: 'earned', name: 'Page Turner', requires: 'answers_100' },
  { id: 'archivist', kind: 'earned', name: 'Archivist', requires: 'answers_500' },
  { id: 'keeper_of_the_stacks', kind: 'earned', name: 'Keeper of the Stacks', requires: 'answers_2000' },
  { id: 'sharp_mind', kind: 'earned', name: 'Sharp Mind', requires: 'accuracy_90' },
  { id: 'flawless', kind: 'earned', name: 'Flawless', requires: 'mastery_flawless' },
  { id: 'perfectionist', kind: 'earned', name: 'Perfectionist', requires: 'mastery_flawless_10' },
  { id: 'newt_scholar', kind: 'earned', name: 'N.E.W.T. Scholar', requires: 'mastery_newt' },
  { id: 'inner_circle', kind: 'earned', name: 'Inner Circle', requires: 'mastery_phoenix' },
  { id: 'unshakeable', kind: 'earned', name: 'Unshakeable', requires: 'streak_20' },
  { id: 'legend', kind: 'earned', name: 'Legend', requires: 'streak_40' },
  { id: 'battle_hardened', kind: 'earned', name: 'Battle-Hardened', requires: 'endurance_50' },
  { id: 'gauntlet_master', kind: 'earned', name: 'Gauntlet Master', requires: 'endurance_100' },
  { id: 'quick_quill', kind: 'earned', name: 'Quick Quill', requires: 'speed_3000' },
  { id: 'lightning_quill', kind: 'earned', name: 'Lightning Quill', requires: 'speed_6000' },
  { id: 'polymath', kind: 'earned', name: 'Polymath', requires: 'explorer_all_categories' },
  { id: 'seasoned_scholar', kind: 'earned', name: 'Seasoned Scholar', requires: 'explorer_all_tiers' },
  { id: 'all_rounder', kind: 'earned', name: 'All-Rounder', requires: 'explorer_all_modes' },
  { id: 'daily_devotee', kind: 'earned', name: 'Daily Devotee', requires: 'dedication_30' },
  { id: 'perennial', kind: 'earned', name: 'Perennial', requires: 'dedication_100' },
  { id: 'creature_of_habit', kind: 'earned', name: 'Creature of Habit', requires: 'consistency_streak_30' },
  { id: 'duellist', kind: 'earned', name: 'Duellist', requires: 'social_duel_wins_5' },
  { id: 'reigning_champion', kind: 'earned', name: 'Reigning Champion', requires: 'duel_win_streak_5' },
  { id: 'grand_duellist', kind: 'earned', name: 'Grand Duellist', requires: 'social_duel_wins_25' },
  { id: 'community_pillar', kind: 'earned', name: 'Community Pillar', requires: 'social_friends_25' },
  { id: 'study_leader', kind: 'earned', name: 'Study Leader', requires: 'social_challenge_group' },
  { id: 'contributor', kind: 'earned', name: 'Contributor', requires: 'contrib_question_1' },
  { id: 'quizmaster', kind: 'earned', name: 'Quizmaster', requires: 'contrib_question_5' },

  // Granted by an admin, to a person. "Head Boy" and "Head Girl" are separate entries so whoever grants
  // one can choose the one that fits the person; "Head Student" is the neutral one.
  { id: 'head_student', kind: 'system', name: 'Head Student', description: 'Runs the place. Given to administrators.' },
  { id: 'head_boy', kind: 'system', name: 'Head Boy', description: 'Runs the place. Given to administrators.' },
  { id: 'head_girl', kind: 'system', name: 'Head Girl', description: 'Runs the place. Given to administrators.' },
  { id: 'prefect', kind: 'system', name: 'Prefect', description: 'Keeps order. Given to moderators.' },
  { id: 'librarian', kind: 'system', name: 'Librarian', description: 'Looks after the question bank. Given to question reviewers.' },
  { id: 'groundskeeper', kind: 'system', name: 'Groundskeeper', description: 'Looks after the community. Given to helpers.' },
];

export const TITLE_BY_ID = Object.fromEntries(TITLES.map((t) => [t.id, t]));
export const SYSTEM_TITLE_IDS = TITLES.filter((t) => t.kind === 'system').map((t) => t.id);

/** How a title travels on the wire next to a name: its id, its words and its kind. Null for none or unknown. */
export function titleView(id) {
  const t = id ? TITLE_BY_ID[id] : null;
  return t ? { id: t.id, name: t.name, kind: t.kind } : null;
}

/** The earned titles that `unlockedAchievementIds` (a Set) have unlocked. */
export function earnedTitleIds(unlockedAchievementIds) {
  return TITLES.filter((t) => t.kind === 'earned' && unlockedAchievementIds.has(t.requires)).map((t) => t.id);
}
