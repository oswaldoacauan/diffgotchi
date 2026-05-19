import { afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";

export const repoRoot = resolve(import.meta.dir, "../../..");
export const pilottyBin = join(repoRoot, "node_modules", ".bin", "pilotty");
const cliEntrypoint = join(repoRoot, "packages", "cli", "src", "main.tsx");
const decoder = new TextDecoder();
const sessions = new Set<string>();
const roots = new Set<string>();
const pilottySocketDir = mkdtempSync(join(tmpdir(), "diffgotchi-pilotty-sock-"));

roots.add(pilottySocketDir);

export interface Fixture {
  root: string;
  repo: string;
  home: string;
  state: string;
}

interface SpawnOptions {
  args?: string[];
  context?: number;
}

interface PilottySnapshot {
  content_hash: string;
}

afterAll(() => {
  for (const session of sessions) {
    runPilotty(["kill", "--session", session], { allowFailure: true });
  }
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

export async function spawnDiffgotchi(
  fixture: Fixture,
  options: SpawnOptions = {},
): Promise<string> {
  const session = `diffgotchi-e2e-${process.pid}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  sessions.add(session);

  writeConfig(fixture.home);

  runPilotty(
    [
      "spawn",
      "--name",
      session,
      "--cwd",
      fixture.repo,
      "env",
      `HOME=${fixture.home}`,
      `DIFFGOTCHI_STATE_HOME=${fixture.state}`,
      "DIFFGOTCHI_NO_UPDATE=1",
      "TERM=xterm-256color",
      "bun",
      cliEntrypoint,
      "--context",
      String(options.context ?? 1),
      "--session",
      session,
      "--theme",
      "github",
      ...(options.args ?? []),
    ],
    { cwd: fixture.repo },
  );

  return session;
}

export function createFullFixture(): Fixture {
  const fixture = createBaseFixture();
  write(join(fixture.repo, "a-main.ts"), baselineMain());
  write(join(fixture.repo, "README.md"), "# Diffgotchi fixture\n\nOriginal readme.\n");
  write(join(fixture.repo, "c-old.md"), "# Old file\n\nThis file is removed.\n");
  write(
    join(fixture.repo, "d-long.ts"),
    "export const longLine = 'short';\nexport const stable = true;\n",
  );

  commitFixtureBaseline(fixture.repo);

  write(join(fixture.repo, "a-main.ts"), changedMain());
  write(
    join(fixture.repo, "b-new.ts"),
    "export function addedFeature() {\n  return 'new file';\n}\n",
  );
  rmSync(join(fixture.repo, "c-old.md"));
  git(fixture.repo, ["mv", "README.md", "README-renamed.md"]);
  write(
    join(fixture.repo, "README-renamed.md"),
    "# Diffgotchi fixture\n\nRenamed and edited readme.\n",
  );
  write(
    join(fixture.repo, "d-long.ts"),
    "export const longLine = 'this line is intentionally long enough to exercise wrapping behavior in a narrow terminal viewport while remaining deterministic for assertions';\nexport const stable = true;\n",
  );

  return fixture;
}

export function createSingleFileFixture(): Fixture {
  const fixture = createBaseFixture();
  write(join(fixture.repo, "only.ts"), "export const value = 1;\n");
  commitFixtureBaseline(fixture.repo);
  write(join(fixture.repo, "only.ts"), "export const value = 2;\n");
  return fixture;
}

export function createStagedFixture(): Fixture {
  const fixture = createBaseFixture();
  write(join(fixture.repo, "staged.ts"), "export const staged = 'before';\n");
  write(join(fixture.repo, "unstaged.ts"), "export const unstaged = 'before';\n");
  commitFixtureBaseline(fixture.repo);

  write(join(fixture.repo, "staged.ts"), "export const staged = 'after';\n");
  git(fixture.repo, ["add", "staged.ts"]);
  write(join(fixture.repo, "unstaged.ts"), "export const unstaged = 'after';\n");

  return fixture;
}

export function createCommittedRangeFixture(): Fixture {
  const fixture = createBaseFixture();
  write(join(fixture.repo, "range.ts"), "export const rangeValue = 'before';\n");
  commitFixtureBaseline(fixture.repo);

  write(join(fixture.repo, "range.ts"), "export const rangeValue = 'after';\n");
  git(fixture.repo, ["add", "."]);
  git(fixture.repo, [
    "-c",
    "user.email=e2e@example.com",
    "-c",
    "user.name=E2E",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    "change range fixture",
  ]);

  return fixture;
}

export async function waitFor(session: string, pattern: string): Promise<void> {
  try {
    runPilotty(["wait-for", "--session", session, "--timeout", "8000", pattern]);
  } catch (error) {
    const screen = runPilotty(
      ["snapshot", "--session", session, "--format", "text", "--settle", "50"],
      { allowFailure: true },
    ).stdout;
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n\n${screen}`);
  }
  await Bun.sleep(50);
}

export async function typeText(session: string, text: string): Promise<void> {
  const before = snapshot(session).content_hash;
  runPilotty(["type", "--session", session, text]);
  await changedSnapshot(session, before);
}

export async function key(session: string, value: string): Promise<void> {
  runPilotty(["key", "--session", session, value]);
  await Bun.sleep(50);
}

export async function resize(session: string, cols: number, rows: number): Promise<void> {
  const before = snapshot(session).content_hash;
  runPilotty(["resize", "--session", session, String(cols), String(rows)]);
  await changedSnapshot(session, before);
}

export async function clickText(session: string, text: string): Promise<void> {
  const screen = await textSnapshot(session);
  const lines = screen.split("\n");
  const row = lines.findIndex((line) => line.includes(text));
  if (row < 0) throw new Error(`Text not found for click: ${text}\n\n${screen}`);
  const col = Math.max(0, lines[row]!.indexOf(text) + 1);
  const before = snapshot(session).content_hash;
  runPilotty(["click", "--session", session, String(row), String(col)]);
  await changedSnapshot(session, before);
}

export async function textSnapshot(session: string): Promise<string> {
  await Bun.sleep(50);
  return runPilotty(["snapshot", "--session", session, "--format", "text", "--settle", "50"])
    .stdout;
}

function createBaseFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "diffgotchi-pilotty-"));
  roots.add(root);
  const repo = join(root, "repo");
  const home = join(root, "home");
  const state = join(root, "state");
  mkdirSync(repo, { recursive: true });
  mkdirSync(home, { recursive: true });
  mkdirSync(state, { recursive: true });
  return { root, repo, home, state };
}

