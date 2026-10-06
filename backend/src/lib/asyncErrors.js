import Layer from 'express/lib/router/layer.js';

/**
 * Makes Express 4 treat a rejected promise from a route handler like a thrown error.
 *
 * Express 4 only catches errors thrown synchronously. A handler written `async (req, res) => { await db… }` that
 * fails returns a rejected promise nobody is listening to, and on current Node an unhandled rejection ends the
 * process: one database hiccup in a route with no try/catch of its own would take the whole service down, and
 * Railway gives up restarting it after five tries. 79 of this app's 82 routes are async.
 *
 * The fix is the same one the `express-async-errors` package makes, kept here as a dozen lines instead of a
 * dependency that is no longer maintained: wrap how a layer calls its handler so a returned promise's rejection
 * goes to `next(err)`, and so reaches the error handler in lib/errors.js. Express 5 does this natively; delete this
 * file when the app moves to it.
 *
 * Import it once, before any route is defined (app.js does). It touches Express's internals, so
 * test/errorHandling.test.js exists to fail loudly if an Express upgrade changes them.
 */
if (!Layer.prototype.handle_request.__asyncAware) {
  const original = Layer.prototype.handle_request;

  Layer.prototype.handle_request = function handleRequest(req, res, next) {
    const handler = this.handle;
    // Error-handling middleware (four arguments) is not a request handler; leave it to Express.
    if (handler.length > 3) return original.call(this, req, res, next);
    try {
      const result = handler(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
    return undefined;
  };
  Layer.prototype.handle_request.__asyncAware = true;
}
