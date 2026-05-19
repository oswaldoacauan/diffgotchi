#!/usr/bin/env bun
// Seed a review session with a user comment + agent reply so the agent demo
// can show the conversation without recording it live. Run inside the fixture
// repo with DIFFGOTCHI_STATE_HOME set to a local dir.
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const cliSrc = path.resolve(here, "../../../cli/src");

const review = await import(path.join(cliSrc, "lib/review-comments.ts"));
const git = await import(path.join(cliSrc, "lib/git/index.ts"));

const branch = git.getCurrentBranch() || "main";
const target = review.buildReviewTarget({});
let session = review.loadOrCreateReviewSession({
  branch,
  target,
  sessionName: process.env.SESSION_NAME,
});

const userCommentId = `cmt_${randomUUID().slice(0, 8)}`;
session = review.appendReviewComment(session, {
  id: userCommentId,
  author: "user",
  file: "lib/config.json",
  side: "new",
  newLine: 3,
  body: "binding to 0.0.0.0 in dev? are we sure?",
  diffHashAtCreate: 0,
});
session = review.appendReviewCommentReply(
  session,
  userCommentId,
  "yes -- host is overridden via $MYAPP_HOST in prod. local dev needs LAN access for mobile.",
  "agent",
);

session = review.appendReviewComment(session, {
  id: `cmt_${randomUUID().slice(0, 8)}`,
  author: "agent",
  file: "lib/validate.ts",
  side: "new",
  newLine: 42,
  body: "this regex allows trailing dots and `..` in the local part. tighten, or leave the loose check?",
  diffHashAtCreate: 0,
});

review.saveReviewSession(session);
review.saveActiveReviewSessionId(session.id);

console.log(`seeded session ${session.id} (${session.comments.length} comments)`);
