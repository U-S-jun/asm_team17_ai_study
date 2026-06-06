from __future__ import annotations

import csv
import logging
import re
from datetime import datetime
from io import StringIO

logger = logging.getLogger(__name__)

DATETIME_FORMATS = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y.%m.%d %H:%M:%S",
    "%Y.%m.%d %H:%M",
)

CHAT_TEXT_PATTERN = re.compile(
    r"^(?P<sent_at>\d{4}[.-]\d{2}[.-]\d{2}[ T]\d{2}:\d{2}(?::\d{2})?)\s+"
    r"(?P<speaker>[^:：]+)[:：]\s*(?P<text>.*)$"
)


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    stripped = value.strip()
    if not stripped:
        return None

    try:
        parsed = datetime.fromisoformat(stripped.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=None)
    except ValueError:
        pass

    for date_format in DATETIME_FORMATS:
        try:
            return datetime.strptime(stripped, date_format)
        except ValueError:
            continue

    return None


def parse_chat_messages(chat_text: str) -> list[dict]:
    csv_messages = _parse_csv_messages(chat_text)
    if csv_messages:
        return csv_messages

    messages: list[dict] = []
    for raw_line in chat_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        match = CHAT_TEXT_PATTERN.match(line)
        if not match:
            continue

        sent_at_raw = match.group("sent_at")
        sent_at = parse_datetime(sent_at_raw)
        if not sent_at:
            continue

        speaker = match.group("speaker").strip()
        text = match.group("text").strip()
        messages.append(
            {
                "sent_at": sent_at,
                "line": f"{sent_at_raw},{speaker},{text}",
            }
        )

    return messages


def filter_chat_lines(
    chat_text: str,
    started_at: str,
    ended_at: str = "",
    *,
    before_start: bool = False,
) -> list[str]:
    messages = parse_chat_messages(chat_text)
    if not messages:
        logger.warning("채팅 메시지 시간 파싱 실패 — 구간 필터링을 건너뜁니다")
        return []

    start_dt = parse_datetime(started_at)
    end_dt = parse_datetime(ended_at)

    filtered: list[str] = []
    for message in messages:
        sent_at = message["sent_at"]

        if before_start:
            if start_dt and sent_at < start_dt:
                filtered.append(message["line"])
            continue

        if start_dt and sent_at < start_dt:
            continue
        if end_dt and sent_at > end_dt:
            continue
        filtered.append(message["line"])

    return filtered


def _parse_csv_messages(chat_text: str) -> list[dict]:
    messages: list[dict] = []
    reader = csv.reader(StringIO(chat_text))

    for row_index, row in enumerate(reader):
        if len(row) < 3:
            continue

        sent_at_raw = row[0].strip()
        if row_index == 0 and sent_at_raw.lower() in {
            "시간",
            "time",
            "timestamp",
            "sentat",
        }:
            continue

        sent_at = parse_datetime(sent_at_raw)
        if not sent_at:
            continue

        speaker = row[1].strip()
        text = ",".join(row[2:]).strip()
        messages.append(
            {
                "sent_at": sent_at,
                "line": f"{sent_at_raw},{speaker},{text}",
            }
        )

    return messages
