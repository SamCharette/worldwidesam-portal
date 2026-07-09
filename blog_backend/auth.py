from __future__ import annotations

import json
import os
from pathlib import Path


def load_agent_tokens(root: Path) -> dict[str, str]:
    tokens: dict[str, str] = {}
    env_map = {
        "Clawdia": os.environ.get("WORLDWIDESAM_BLOG_TOKEN_CLAWDIA"),
        "Vera": os.environ.get("WORLDWIDESAM_BLOG_TOKEN_VERA"),
    }
    tokens.update({name: token for name, token in env_map.items() if token})
    local_path = root / ".blog-agents.json"
    if local_path.exists():
        data = json.loads(local_path.read_text(encoding="utf-8"))
        for name, token in data.items():
            if isinstance(name, str) and isinstance(token, str) and token:
                tokens[name] = token
    if not tokens and os.environ.get("WORLDWIDESAM_BLOG_DEV_AUTH") == "1":
        tokens = {"Clawdia": "clawdia-dev-token", "Vera": "vera-dev-token"}
    return tokens


def authenticate(root: Path, header_value: str | None) -> str | None:
    if not header_value:
        return None
    prefix = "Bearer "
    token = header_value[len(prefix) :].strip() if header_value.startswith(prefix) else header_value.strip()
    for name, expected in load_agent_tokens(root).items():
        if token == expected:
            return name
    return None
