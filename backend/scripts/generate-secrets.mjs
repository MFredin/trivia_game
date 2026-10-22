// Prints a fresh value for each of the two signing secrets, to paste into the host's environment (docs/secret-rotation.md). Nothing is stored or sent
// anywhere: the values exist only in this terminal. Run it, set them, and clear the screen.
import { generateSecret } from '../src/lib/secretPolicy.js';

console.log(`AUTH_TOKEN_SECRET=${generateSecret()}`);
console.log(`QUESTION_TOKEN_SECRET=${generateSecret()}`);
console.error('\nEach is 32 random bytes. Set both on the API service, then redeploy. Every player is signed out and any question in progress needs a restart.');
