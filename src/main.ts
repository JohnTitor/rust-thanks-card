import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import * as core from "@actions/core";

const DEFAULT_OUTPUT_PATH = "rust-thanks-card.svg";
const THANKS_URL =
	"https://raw.githubusercontent.com/rust-lang/thanks/gh-pages/rust/all-time/index.html";
const DEFAULT_COMMIT_MESSAGE = "Update Rust Thanks card";
const DEFAULT_GIT_USER_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com";
const DEFAULT_GIT_USER_NAME = "github-actions[bot]";

const execFileAsync = promisify(execFile);

const THEMES = {
	light: {
		accent: "#b7410e",
		accentSoft: "#f8d9c2",
		avatarBackground: "#f4ede8",
		backgroundEnd: "#fef7f0",
		backgroundStart: "#fffdf9",
		badgeColor: "orange",
		border: "#ead9ca",
		label: "#9a3412",
		surface: "#ffffff",
		text: "#2c1810",
	},
	rust: {
		accent: "#f97316",
		accentSoft: "#fdba74",
		avatarBackground: "#431407",
		backgroundEnd: "#7c2d12",
		backgroundStart: "#1c1917",
		badgeColor: "orange",
		border: "#7c2d12",
		label: "#fdba74",
		surface: "#292524",
		text: "#fafaf9",
	},
	slate: {
		accent: "#38bdf8",
		accentSoft: "#bae6fd",
		avatarBackground: "#082f49",
		backgroundEnd: "#0f172a",
		backgroundStart: "#1e293b",
		badgeColor: "0ea5e9",
		border: "#334155",
		label: "#7dd3fc",
		surface: "#111827",
		text: "#e5eef8",
	},
} as const;

type ThemeName = keyof typeof THEMES;
type Format = "badge" | "both" | "svg";

type ActionConfig = {
	avatarUrl: string;
	commitChanges: boolean;
	commitMessage: string;
	format: Format;
	gitUserEmail: string;
	gitUserName: string;
	name: string;
	outputPath: string;
	readmeMarker: string;
	readmePath: string;
	subtitle: string;
	theme: ThemeName;
	title: string;
	writeReadme: boolean;
};

export type RustThanksStats = {
	contributions: number;
	name: string;
	ordinalRank: string;
	rank: number;
};

type RenderContext = {
	avatarDataUrl?: string;
	stats: RustThanksStats;
	subtitle: string;
	theme: ThemeName;
	title: string;
};

type ActionResult = {
	badgeUrl: string;
	commitSha?: string;
	committed?: boolean;
	readmePath?: string;
	readmeSnippet?: string;
	svg?: string;
	svgPath?: string;
};

async function run(): Promise<void> {
	try {
		const config = readConfig();
		const html = await fetchRustThanksPage();
		const stats = extractStats(html, config.name);
		const result: ActionResult = {
			badgeUrl: genBadgeURL(stats, config.theme),
		};

		if (config.format === "svg" || config.format === "both") {
			const svg = renderSvg({
				avatarDataUrl: await fetchAvatarDataUrl(config.avatarUrl),
				stats,
				subtitle: config.subtitle,
				theme: config.theme,
				title: config.title,
			});
			result.svg = svg;
			result.svgPath = await writeSvg(svg, config.outputPath);
		}

		if (config.writeReadme) {
			const readmeSnippet = await updateReadme(config, result);
			result.readmePath = resolveWorkspacePath(config.readmePath);
			result.readmeSnippet = readmeSnippet;
		}

		await maybeCommitChanges(config, result);
		setOutputs(stats, result);
		await writeSummary(stats, result);
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(error.message);
			return;
		}
		core.setFailed(String(error));
	}
}

function readConfig(): ActionConfig {
	const formatInput = core.getInput("format").trim().toLowerCase();
	if (!isFormat(formatInput)) {
		throw new Error(`Unsupported format "${formatInput}". Expected one of: badge, svg, both.`);
	}

	const themeInput = core.getInput("theme").trim().toLowerCase();
	if (!isTheme(themeInput)) {
		throw new Error(
			`Unsupported theme "${themeInput}". Expected one of: ${Object.keys(THEMES).join(", ")}.`,
		);
	}

	const name = core.getInput("name").trim();
	if (name === "") {
		throw new Error("The name input must not be empty.");
	}

	const outputPath = core.getInput("output-path").trim();

	return {
		avatarUrl: core.getInput("avatar-url").trim(),
		commitChanges: core.getBooleanInput("commit-changes"),
		commitMessage: core.getInput("commit-message").trim() || DEFAULT_COMMIT_MESSAGE,
		format: formatInput,
		gitUserEmail: core.getInput("git-user-email").trim() || DEFAULT_GIT_USER_EMAIL,
		gitUserName: core.getInput("git-user-name").trim() || DEFAULT_GIT_USER_NAME,
		name,
		outputPath,
		readmeMarker: core.getInput("readme-marker").trim(),
		readmePath: core.getInput("readme-path").trim(),
		subtitle: core.getInput("subtitle").trim(),
		theme: themeInput,
		title: core.getInput("title").trim(),
		writeReadme: core.getBooleanInput("write-readme"),
	};
}

