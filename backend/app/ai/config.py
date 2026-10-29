import os
from pathlib import Path


def _load_env_file():
    """Lightweight loader for .env from backend/.env or root .env without external dependencies."""
    candidates = [
        Path(__file__).resolve().parent.parent.parent / ".env",  # backend/.env
        Path(__file__).resolve().parent.parent.parent.parent / ".env",  # root .env
    ]
    for env_path in candidates:
        if env_path.is_file():
            try:
                for line in env_path.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, val = line.partition("=")
                        key, val = key.strip(), val.strip()
                        if key and key not in os.environ:
                            os.environ[key] = val
            except Exception:
                pass
            break


_load_env_file()


class AIConfig:
    # Sarvam AI
    SARVAM_API_KEY: str = os.getenv("SARVAM_API_KEY", "")
    SARVAM_ASR_MODEL: str = os.getenv("SARVAM_ASR_MODEL", "saaras:v4")
    SARVAM_TTS_MODEL: str = os.getenv("SARVAM_TTS_MODEL", "bulbul:v1")
    SARVAM_BASE_URL: str = os.getenv("SARVAM_BASE_URL", "https://api.sarvam.ai")

    # Groq LLM
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    GROQ_BASE_URL: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")

    # Constraints from docs/CONTRACT.md
    MAX_AUDIO_BYTES: int = int(os.getenv("MAX_AUDIO_MB", "10")) * 1024 * 1024
    MAX_CLIP_SECONDS: int = int(os.getenv("MAX_CLIP_SECONDS", "30"))
    TIMEOUT_SECONDS: float = float(os.getenv("AI_TIMEOUT_SECONDS", "20.0"))


ai_config = AIConfig()
