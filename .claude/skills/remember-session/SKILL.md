---
name: remember-session
description: Save durable learnings from the current project session to local long-term memory and optionally back them up to Supabase. Use when the user says 세션 기억하기, 세션 기억해줘, 작업 내용 기억해줘, session memory, 세션 종료, or 작업 마무리.
---

<!-- AgentsToZ memory-agent-version:3 -->
# 세션 기억하기

## Goal

Remember the session without closing the current terminal. The local memory write is
authoritative; the Supabase backup is a recoverable follow-up and must not undo it.

## Procedure

1. Resolve the project root:

```bash
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
```

2. Read `$PROJECT_ROOT/.agent-memory/config.json`, then read its project-relative
   `sourcePath`. If either is missing, tell the user to enable project memory once
   from AgentsToZ_byCS instead of inventing a storage location.
3. Review the current session plus recent `git status --short`, `git diff --stat`,
   `git diff`, and `git log -10`. Include linked worktrees when they contain changes.
4. Update the memory file with durable information only:
   - decisions and rationale;
   - stable constraints;
   - repeated issues with root cause and workaround;
   - validated project-specific workflows.
5. Never store secrets, tokens, environment values, raw chat logs, or temporary status.
   Preserve existing decisions and put contradictions under Contested Entries.
6. After the local file is safely written, mark the current project/worktree activity as
   remembered. This is local metadata only and does not call an AI:

```bash
curl -fsS -X POST --get --data-urlencode "folderPath=$PROJECT_ROOT" \
  http://127.0.0.1:3001/api/project-memory/mark-remembered
```

7. Back up the local memory:

```bash
curl -fsS -X POST --get --data-urlencode "folderPath=$PROJECT_ROOT" \
  http://127.0.0.1:3001/api/project-memory/push
```

8. Report these two results separately:
   - local memory: saved / failed;
   - Supabase backup: saved / retry needed.

If the AgentsToZ_byCS API is not running, do not retry in a loop. Keep the local memory
and tell the user that the Push button can upload it later.
