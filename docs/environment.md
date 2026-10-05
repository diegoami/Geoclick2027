# Environment: model quota (quota-tracker)

A local service, quota-tracker, reports how much subscription quota is left on
claude, openai (ChatGPT plan, used via OpenCode), zai (GLM Coding Plan),
opencode_go (OpenCode Go) and openrouter (prepaid credit). Check it before
choosing, recommending or delegating to a model (harness_imperial L50).

Read-only, localhost, no auth, cached 60 s (`?refresh` bypasses the cache):

    curl -s localhost:8765/quota            # every provider
    curl -s localhost:8765/quota/<provider> # one provider
    curl -s localhost:8765/best             # usable providers, most headroom first
    curl -s localhost:8765/avoid            # out of quota, with when usable again

`status` is `ok` (under 80% used), `low` (80% or more), `exhausted` (95% or
more: not used until `available_at`), `error` or `not_configured`.
`headroom_pct` is what is left on the most-used window; `windows[]` lists every
limit with `used_pct` and `resets_in`.

| provider    | heavy                                             | light                                                 |
|-------------|---------------------------------------------------|-------------------------------------------------------|
| claude      | `claude --model opus`                             | `claude --model sonnet`                               |
| openai      | `opencode -m openai/gpt-6.1-sol`                  | `opencode -m openai/gpt-5.6-luna`                     |
| zai         | `opencode -m zai-coding-plan/glm-5.3`             | `opencode -m zai-coding-plan/glm-5.3-flash`           |
| opencode_go | `opencode -m opencode-go/deepseek-v4-pro`         | `opencode -m opencode-go/deepseek-v4.1-flash`         |
| openrouter  | `opencode -m openrouter/deepseek/deepseek-v4-pro` | `opencode -m openrouter/deepseek/deepseek-v4.1-flash` |

- `gpt-5.6-luna` has its own weekly window (`gpt-5.6-luna:7d` in
  `/quota/openai`): for light tasks openai is usable while it is under 95%,
  even if openai itself is exhausted.
- openrouter is prepaid: its windows never reset; `remaining_usd` is the balance.

If the service is down (`curl -sf localhost:8765/health` fails):
`systemctl --user restart quota-tracker`; if there is no bus, the owner runs
`sudo loginctl enable-linger $USER`; read
`journalctl --user -u quota-tracker -n 50`; or run it by hand:
`cd ~/projects/models_quota_tracker && uv run quota-tracker serve`. Where it is
not installed, go on without it and count a usage-limit error as `exhausted`.

Never read or edit `~/.config/quota-tracker/config.toml` (account tokens). An
`error` about an expired cookie or token goes to the owner.
