"""Create the first super_admin. Run:
    python -m scripts.create_admin <email> <password> <full_name>
"""
import asyncio
import sys

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.admin import Admin
from app.services.security import hash_password


async def create(email: str, password: str, full_name: str):
    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(Admin).where(Admin.email == email))).scalar_one_or_none()
        if existing:
            print(f"Admin with email {email} already exists.")
            return

        admin = Admin(
            email=email,
            full_name=full_name,
            password_hash=hash_password(password),
            role="super_admin",
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        print(f"Created admin: {email}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python -m scripts.create_admin <email> <password> <full_name>")
        sys.exit(1)
    asyncio.run(create(sys.argv[1], sys.argv[2], sys.argv[3]))