function isFormat(value: string): value is Format {
	return value === "badge" || value === "both" || value === "svg";
}

function isTheme(value: string): value is ThemeName {
	return value in THEMES;
}

async function fetchRustThanksPage(): Promise<string> {
	const response = await fetch(THANKS_URL);
	if (!response.ok) {
		throw new Error(`Failed to fetch Rust Thanks list: ${response.status} ${response.statusText}`);
	}

	return await response.text();
}

export function extractStats(html: string, grepName: string): RustThanksStats {
	const rows = html.match(/<tr>(.*?)<\/tr>/gs);
	if (!rows) {
		throw new Error("No rows found in Rust Thanks HTML.");
	}

	for (const row of rows) {
		const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(([, cell]) =>
			decodeHtml(cell.replace(/<[^>]+>/g, "").trim()),
		);
		if (cells.length < 3) {
			continue;
		}

		const [rankCell, nameCell, contributionsCell] = cells;
		if (nameCell !== grepName) {
			continue;
		}

		const rank = Number(rankCell.replaceAll(",", ""));
		const contributions = Number(contributionsCell.replaceAll(",", ""));
		if (Number.isNaN(rank) || Number.isNaN(contributions)) {
			throw new Error(`Found ${grepName}, but the row structure was unexpected.`);
		}

		return {
			contributions,
			name: nameCell,
			ordinalRank: toOrdinal(rank),
			rank,
		};
	}

	throw new Error(`${grepName} was not found in Rust Thanks.`);
}

function decodeHtml(value: string): string {
	return value
		.replaceAll("&amp;", "&")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'");
}

export function toOrdinal(rank: number): string {
	const remainder100 = rank % 100;
	if (remainder100 >= 11 && remainder100 <= 13) {
		return `${rank}th`;
	}

	switch (rank % 10) {
		case 1:
			return `${rank}st`;
		case 2:
			return `${rank}nd`;
		case 3:
			return `${rank}rd`;
		default:
			return `${rank}th`;
	}
}

export function genBadgeURL(
	stats: Pick<RustThanksStats, "contributions" | "ordinalRank">,
	theme: ThemeName,
): string {
	const label = encodeURIComponent("Rust Thanks");
	const message = encodeURIComponent(
		`${stats.contributions.toLocaleString("en-US")} contributions, ${stats.ordinalRank}`,
	);
	return `https://img.shields.io/badge/${label}-${message}-${THEMES[theme].badgeColor}?logo=rust`;
}

async function fetchAvatarDataUrl(url: string): Promise<string | undefined> {
	if (url === "") {
		return undefined;
	}

	const response = await fetch(url);
	if (!response.ok) {
		core.warning(
			`Failed to fetch avatar image: ${response.status} ${response.statusText}. Continuing without avatar.`,
		);
		return undefined;
	}

	const mediaType = response.headers.get("content-type")?.split(";")[0].trim() || "image/png";
	const bytes = Buffer.from(await response.arrayBuffer());
	return `data:${mediaType};base64,${bytes.toString("base64")}`;
}

