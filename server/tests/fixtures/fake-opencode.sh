#!/bin/sh
# Stand-in for the opencode CLI in tests: emits a few `opencode run --format json` events, edits main.tex
# (run with cwd = project dir), and waits FAKE_OPENCODE_DELAY seconds between the two text events.
[ -n "$FAKE_OPENCODE_CONFIG_OUT" ] && printf '%s' "$OPENCODE_CONFIG_CONTENT" > "$FAKE_OPENCODE_CONFIG_OUT"
echo '{"type":"step_start","sessionID":"ses_fake"}'
echo '{"type":"text","sessionID":"ses_fake","part":{"type":"text","text":"A"}}'
sleep "${FAKE_OPENCODE_DELAY:-0}"
printf '%s\n' '\documentclass{article}' 'edited' > main.tex
echo '{"type":"tool_use","sessionID":"ses_fake","part":{"tool":"edit","callID":"c1","state":{"status":"completed","input":{"filePath":"main.tex"},"output":"ok"}}}'
echo '{"type":"text","sessionID":"ses_fake","part":{"type":"text","text":"B"}}'
echo '{"type":"step_finish","sessionID":"ses_fake","part":{"reason":"stop","tokens":{"total":42}}}'
