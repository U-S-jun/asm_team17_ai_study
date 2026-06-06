SUPPORTED_ENCODINGS = ("utf-8-sig", "utf-8", "cp949", "euc-kr")


def decode_chat_file(raw_bytes: bytes) -> str:
    for encoding in SUPPORTED_ENCODINGS:
        try:
            return raw_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue

    return raw_bytes.decode("utf-8", errors="replace")