function commitFixtureBaseline(repo: string): void {
  git(repo, ["init"]);
  git(repo, ["add", "."]);
  git(repo, [
    "-c",
    "user.email=e2e@example.com",
    "-c",
    "user.name=E2E",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    "initial",
  ]);
}

function writeConfig(home: string): void {
  write(
    join(home, ".config", "diffgotchi", "config.json"),
    `${JSON.stringify(
      {
        general: { theme: "github", editor: "true", mouse: true },
        upgrade: { auto: false },
        keybinds: {
          "global.help_keybinds": "?",
          "global.help_about": "ctrl+k a",
          "diff.pick_theme": "ctrl+k t",
          "diff.display_view": "v",
          "diff.display_line_numbers": "n",
          "diff.display_wrap": "w",
          "diff.display_inline_highlights": "i",
          "diff.display_backgrounds": "b",
          "diff.display_indicators": "x",
          "diff.display_hunk_headers": "u",
          "diff.context_lines": "g",
          "diff.toggle_mouse": "m",
        },
      },
      null,
      2,
    )}\n`,
  );
}

function snapshot(session: string): PilottySnapshot {
  return JSON.parse(
    runPilotty(["snapshot", "--session", session, "--format", "full", "--settle", "50"]).stdout,
  ) as PilottySnapshot;
}

async function changedSnapshot(session: string, hash: string): Promise<void> {
  runPilotty([
    "snapshot",
    "--session",
    session,
    "--await-change",
    hash,
    "--settle",
    "50",
    "--timeout",
    "8000",
  ]);
  await Bun.sleep(50);
}

function runPilotty(
  args: string[],
  opts: { cwd?: string; allowFailure?: boolean } = {},
): { stdout: string; stderr: string } {
  return run(pilottyBin, args, {
    ...opts,
    env: { ...process.env, PILOTTY_SOCKET_DIR: pilottySocketDir },
  });
}

function git(cwd: string, args: string[]): { stdout: string; stderr: string } {
  return run("git", args, { cwd });
}

function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; allowFailure?: boolean; env?: Record<string, string | undefined> } = {},
): { stdout: string; stderr: string } {
  const result = Bun.spawnSync({
    cmd: [cmd, ...args],
    cwd: opts.cwd ?? repoRoot,
    env: opts.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = decoder.decode(result.stdout);
  const stderr = decoder.decode(result.stderr);
  if (!opts.allowFailure && result.exitCode !== 0) {
    throw new Error(
      [
        `Command failed: ${[cmd, ...args].join(" ")}`,
        `exit ${result.exitCode}`,
        stdout.trim(),
        stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return { stdout, stderr };
}

function write(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf-8");
}

function baselineMain(): string {
  return [
    "export function greet(name: string) {",
    "  const message = `Hello ${name}`;",
    "  return message;",
    "}",
    "",
    "export function footer() {",
    "  return 'ready';",
    "}",
    "",
  ].join("\n");
}

function changedMain(): string {
  return [
    "export function greet(name: string) {",
    "  const message = `Hello ${name.trim()}`;",
    "  return message.toUpperCase();",
    "}",
    "",
    "export function footer() {",
    "  const status = 'reviewed';",
    "  return status;",
    "}",
    "",
  ].join("\n");
}
