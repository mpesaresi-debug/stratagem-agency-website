/**
 * One-way visitor fingerprint, shared by the page-view logger and the contact
 * form so a lead can be joined back to the view that brought the visitor in.
 *
 * SHA-256 of IP + user agent + today's date + a salt, truncated. It rotates
 * daily and cannot be reversed to an IP, so no address is ever stored. Both
 * inputs are headers the browser sends anyway — nothing is read from or written
 * to the visitor's device, which is what keeps the site free of a consent
 * banner.
 *
 * Mirrors the original implementation in src/pages/api/evolve-view.ts. That one
 * uses its own salt so the EVOLVE badge-scan counts stay a separate namespace.
 */
const SALT = 'stratagem-attribution-v1';

export async function visitorHash(ip: string, userAgent: string): Promise<string | null> {
	if (!ip && !userAgent) return null;
	const day = new Date().toISOString().slice(0, 10);
	const data = new TextEncoder().encode(`${ip}|${userAgent}|${day}|${SALT}`);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(digest))
		.slice(0, 8)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/** Pull the pieces the hash needs out of a Cloudflare request. */
export function hashInputs(request: Request): { ip: string; userAgent: string } {
	return {
		ip: request.headers.get('cf-connecting-ip') ?? '',
		userAgent: request.headers.get('user-agent') ?? '',
	};
}
