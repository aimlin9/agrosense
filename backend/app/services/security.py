from passlib.context import CryptContext


# Bcrypt configuration. Bcrypt is a slow hash by design — slow for attackers,
# fast enough for one user logging in. Industry standard for password storage.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password for storage."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plain-text password against a stored hash."""
    return pwd_context.verify(plain_password, hashed_password)