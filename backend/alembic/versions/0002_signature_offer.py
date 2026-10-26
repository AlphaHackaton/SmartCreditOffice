"""Link signatures to the accepted offer.

Revision ID: 0002_signature_offer
Revises: 0001_initial
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0002_signature_offer"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.add_column("signatures", sa.Column("offer_id", UUID, nullable=True))
    op.create_foreign_key(
        "fk_signatures_offer_id",
        "signatures",
        "offers",
        ["offer_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_signatures_offer_id", "signatures", type_="foreignkey")
    op.drop_column("signatures", "offer_id")
