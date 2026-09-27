# Geoclick — for any coding agent

**Read [CLAUDE.md](CLAUDE.md) first and follow it.** It is this project's
rulebook for every agent, whatever the tool (Claude Code, OpenCode) and the
model. Its name is historical. Where it says "Claude", read "the
implementing agent".

Then read [docs/HANDOVER.md](docs/HANDOVER.md): where things stand and what
comes next.

Three things a non-Claude tool does not load on its own:

- **The review prompt template** is
  [.claude/skills/review-handoff/SKILL.md](.claude/skills/review-handoff/SKILL.md).
  Read it whenever CLAUDE.md §3a says to give a review prompt, or when the
  owner says a review is in.
- **The commit trailer** names the model and the tool that did the work
  (CLAUDE.md, "Commit messages").
- **The owner's working agreements** are in CLAUDE.md §5. They used to live
  only in one Claude installation's memory; they apply to every agent.
