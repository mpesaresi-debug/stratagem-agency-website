#!/usr/bin/env node
/**
 * Generates print-ready QR codes for event landing pages.
 *
 *   npm run qr
 *
 * Edit scripts/qr.config.json to add an event — no code changes needed. Each
 * event produces one QR per "surface" (badge, button, business card, ...), and
 * each surface gets its own utm_source, so /evolve tracking can tell you which
 * physical item people actually scanned:
 *
 *   SELECT utm_source, COUNT(*) FROM evolve_page_views GROUP BY utm_source;
 *
 * Output goes to qr/<event-slug>/ as both SVG (vector — use this for print)
 * and PNG (raster — use this for slides and email).
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const configPath = join(here, 'qr.config.json');
const outRoot = join(repoRoot, 'qr');

/** Build the tracked URL for one surface of one event. */
function buildUrl(baseUrl, event, surface, defaults) {
	const url = new URL(event.path, baseUrl);
	url.searchParams.set('utm_source', surface);
	url.searchParams.set('utm_medium', event.utm_medium ?? defaults.utm_medium);
	url.searchParams.set('utm_campaign', event.utm_campaign);
	if (event.utm_content) url.searchParams.set('utm_content', event.utm_content);
	return url.toString();
}

async function main() {
	const config = JSON.parse(await readFile(configPath, 'utf8'));
	const { baseUrl, defaults, events } = config;

	if (!events?.length) {
		console.error('No events in scripts/qr.config.json — nothing to generate.');
		process.exitCode = 1;
		return;
	}

	const rows = [];

	for (const event of events) {
		const dir = join(outRoot, event.slug);
		await mkdir(dir, { recursive: true });

		const surfaces = event.surfaces?.length ? event.surfaces : ['qr'];

		for (const surface of surfaces) {
			const url = buildUrl(baseUrl, event, surface, defaults);
			const opts = {
				errorCorrectionLevel: event.errorCorrectionLevel ?? defaults.errorCorrectionLevel,
				// 4 modules is the spec-minimum quiet zone. Scanners need it —
				// do not trim this to make the code look tighter on artwork.
				margin: 4,
				color: {
					dark: event.darkColor ?? defaults.darkColor,
					light: event.lightColor ?? defaults.lightColor,
				},
			};

			const base = `${event.slug}-${surface}`;
			const svg = await QRCode.toString(url, { ...opts, type: 'svg' });
			await writeFile(join(dir, `${base}.svg`), svg, 'utf8');
			await QRCode.toFile(join(dir, `${base}.png`), url, {
				...opts,
				type: 'png',
				width: event.pngWidth ?? defaults.pngWidth,
			});

			rows.push({ event: event.label, surface, url, file: `qr/${event.slug}/${base}` });
		}

		// A plain, untracked version — for anywhere a UTM would be misleading.
		const cleanUrl = new URL(event.path, baseUrl).toString();
		const cleanSvg = await QRCode.toString(cleanUrl, {
			errorCorrectionLevel: event.errorCorrectionLevel ?? defaults.errorCorrectionLevel,
			margin: 4,
			type: 'svg',
			color: {
				dark: event.darkColor ?? defaults.darkColor,
				light: event.lightColor ?? defaults.lightColor,
			},
		});
		await writeFile(join(dir, `${event.slug}-plain.svg`), cleanSvg, 'utf8');
		rows.push({
			event: event.label,
			surface: 'plain (no tracking)',
			url: cleanUrl,
			file: `qr/${event.slug}/${event.slug}-plain`,
		});
	}

	const pad = (s, n) => String(s).padEnd(n);
	const wSurface = Math.max(...rows.map((r) => r.surface.length), 7);
	const wFile = Math.max(...rows.map((r) => r.file.length), 4);

	console.log(`\nGenerated ${rows.length} QR code${rows.length === 1 ? '' : 's'} in qr/\n`);
	console.log(`  ${pad('SURFACE', wSurface)}  ${pad('FILE', wFile)}  URL`);
	console.log(`  ${'-'.repeat(wSurface)}  ${'-'.repeat(wFile)}  ---`);
	for (const r of rows) {
		console.log(`  ${pad(r.surface, wSurface)}  ${pad(r.file, wFile)}  ${r.url}`);
	}
	console.log('\n  SVG for print, PNG for screens. Test-scan before sending to a printer.\n');
}

main().catch((err) => {
	console.error('QR generation failed:', err);
	process.exit(1);
});
