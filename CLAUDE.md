<!-- AgentsToZ project-memory:start -->
## Project memory integration

<!-- AgentsToZ memory-agent-version:3 -->
- Read `.agent-memory/config.json` and its project-relative `sourcePath` before substantial work when historical decisions may matter.
- “세션 기억하기” is the project-local memory workflow. When the user asks to remember the
  session, update the configured local memory first, mark current activity as remembered,
  and then back it up:
  `PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; curl -fsS -X POST --get --data-urlencode "folderPath=$PROJECT_ROOT" http://127.0.0.1:3001/api/project-memory/mark-remembered && curl -fsS -X POST --get --data-urlencode "folderPath=$PROJECT_ROOT" http://127.0.0.1:3001/api/project-memory/push`
- Generated Claude/Codex `UserPromptSubmit` hooks are token-free: they discard prompt
  content and record only the last activity time and agent so AgentsToZ can highlight
  “세션 기억하기 필요”.
- If a compatible external closing workflow such as `/cs-end` runs, apply the same
  “세션 기억하기” procedure before it finishes.
- A failed remote backup must never roll back the local memory update. Report the failure so Push can be retried in AgentsToZ_byCS.
<!-- AgentsToZ project-memory:end -->
