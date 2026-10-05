// The four obscurity tiers a question is graded in, easiest to hardest. The names are what players see in the
// difficulty slider and what questions.obscurity_tier stores, so a rename here is a data migration. The order is
// meaningful (it is the order of the slider), though a run filters to exactly one tier, not "up to" it.
export const OBSCURITY_TIERS = ['First Year', 'O.W.L.', 'N.E.W.T.', 'Order of the Phoenix'];
