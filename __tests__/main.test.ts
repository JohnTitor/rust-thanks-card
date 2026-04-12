import { expect, test } from "vitest";
import {
	buildReadmeSnippet,
	buildAuthenticatedRemoteUrl,
	collectCommitPaths,
	extractStats,
	genBadgeURL,
	renderSvg,
	resolvePushBranch,
	replaceMarkedSection,
	toOrdinal,
} from "../src/main";

test("extract stats from Rust Thanks HTML", () => {
	const testHTML = `
  <table>
    <tbody>
      <tr>
        <td class="bn">11</td>
        <td class="bn">bors</td>
        <td class="bn">53863</td>
      </tr>
      <tr>
        <td>12</td>
        <td class="bn"><a href="https://github.com/bors" rel="nofollow">bors</a></td>
        <td class="bc">53863</td>
      </tr>
    </tbody>
  </table>
  `;

	expect(extractStats(testHTML, "bors")).toEqual({
		contributions: 53863,
		name: "bors",
		ordinalRank: "11th",
		rank: 11,
	});
});

test("format ordinal ranks correctly", () => {
	expect(toOrdinal(1)).toBe("1st");
	expect(toOrdinal(2)).toBe("2nd");
	expect(toOrdinal(3)).toBe("3rd");
	expect(toOrdinal(11)).toBe("11th");
	expect(toOrdinal(12)).toBe("12th");
	expect(toOrdinal(13)).toBe("13th");
	expect(toOrdinal(21)).toBe("21st");
});

test("generate a badge URL", () => {
	expect(
		genBadgeURL(
			{
				contributions: 40782,
				ordinalRank: "1st",
			},
			"rust",
		),
	).toBe(
		"https://img.shields.io/badge/Rust%20Thanks-40%2C782%20contributions%2C%201st-orange?logo=rust",
	);
});

test("render a standalone SVG", () => {
	const svg = renderSvg({
		avatarDataUrl: "data:image/png;base64,Zm9v",
		stats: {
			contributions: 40782,
			name: "Jane Doe",
			ordinalRank: "1st",
			rank: 1,
		},
		theme: "rust",
		title: "Rust Thanks",
	});

	expect(svg).toContain("<svg");
	expect(svg).toContain("Jane Doe");
	expect(svg).toContain("40,782");
	expect(svg).toContain("data:image/png;base64,Zm9v");
});

test("build a README snippet for a generated svg", () => {
	expect(
		buildReadmeSnippet(
			{ format: "svg" },
			{
				badgeUrl:
					"https://img.shields.io/badge/Rust%20Thanks-40%2C782%20contributions%2C%201st-orange?logo=rust",
				svgPath: "/tmp/out/cards/rust-thanks.svg",
			},
			"/tmp/out/README.md",
		),
	).toBe('<img src="./cards/rust-thanks.svg" alt="Rust Thanks card" />');
});

test("replace README marker block", () => {
	const content = `
# README

<!--START_SECTION:rust-thanks-card-->
old
<!--END_SECTION:rust-thanks-card-->
`;

	expect(
		replaceMarkedSection(content, "rust-thanks-card", "![Rust Thanks card](./rust-thanks.svg)"),
	).toContain("![Rust Thanks card](./rust-thanks.svg)");
});

test("collect commit paths only for action outputs", () => {
	expect(
		collectCommitPaths(
			{
				readmePath: "/tmp/workspace/README.md",
				svgPath: "/tmp/workspace/assets/rust-thanks.svg",
			},
			"/tmp/workspace",
		),
	).toEqual(["assets/rust-thanks.svg", "README.md"]);
});

test("resolve push branch from input or workflow env", () => {
	process.env.GITHUB_HEAD_REF = "feature-branch";
	process.env.GITHUB_REF_NAME = "fallback-branch";
	expect(resolvePushBranch("")).toBe("feature-branch");
	expect(resolvePushBranch("explicit-branch")).toBe("explicit-branch");
	delete process.env.GITHUB_HEAD_REF;
	delete process.env.GITHUB_REF_NAME;
});

test("build authenticated GitHub remote url", () => {
	expect(
		buildAuthenticatedRemoteUrl("https://github.com/JohnTitor/rust-thanks-card.git", "secret"),
	).toBe("https://x-access-token:secret@github.com/JohnTitor/rust-thanks-card.git");
	expect(
		buildAuthenticatedRemoteUrl("git@github.com:JohnTitor/rust-thanks-card.git", "secret"),
	).toBe("https://x-access-token:secret@github.com/JohnTitor/rust-thanks-card.git");
});
