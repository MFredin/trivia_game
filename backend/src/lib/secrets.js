// Loads the two secrets that sign everything the server trusts a client to hand back, and refuses to start without good ones. They live in the host's
// environment and nowhere else, which is exactly why they are worth rotating when that environment may have been read (docs/secret-rotation.md). The
// rules are in lib/secretPolicy.js; a server that cannot meet them throws here, which on Railway leaves the previous deployment serving rather than a
// weak one.

import 'dotenv/config';
import { secretProblems } from './secretPolicy.js';

const problems = secretProblems(process.env);
if (problems.length) throw new Error(problems.join('; '));

export const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET;
export const QUESTION_TOKEN_SECRET = process.env.QUESTION_TOKEN_SECRET;
