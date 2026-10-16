"""Phone number normalisation.

Farmers type numbers every way imaginable: "024 412 3456", "0244123456",
"233244123456", "+233 24 412 3456". We store E.164 (+233244123456) so the
same farmer can't end up with two accounts and SMS replies route correctly.
"""
import re

DEFAULT_COUNTRY_CODE = "233"  # Ghana

_E164 = re.compile(r"^\+[1-9]\d{7,14}$")


class InvalidPhoneNumber(ValueError):
    pass


def normalize_phone(raw: str, default_cc: str = DEFAULT_COUNTRY_CODE) -> str:
    if raw is None:
        raise InvalidPhoneNumber("Phone number is required.")
    s = re.sub(r"[\s\-().]", "", raw.strip())
    if s.startswith("00"):
        s = "+" + s[2:]
    if s.startswith("+"):
        candidate = s
    elif s.startswith(default_cc) and len(s) >= len(default_cc) + 8:
        candidate = "+" + s
    elif s.startswith("0"):
        candidate = f"+{default_cc}{s[1:]}"
    else:
        candidate = f"+{default_cc}{s}"
    if not _E164.match(candidate):
        raise InvalidPhoneNumber("Enter a valid phone number, e.g. 024 412 3456.")
    # Ghana numbers are exactly 9 digits after the country code.
    if candidate.startswith("+233"):
        # 9 digits after +233; mobile prefixes start 2 or 5, landlines 3.
        if len(candidate) != 13 or candidate[4] not in "235":
            raise InvalidPhoneNumber("Enter a valid Ghana number, e.g. 024 412 3456.")
    return candidate


def phone_lookup_candidates(raw: str) -> list[str]:
    """Values to match against stored numbers, including legacy raw formats."""
    out = [raw.strip()]
    try:
        n = normalize_phone(raw)
        out.append(n)
        out.append("0" + n[4:] if n.startswith("+233") else n)
    except InvalidPhoneNumber:
        pass
    return list(dict.fromkeys(out))
