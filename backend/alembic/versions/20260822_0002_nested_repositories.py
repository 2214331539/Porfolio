"""Add nested content repositories.

Revision ID: 20260822_0002
Revises: 20260820_0001
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260822_0002"
down_revision: Union[str, Sequence[str], None] = "20260820_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "content_repositories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(length=20), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["content_repositories.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("content_type", "slug", name="uq_content_repository_type_slug"),
    )
    op.create_index("ix_content_repositories_content_type", "content_repositories", ["content_type"], unique=False)
    op.create_index("ix_content_repositories_parent_id", "content_repositories", ["parent_id"], unique=False)
    op.add_column("posts", sa.Column("repository_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_posts_repository_id", "posts", "content_repositories", ["repository_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_posts_repository_id", "posts", ["repository_id"], unique=False)
    op.add_column("notes", sa.Column("repository_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_notes_repository_id", "notes", "content_repositories", ["repository_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_notes_repository_id", "notes", ["repository_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_notes_repository_id", table_name="notes")
    op.drop_constraint("fk_notes_repository_id", "notes", type_="foreignkey")
    op.drop_column("notes", "repository_id")
    op.drop_index("ix_posts_repository_id", table_name="posts")
    op.drop_constraint("fk_posts_repository_id", "posts", type_="foreignkey")
    op.drop_column("posts", "repository_id")
    op.drop_index("ix_content_repositories_parent_id", table_name="content_repositories")
    op.drop_index("ix_content_repositories_content_type", table_name="content_repositories")
    op.drop_table("content_repositories")
