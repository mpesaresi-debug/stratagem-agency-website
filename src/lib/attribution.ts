/**
 * Turns a raw HTTP referrer into a readable lead source.
 *
 * The motivating case is AI assistants: when someone asks ChatGPT or Perplexity
 * for an affiliate agency and clicks a citation, the visit arrives with that
 * host as the referrer. Google Search Console reports Google's own AI surfaces
 * (AI Overviews, AI Mode) but is structurally blind to these, so the referrer is
 * the only place they ever show up.
 */

export type SourceKind =
	| 'ai_assistant'
	| 'search'
	| 'social'
	| 'referral'
	| 'internal'
	| 'direct';

export interface Attribution {
	referrerHost: string | null;
	sourceLabel: string;
	sourceKind: SourceKind;
}

/** Host suffix → display name. Matched against the host and its parent domains. */
const AI_ASSISTANTS: Record<string, string> = {
	'chatgpt.com': 'ChatGPT',
	'chat.openai.com': 'ChatGPT',
	'openai.com': 'ChatGPT',
	'perplexity.ai': 'Perplexity',
	'claude.ai': 'Claude',
	'gemini.google.com': 'Gemini',
	'bard.google.com': 'Gemini',
	'copilot.microsoft.com': 'Microsoft Copilot',
	'grok.com': 'Grok',
	'x.ai': 'Grok',
	'deepseek.com': 'DeepSeek',
	'chat.mistral.ai': 'Le Chat',
	'you.com': 'You.com',
	'phind.com': 'Phind',
	'poe.com': 'Poe',
	'andisearch.com': 'Andi',
};

const SEARCH_ENGINES: Record<string, string> = {
	'google.com': 'Google',
	'bing.com': 'Bing',
	'duckduckgo.com': 'DuckDuckGo',
	'ecosia.org': 'Ecosia',
	'yahoo.com': 'Yahoo',
	'yandex.com': 'Yandex',
	'baidu.com': 'Baidu',
	'brave.com': 'Brave Search',
	'startpage.com': 'Startpage',
};

const SOCIAL: Record<string, string> = {
	'linkedin.com': 'LinkedIn',
	'lnkd.in': 'LinkedIn',
	'facebook.com': 'Facebook',
	'instagram.com': 'Instagram',
	'x.com': 'X',
	'twitter.com': 'X',
	't.co': 'X',
	'youtube.com': 'YouTube',
	'reddit.com': 'Reddit',
	'news.ycombinator.com': 'Hacker News',
};

/** Our own hosts — a referrer from these means internal navigation, not a source. */
const OWN_HOSTS = ['stratagem.agency'];

/**
 * `www.google.com` should match the `google.com` entry, so walk the host from
 * most to least specific rather than relying on an exact key hit.
 */
function lookup(host: string, table: Record<string, string>): string | null {
	const parts = host.split('.');
	for (let i = 0; i < parts.length - 1; i++) {
		const candidate = parts.slice(i).join('.');
		if (table[candidate]) return table[candidate];
	}
	return null;
}

function matchesOwnHost(host: string): boolean {
	return OWN_HOSTS.some((own) => host === own || host.endsWith(`.${own}`));
}

/**
 * Google's AI surfaces are indistinguishable from plain organic Google in the
 * referrer — both arrive as google.com. They are separated in Search Console's
 * generative AI report instead, never here.
 */
export function classifyReferrer(referrer: string | null | undefined): Attribution {
	if (!referrer || !referrer.trim()) {
		return { referrerHost: null, sourceLabel: 'Direct', sourceKind: 'direct' };
	}

	let host: string;
	try {
		host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
	} catch {
		// Not a parseable URL — keep the raw value visible rather than dropping it.
		return {
			referrerHost: null,
			sourceLabel: referrer.slice(0, 80),
			sourceKind: 'referral',
		};
	}

	if (matchesOwnHost(host)) {
		return { referrerHost: host, sourceLabel: 'Internal', sourceKind: 'internal' };
	}

	const ai = lookup(host, AI_ASSISTANTS);
	if (ai) return { referrerHost: host, sourceLabel: ai, sourceKind: 'ai_assistant' };

	const search = lookup(host, SEARCH_ENGINES);
	if (search) return { referrerHost: host, sourceLabel: search, sourceKind: 'search' };

	const social = lookup(host, SOCIAL);
	if (social) return { referrerHost: host, sourceLabel: social, sourceKind: 'social' };

	return { referrerHost: host, sourceLabel: host, sourceKind: 'referral' };
}

/**
 * An explicit utm_source wins over the referrer — if we tagged the link, we know
 * better than the browser does. Keeps the referrer classification as fallback.
 */
export function resolveSource(
	referrer: string | null | undefined,
	utmSource: string | null | undefined,
	utmMedium: string | null | undefined
): Attribution {
	const fromReferrer = classifyReferrer(referrer);
	if (!utmSource) return fromReferrer;

	const normalized = utmSource.trim().toLowerCase();
	const known = lookup(normalized, AI_ASSISTANTS) ?? lookup(`${normalized}.com`, AI_ASSISTANTS);

	return {
		referrerHost: fromReferrer.referrerHost,
		sourceLabel: known ?? utmSource.trim().slice(0, 80),
		sourceKind: known
			? 'ai_assistant'
			: utmMedium?.toLowerCase() === 'organic'
				? 'search'
				: 'referral',
	};
}
