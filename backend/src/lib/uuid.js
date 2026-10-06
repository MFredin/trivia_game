// An id taken from a URL has to be checked before it reaches a query: Postgres refuses a malformed UUID (or integer)
// with an error, which would surface as a 500 for what is really "there is no such thing". Routes answer 404 instead,
// the same as for an id that is well-formed but absent.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value) => typeof value === 'string' && UUID.test(value);
