"""Add resume version management.

Revision ID: 20260822_0004
Revises: 20260822_0003
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260822_0004"
down_revision: Union[str, Sequence[str], None] = "20260822_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "resume_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("label", sa.String(length=40), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=False),
        sa.Column("pdf_url", sa.String(length=500), nullable=True),
        sa.Column("version_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("is_current", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resume_versions_status", "resume_versions", ["status"], unique=False)
    op.create_index("ix_resume_versions_is_current", "resume_versions", ["is_current"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_resume_versions_is_current", table_name="resume_versions")
    op.drop_index("ix_resume_versions_status", table_name="resume_versions")
    op.drop_table("resume_versions")
