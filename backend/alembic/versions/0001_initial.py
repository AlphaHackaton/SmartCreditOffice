"""Initial credit pipeline schema."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

UUID = postgresql.UUID(as_uuid=True)
JSONB = postgresql.JSONB


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("inn", sa.String(12), nullable=False),
        sa.Column("ogrn", sa.String(15)),
        sa.Column("legal_form", sa.String(8), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("okved", sa.String(16), nullable=False),
        sa.Column("registered_at", sa.Date, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("inn"),
    )
    op.create_table(
        "products",
        sa.Column("code", sa.String(32), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("min_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("max_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("min_term_months", sa.Integer, nullable=False),
        sa.Column("max_term_months", sa.Integer, nullable=False),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "users",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("login", sa.String(64), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("company_id", UUID, sa.ForeignKey("companies.id")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("login"),
    )
    op.create_table(
        "applications",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("company_id", UUID, sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("product_code", sa.String(32), sa.ForeignKey("products.code"), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("term_months", sa.Integer, nullable=False),
        sa.Column("purpose", sa.String(32), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_table(
        "status_history",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "application_id",
            UUID,
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("from_status", sa.String(24)),
        sa.Column("to_status", sa.String(24), nullable=False),
        sa.Column("actor", sa.String(16), nullable=False),
        sa.Column("reason", sa.Text),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "scoring_runs",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "application_id",
            UUID,
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("inputs_snapshot", JSONB, nullable=False),
        sa.Column("factors", JSONB, nullable=False),
        sa.Column("result", JSONB, nullable=False),
        sa.Column("policy_version", sa.String(64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_table(
        "offers",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "application_id",
            UUID,
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("term_months", sa.Integer, nullable=False),
        sa.Column("rate_pct", sa.Numeric(7, 4), nullable=False),
        sa.Column("monthly_payment", sa.Numeric(18, 2), nullable=False),
        sa.Column("overpayment", sa.Numeric(18, 2), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "signatures",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "application_id",
            UUID,
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("otp_hash", sa.String(128), nullable=False),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("contract_hash", sa.String(128)),
        sa.Column("signed_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "audit_log",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("actor_user_id", UUID),
        sa.Column("application_id", UUID, sa.ForeignKey("applications.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("payload", JSONB, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_companies_inn", "companies", ["inn"], unique=True)
    op.create_index("ix_users_login", "users", ["login"], unique=True)
    op.create_index("ix_applications_company_id", "applications", ["company_id"])
    op.create_index("ix_applications_status", "applications", ["status"])


def downgrade() -> None:
    for table in (
        "audit_log",
        "signatures",
        "offers",
        "scoring_runs",
        "status_history",
        "applications",
        "users",
        "products",
        "companies",
    ):
        op.drop_table(table)
