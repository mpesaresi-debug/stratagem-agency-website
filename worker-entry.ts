/**
 * Worker entry point — logs entry-page views, then hands the request to Astro.
 *
 * Why this exists: the contact form can only see last-touch attribution. Someone
 * who clicks a ChatGPT citation into a blog post and then browses to /contact
 * submits with an internal referrer, so the AI origin is lost. Carrying first
 * touch across a navigation normally needs a cookie or sessionStorage — which
 * would oblige us to show a consent banner, the one thing this site avoids.
 *
 * So instead the *server* remembers. `assets.run_worker_first` in wrangler.json
 * routes entry pages through this Worker before the static asset is served; we
 * stamp the visit with a daily-rotating visitor hash and write it to D1, then
 * delegate. The HTML is still the prerendered file straight from Workers Assets
 * — nothing is re-rendered, and the D1 write happens in waitUntil, after the
 * response has gone out. Nothing is stored on the visitor's device.
 *
 * Joining page_views.visitor_hash to contact_submissions.visitor_hash then
 * answers "where did this lead originally come from".
 */

// @ts-ignore — generated during the build by the Astro Cloudflare adapter, so it
// has no types and does not exist at all until `astro build` has run.
import astroWorker from './dist/_worker.js/index.js';
import { classifyReferrer } from './src/lib/attribution';
import { hashInputs, visitorHash } from './src/lib/visitor';

interface Env {
	DB?: D1Database;
}

/** Trim so a crafted request cannot bloat the table. */
function clip(value: string | null, max: number): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Only real page views. Asset requests, API calls and prefetches would triple
 * the row count while telling us nothing about where a visitor came from.
 */
function isPageView(request: Request, url: URL): boolean {
	if (request.method !== 'GET') return false;
	if (!request.headers.get('accept')?.includes('text/html')) return false;
	if (url.pathname.startsWith('/api/')) return false;
	// Speculative loads are not visits — the person may never see the page.
	const purpose = request.headers.get('sec-purpose') ?? request.headers.get('purpose');
	if (purpose?.includes('prefetch')) return false;
	return true;
}

async function logPageView(request: Request, env: Env, url: URL): Promise<void> {
	if (!env.DB) return;

	const referrer = request.headers.get('referer');
	const attribution = classifyReferrer(referrer);

	// Internal navigation is not a source — logging it would bury the entry
	// referrer we actually care about under every subsequent click.
	if (attribution.sourceKind === 'internal') return;

	const { ip, userAgent } = hashInputs(request);
	const params = url.searchParams;

	try {
		await env.DB.prepare(
			`INSERT INTO page_views
			   (viewed_at, path, referrer, referrer_host, source_label, source_kind,
			    utm_source, utm_medium, utm_campaign, country, visitor_hash)
			 VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
			.bind(
				clip(url.pathname, 500),
				clip(referrer, 500),
				attribution.referrerHost,
				attribution.sourceLabel,
				attribution.sourceKind,
				clip(params.get('utm_source'), 120),
				clip(params.get('utm_medium'), 120),
				clip(params.get('utm_campaign'), 120),
				clip(request.headers.get('cf-ipcountry'), 8),
				await visitorHash(ip, userAgent)
			)
			.run();
	} catch (err) {
		// Attribution is never worth failing a page load over.
		console.error('[page-view] D1 insert failed', err);
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const response: Response = await astroWorker.fetch(request, env, ctx);

		try {
			const url = new URL(request.url);
			// Only after we know the request actually resolved to a page. Astro
			// redirects /blog/foo to /blog/foo/, and logging before delegating
			// would count that visit twice — once for the redirect, once for the
			// page it lands on. 404s are not visits either.
			if (response.status === 200 && isPageView(request, url)) {
				// waitUntil, so the D1 write never sits between the visitor and
				// their page.
				ctx.waitUntil(logPageView(request, env, url));
			}
		} catch (err) {
			console.error('[page-view] skipped', err);
		}

		return response;
	},
};
