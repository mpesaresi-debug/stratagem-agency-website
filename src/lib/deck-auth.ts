/**
 * Basic-auth gate for the private deck at /deck.
 *
 * Why Basic auth and not a login form: this site deliberately sets no cookies
 * and no client storage, which is what lets it ship without a consent banner.
 * A session cookie would undo that for every visitor, not just the few who ever
 * open the deck. Basic auth is re-sent by the browser on each request and
 * stores nothing first-party, so the cookie-free guarantee holds.
 *
 * The password lives in the DECK_PASSWORD secret (`wrangler secret put
 * DECK_PASSWORD`). If the secret is absent the gate fails closed — an
 * unconfigured deploy serves 503, never the deck.
 */

/**
 * Paths behind the gate. Kept broad so assets under /deck are covered too, and
 * case-insensitive so the gate never depends on Workers Assets happening to
 * match case-sensitively — /DECK/index.html must hit the gate, not the 404.
 */
export function isDeckPath(pathname: string): boolean {
	const p = pathname.toLowerCase();
	return p === '/deck' || p.startsWith('/deck/');
}

/** Constant-time compare, so a wrong password cannot be found byte by byte. */
function safeEqual(a: string, b: string): boolean {
	const enc = new TextEncoder();
	const ab = enc.encode(a);
	const bb = enc.encode(b);
	// Compare a fixed number of bytes regardless of length, then fold the
	// length check in, so timing does not leak the secret's length either.
	const len = Math.max(ab.length, bb.length);
	let diff = ab.length ^ bb.length;
	for (let i = 0; i < len; i++) {
		diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
	}
	return diff === 0;
}

const UNAUTHORIZED_BODY =
	'<!doctype html><meta charset="utf-8"><title>Restricted</title>' +
	'<style>body{font:16px/1.6 system-ui,sans-serif;margin:15vh auto;max-width:32rem;padding:0 1.5rem;color:#101828}' +
	'h1{font-size:1.25rem;margin:0 0 .5rem}p{color:#475467;margin:0}</style>' +
	'<h1>This page is private</h1><p>Enter the credentials you were given to continue.</p>';

/**
 * Returns a Response when the request should be blocked, or null to let it
 * through. Callers must run this before serving anything under /deck.
 */
export function checkDeckAuth(request: Request, password: string | undefined): Response | null {
	if (!password) {
		// Fail closed rather than publishing the deck by accident.
		return new Response('Deck access is not configured.', {
			status: 503,
			headers: { 'cache-control': 'no-store' },
		});
	}

	const header = request.headers.get('authorization') ?? '';
	const [scheme, encoded] = header.split(' ');

	if (scheme === 'Basic' && encoded) {
		let decoded = '';
		try {
			decoded = atob(encoded);
		} catch {
			decoded = '';
		}
		// Only the password is checked; any username is accepted, so the link
		// can be shared as "user: anything, password: <secret>".
		const supplied = decoded.slice(decoded.indexOf(':') + 1);
		if (decoded.includes(':') && safeEqual(supplied, password)) {
			return null;
		}
	}

	return new Response(UNAUTHORIZED_BODY, {
		status: 401,
		headers: {
			'www-authenticate': 'Basic realm="Stratagem deck", charset="UTF-8"',
			'content-type': 'text/html; charset=utf-8',
			'cache-control': 'no-store',
			'x-robots-tag': 'noindex, nofollow',
		},
	});
}
