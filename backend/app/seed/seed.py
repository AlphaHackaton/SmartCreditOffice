"""Idempotent seed: products, companies and demo users from personas.json.

Run: `python -m app.seed` (or automatically in real mode on first request).
"""

from datetime import date
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.security import hash_password
from app.db.models import Company, Product, User
from app.domain.scoring.policy import POLICY_V1
from app.seed.personas import load_raw

DEMO_PASSWORD = "demo"


def seed(session: Session) -> None:
    """Insert missing seed rows; existing rows are left untouched (idempotent)."""
    _seed_products(session)
    _seed_personas(session)
    _seed_bank_users(session)
    session.commit()


def _seed_products(session: Session) -> None:
    for product in POLICY_V1.products:
        existing = session.get(Product, product.code)
        if existing is not None:
            continue
        session.add(
            Product(
                code=product.code,
                name=product.name,
                min_amount=product.min_amount,
                max_amount=product.max_amount,
                min_term_months=product.min_term,
                max_term_months=product.max_term,
                active=True,
            )
        )


def _seed_personas(session: Session) -> None:
    for persona in load_raw()["personas"]:
        raw = persona["company"]
        inn = str(raw["inn"])
        company_id = uuid5(NAMESPACE_URL, f"company:{inn}")
        company = session.get(Company, company_id)
        if company is None:
            company = Company(
                id=company_id,
                inn=inn,
                ogrn=None,
                legal_form=str(raw["legal_form"]),
                name=str(raw.get("name", persona["id"])),
                okved=str(raw["okved"]),
                registered_at=date.fromisoformat(str(raw["registered_at"])),
            )
            session.add(company)
        user_id = uuid5(NAMESPACE_URL, f"user:{persona['login']}")
        if session.get(User, user_id) is None:
            session.add(
                User(
                    id=user_id,
                    login=str(persona["login"]),
                    password_hash=hash_password(DEMO_PASSWORD),
                    role="CLIENT",
                    company_id=company_id,
                )
            )


def _seed_bank_users(session: Session) -> None:
    logins = {"underwriter": "BANK", "bank_admin": "BANK"}
    for login, role in logins.items():
        if session.scalar(select(User).where(User.login == login)) is None:
            session.add(
                User(
                    id=uuid5(NAMESPACE_URL, f"user:{login}"),
                    login=login,
                    password_hash=hash_password(DEMO_PASSWORD),
                    role=role,
                    company_id=None,
                )
            )


def main() -> None:
    from app.db.session import SessionLocal

    with SessionLocal() as session:
        seed(session)
    print("seed: OK")


if __name__ == "__main__":
    main()
