"""Twilio SMS service — outbound sends + webhook helpers."""
from twilio.rest import Client
from twilio.twiml.messaging_response import MessagingResponse

from app.config import settings


_twilio_client: Client | None = None


def get_twilio_client() -> Client:
    global _twilio_client
    if _twilio_client is None:
        _twilio_client = Client(
            settings.twilio_account_sid,
            settings.twilio_auth_token,
        )
    return _twilio_client


def send_sms(to_number: str, body: str) -> str:
    """Send an SMS. Returns the message SID."""
    client = get_twilio_client()
    message = client.messages.create(
        body=body[:1500],  # Twilio splits anything > 1600 chars
        from_=settings.twilio_phone_number,
        to=to_number,
    )
    return message.sid


def build_twiml_response(reply_body: str) -> str:
    """Build a TwiML XML string Twilio expects for inbound webhook replies.
    
    Returning TwiML directly is simpler than calling the API to send back —
    Twilio sees this and dispatches the SMS automatically.
    """
    response = MessagingResponse()
    response.message(reply_body[:1500])
    return str(response)