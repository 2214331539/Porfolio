"""Backfill article repositories from legacy categories.

Revision ID: 20260822_0003
Revises: 20260822_0002
"""
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260822_0003"
down_revision: Union[str, Sequence[str], None] = "20260822_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    categories = connection.execute(sa.text("SELECT id, name, slug, description, sort_order FROM categories ORDER BY sort_order, id")).mappings()
    for category in categories:
        repository_id = connection.execute(
            sa.text("SELECT id FROM content_repositories WHERE content_type = 'post' AND slug = :slug"),
            {"slug": category["slug"]},
        ).scalar_one_or_none()
        if repository_id is None:
            repository_id = connection.execute(
                sa.text("""
                    INSERT INTO content_repositories
                        (name, slug, description, content_type, parent_id, sort_order, created_at)
                    VALUES
                        (:name, :slug, :description, 'post', NULL, :sort_order, :created_at)
                    RETURNING id
                """),
                {
                    "name": category["name"],
                    "slug": category["slug"],
                    "description": category["description"],
                    "sort_order": category["sort_order"],
                    "created_at": datetime.now(timezone.utc),
                },
            ).scalar_one()
        connection.execute(
            sa.text("UPDATE posts SET repository_id = :repository_id WHERE category_id = :category_id AND repository_id IS NULL"),
            {"repository_id": repository_id, "category_id": category["id"]},
        )


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(sa.text("""
        UPDATE posts
        SET repository_id = NULL
        WHERE category_id IN (
            SELECT categories.id
            FROM categories
            JOIN content_repositories
              ON content_repositories.slug = categories.slug
             AND content_repositories.content_type = 'post'
            WHERE posts.repository_id = content_repositories.id
        )
    """))
