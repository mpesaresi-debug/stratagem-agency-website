export const prerender = false;

import type { APIContext } from 'astro';

/**
 * Logs one view of the /evolve landing page to D1 (table: evolve_page_views).
 *
 * Called from the browser via navigator.sendBeacon, so the page itself stays
 * static and cacheable at the edge. Always answers 204 — a tracking failure
 * must never surface to a visitor standing at the booth.
 */

/** Trim to a sane length so a crafted request can't bloat the table. */
function clip(value: unknown, max: number): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * One-way visitor fingerprint: SHA-256 of IP + user agent + today's date + a
 * salt, truncated. Rotates daily and cannot be reversed to an IP.
 */
async function visitorHash(ip: string, userAgent: string): Promise<string | null> {
	if (!ip && !userAgent) return null;
	const day = new Date().toISOString().slice(0, 10);
	const data = new TextEncoder().encode(`${ip}|${userAgent}|${day}|evolve2026`);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(digest))
		.slice(0, 8)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export async function POST({ request, locals }: APIContext) {
	const noContent = new Response(null, { status: 204 });

	const db: D1Database | undefined = (locals as any).runtime?.env?.DB;
	if (!db) {
		console.error('[evolve-view] D1 binding DB is not available');
		return noContent;
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return noContent;
	}

	const ip = request.headers.get('cf-connecting-ip') ?? '';
	const userAgent = request.headers.get('user-agent') ?? '';
	const country =
		request.headers.get('cf-ipcountry') ?? (locals as any).runtime?.cf?.country ?? null;

	try {
		await db
			.prepare(
				`INSERT INTO evolve_page_views
				   (viewed_at, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
				    referrer, path, user_agent, country, language, visitor_hash)
				 VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				clip(body.utm_source, 120),
				clip(body.utm_medium, 120),
				clip(body.utm_campaign, 120),
				clip(body.utm_content, 120),
				clip(body.utm_term, 120),
				clip(body.referrer, 500),
				clip(body.path, 500),
				clip(userAgent, 400),
				clip(country, 8),
				clip(body.language, 20),
				await visitorHash(ip, userAgent)
			)
			.run();
	} catch (err) {
		console.error('[evolve-view] D1 insert failed', err);
	}

	return noContent;
}