export function renderSvg({ avatarDataUrl, stats, subtitle, theme, title }: RenderContext): string {
	const palette = THEMES[theme];
	const safeTitle = escapeXml(title);
	const safeSubtitle = escapeXml(subtitle);
	const safeName = escapeXml(stats.name);
	const contributions = stats.contributions.toLocaleString("en-US");
	const avatarMarkup = avatarDataUrl
		? `<image href="${escapeAttribute(avatarDataUrl)}" x="52" y="68" width="96" height="96" clip-path="url(#avatar-clip)" preserveAspectRatio="xMidYMid slice" />`
		: `<text x="100" y="131" text-anchor="middle" font-size="42" font-weight="700" fill="${palette.text}" font-family="ui-sans-serif, system-ui, sans-serif">${escapeXml(stats.name.slice(0, 1).toUpperCase())}</text>`;

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="640" height="320" viewBox="0 0 640 320" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
<title id="title">${safeTitle}</title>
<desc id="desc">${safeName} has ${contributions} Rust contributions and is ranked ${stats.ordinalRank}.</desc>
<defs>
<linearGradient id="bg" x1="40" y1="24" x2="600" y2="296" gradientUnits="userSpaceOnUse">
<stop stop-color="${palette.backgroundStart}" />
<stop offset="1" stop-color="${palette.backgroundEnd}" />
</linearGradient>
<clipPath id="avatar-clip">
<circle cx="100" cy="116" r="48" />
</clipPath>
</defs>
<rect x="16" y="16" width="608" height="288" rx="28" fill="url(#bg)" />
<rect x="32" y="32" width="576" height="256" rx="22" fill="${palette.surface}" fill-opacity="0.22" stroke="${palette.border}" />
<rect x="48" y="48" width="104" height="136" rx="24" fill="${palette.avatarBackground}" />
${avatarMarkup}
<rect x="472" y="48" width="120" height="38" rx="19" fill="${palette.accent}" />
<text x="532" y="72" text-anchor="middle" font-size="18" font-weight="700" fill="${palette.surface}" font-family="ui-sans-serif, system-ui, sans-serif">${stats.ordinalRank}</text>
<text x="184" y="86" font-size="22" font-weight="600" fill="${palette.label}" font-family="ui-sans-serif, system-ui, sans-serif">${safeTitle}</text>
<text x="184" y="121" font-size="40" font-weight="800" fill="${palette.text}" font-family="ui-sans-serif, system-ui, sans-serif">${safeName}</text>
<text x="184" y="149" font-size="18" fill="${palette.text}" fill-opacity="0.82" font-family="ui-sans-serif, system-ui, sans-serif">${safeSubtitle}</text>
<rect x="184" y="188" width="184" height="72" rx="18" fill="${palette.surface}" fill-opacity="0.35" stroke="${palette.border}" />
<rect x="384" y="188" width="176" height="72" rx="18" fill="${palette.surface}" fill-opacity="0.35" stroke="${palette.border}" />
<text x="208" y="214" font-size="14" font-weight="700" fill="${palette.label}" font-family="ui-sans-serif, system-ui, sans-serif">CONTRIBUTIONS</text>
<text x="208" y="244" font-size="30" font-weight="800" fill="${palette.text}" font-family="ui-sans-serif, system-ui, sans-serif">${contributions}</text>
<text x="408" y="214" font-size="14" font-weight="700" fill="${palette.label}" font-family="ui-sans-serif, system-ui, sans-serif">RANK</text>
<text x="408" y="244" font-size="30" font-weight="800" fill="${palette.text}" font-family="ui-sans-serif, system-ui, sans-serif">${stats.ordinalRank}</text>
<circle cx="562" cy="238" r="11" fill="${palette.accent}" fill-opacity="0.95" />
<circle cx="533" cy="238" r="7" fill="${palette.accentSoft}" />
</svg>`;
}

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

function escapeAttribute(value: string): string {
	return escapeXml(value);
}

async function writeSvg(svg: string, outputPathInput: string): Promise<string> {
	const outputPath = outputPathInput === "" ? DEFAULT_OUTPUT_PATH : outputPathInput;
	const absoluteOutputPath = resolveWorkspacePath(outputPath);
	await mkdir(dirname(absoluteOutputPath), { recursive: true });
	await writeFile(absoluteOutputPath, svg, "utf8");
	core.info(`Wrote SVG card to ${absoluteOutputPath}`);
	return absoluteOutputPath;
}

async function updateReadme(config: ActionConfig, result: ActionResult): Promise<string> {
	if (config.readmePath === "") {
		throw new Error("readme-path must not be empty when write-readme is enabled.");
	}

	const readmePath = resolveWorkspacePath(config.readmePath);
	const snippet = buildReadmeSnippet(config, result, readmePath);
	const content = await readFile(readmePath, "utf8");
	const updated = replaceMarkedSection(content, config.readmeMarker, snippet);
	await writeFile(readmePath, updated, "utf8");
	core.info(`Updated README marker block in ${readmePath}`);
	return snippet;
}

export function buildReadmeSnippet(
	config: Pick<ActionConfig, "format">,
	result: Pick<ActionResult, "badgeUrl" | "svgPath">,
	readmePath: string,
): string {
	if (config.format === "badge") {
		return `![Rust Thanks badge](${result.badgeUrl})`;
	}

	if (!result.svgPath) {
		throw new Error(
			`A generated SVG path is required to update README when format is "${config.format}".`,
		);
	}

	const snippetPath = toMarkdownPath(
		relative(dirname(readmePath), result.svgPath) || result.svgPath,
	);
	return `![Rust Thanks card](${snippetPath})`;
}

export function replaceMarkedSection(content: string, marker: string, snippet: string): string {
	const start = `<!--START_SECTION:${marker}-->`;
	const end = `<!--END_SECTION:${marker}-->`;
	const pattern = new RegExp(`(${escapeRegExp(start)})[\\s\\S]*?(${escapeRegExp(end)})`);

	if (!pattern.test(content)) {
		throw new Error(`README marker block ${start} ... ${end} was not found.`);
	}

	return content.replace(pattern, `$1\n${snippet}\n$2`);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toMarkdownPath(value: string): string {
	const normalized = value.replaceAll("\\", "/");
	if (normalized.startsWith("../") || normalized.startsWith("./")) {
		return normalized;
	}
	return normalized.startsWith("/") ? normalized : `./${normalized}`;
}

function resolveWorkspacePath(inputPath: string): string {
	if (inputPath === "") {
		throw new Error("A required path input was empty.");
	}

	if (isAbsolute(inputPath)) {
		return inputPath;
	}

	return resolve(process.env.GITHUB_WORKSPACE || process.cwd(), inputPath);
}

export function collectCommitPaths(
	result: Pick<ActionResult, "readmePath" | "svgPath">,
	workspaceRoot: string,
): string[] {
	const commitPaths = new Set<string>();
	for (const path of [result.svgPath, result.readmePath]) {
		if (!path) {
			continue;
		}

		const relativePath = relative(workspaceRoot, path);
		if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
			throw new Error(
				`Cannot commit ${path} because it is outside the workspace root ${workspaceRoot}.`,
			);
		}

		commitPaths.add(relativePath.replaceAll("\\", "/"));
	}

	return [...commitPaths];
}

async function maybeCommitChanges(
	config: Pick<ActionConfig, "commitChanges" | "commitMessage" | "gitUserEmail" | "gitUserName">,
	result: ActionResult,
): Promise<void> {
	if (!config.commitChanges) {
		return;
	}

	const workspaceRoot = process.env.GITHUB_WORKSPACE || process.cwd();
	const commitPaths = collectCommitPaths(result, workspaceRoot);
	if (commitPaths.length === 0) {
		core.info("Skipping commit because the action did not write any local files.");
		result.committed = false;
		return;
	}

	await execFileAsync("git", ["config", "user.name", config.gitUserName], {
		cwd: workspaceRoot,
	});
	await execFileAsync("git", ["config", "user.email", config.gitUserEmail], {
		cwd: workspaceRoot,
	});
	await execFileAsync("git", ["add", "--", ...commitPaths], {
		cwd: workspaceRoot,
	});

	const { stdout } = await execFileAsync(
		"git",
		["diff", "--cached", "--name-only", "--", ...commitPaths],
		{
			cwd: workspaceRoot,
		},
	);
	if (stdout.trim() === "") {
		core.info("Skipping commit because there are no staged changes.");
		result.committed = false;
		return;
	}

	await execFileAsync("git", ["commit", "-m", config.commitMessage], {
		cwd: workspaceRoot,
	});
	const commitResult = await execFileAsync("git", ["rev-parse", "HEAD"], {
		cwd: workspaceRoot,
	});
	result.commitSha = commitResult.stdout.trim();
	result.committed = true;
	core.info(`Committed generated files at ${result.commitSha}`);
}

function setOutputs(stats: RustThanksStats, result: ActionResult): void {
	core.setOutput("name", stats.name);
	core.setOutput("rank", String(stats.rank));
	core.setOutput("ordinal-rank", stats.ordinalRank);
	core.setOutput("contributions", String(stats.contributions));
	core.setOutput("badge-url", result.badgeUrl);
	core.setOutput("committed", result.committed ? "true" : "false");

	if (result.svg) {
		core.setOutput("svg", result.svg);
	}
	if (result.svgPath) {
		core.setOutput("svg-path", result.svgPath);
	}
	if (result.readmeSnippet) {
		core.setOutput("readme-snippet", result.readmeSnippet);
	}
	if (result.commitSha) {
		core.setOutput("commit-sha", result.commitSha);
	}
}

async function writeSummary(stats: RustThanksStats, result: ActionResult): Promise<void> {
	if (!process.env.GITHUB_STEP_SUMMARY) {
		core.info("Skipping job summary because GITHUB_STEP_SUMMARY is not set.");
		return;
	}

	await core.summary
		.addHeading("Rust Thanks")
		.addTable([
			[
				{ data: "Name", header: true },
				{ data: "Contributions", header: true },
				{ data: "Rank", header: true },
			],
			[stats.name, stats.contributions.toLocaleString("en-US"), stats.ordinalRank],
		])
		.addRaw(`Badge URL: ${result.badgeUrl}`, true);

	if (result.svgPath) {
		core.summary.addRaw(`SVG path: ${result.svgPath}`, true);
	}
	if (result.readmeSnippet) {
		core.summary.addCodeBlock(result.readmeSnippet, "md");
	}
	if (result.committed && result.commitSha) {
		core.summary.addRaw(`Commit SHA: ${result.commitSha}`, true);
	}

	await core.summary.write();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	void run();
}
