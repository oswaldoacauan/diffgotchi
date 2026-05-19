import type { ReactNode } from "react";
import { Code, Kbd } from "@/components/landing";

export type Feature = {
  id: string;
  cast: string;
  label: string;
  title: string;
  body: ReactNode;
};

export const FEATURES: Feature[] = [
  {
    id: "comments",
    cast: "/demos/comments.cast",
    label: "comments",
    title: "Comments where the change is.",
    body: (
      <>
        <p>
          Press <Kbd>c</Kbd> on any hunk and drop a note. It pins to the line, survives branch
          switches, and shows up in a side panel you can scroll, reply to, and resolve.
        </p>
        <p>
          Open <Kbd>ctrl</Kbd>+<Kbd>k</Kbd> <Kbd>r</Kbd> for the comments list. The thread reads
          like a conversation, not a checklist.
        </p>
      </>
    ),
  },
  {
    id: "agent",
    cast: "/demos/agent.cast",
    label: "agent skill",
    title: "Hand the loop to your agent.",
    body: (
      <>
        <p>
          Drop a comment, switch to your agent, the comment is already on its work queue. It writes
          the fix, replies with what it did, marks it resolved. You come back to a green panel.
        </p>
        <p>
          Drop the <Code>diffgotchi</Code> skill into Claude Code or any agent that runs shell
          commands. No copy-paste. No "here's the review" prompt.
        </p>
      </>
    ),
  },
  {
    id: "sessions",
    cast: "/demos/sessions.cast",
    label: "sessions",
    title: "One review per workstream.",
    body: (
      <>
        <p>
          <Code>diffgotchi --session api-review</Code> scopes comments and done state to a name.
          Multi-task on the same branch, or jump branches without losing your place.
        </p>
        <p>
          Fuzzy-pick files with <Kbd>/</Kbd> — filenames, diff counts, comment markers. Comes back
          where you left off.
        </p>
      </>
    ),
  },
];
