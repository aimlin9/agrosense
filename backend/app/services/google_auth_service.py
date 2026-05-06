"""Google ID token verification.

The mobile app obtains a Google ID token via expo-auth-session, then sends it
to /api/auth/google. We verify the token's signature against Google's public
keys, check that it was issued for one of OUR client IDs, and then trust the
claims inside (email, sub, name, picture).
"""
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config import settings


class GoogleAuthError(Exception):
    """Raised when token verification fails."""


def verify_google_id_token(token: str) -> dict:
    """Verify an ID token and return its claims.
    
    Raises GoogleAuthError on any verification failure.
    """
    accepted_audiences = [
        cid for cid in (
            settings.google_web_client_id,
            settings.google_android_client_id,
            settings.google_ios_client_id,
        ) if cid
    ]

    if not accepted_audiences:
        raise GoogleAuthError(
            "No Google client IDs configured on the server."
        )

    try:
        # google-auth verifies signature, expiry, issuer, and audience.
        # Passing a list to audience accepts a token issued for any of them.
        claims = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            audience=accepted_audiences,
            clock_skew_in_seconds=600,  # tolerate 10 min of clock drift
        )
    except ValueError as e:
        raise GoogleAuthError(f"Invalid Google ID token: {e}")

    # google-auth checks issuer for us, but double-check
    if claims.get("iss") not in (
        "https://accounts.google.com",
        "accounts.google.com",
    ):
        raise GoogleAuthError("Token not issued by Google.")

    return claims