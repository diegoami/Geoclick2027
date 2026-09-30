---
description: Independently review a GitHub PR and post a neutral review comment.
agent: pr-reviewer
# No model here: the owner chooses a different model for the fresh review session.
---

Review PR #$1. Follow your instructions in full: get the live PR metadata,
review the exact diff in your own detached worktree under the sibling
`<project>-review` directory, post the review to GitHub, and remove only your
own worktree when finished.
