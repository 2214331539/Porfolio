"""Normalize locally uploaded asset URLs to relative paths.

Revision ID: 20260824_0005
Revises: 20260822_0004
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20260824_0005"
down_revision: Union[str, Sequence[str], None] = "20260822_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        UPDATE posts
        SET cover_url = substring(cover_url FROM '(/uploads/.*)$')
        WHERE cover_url ~ '^https?://[^/]+/uploads/'
    """)
    op.execute("""
        UPDATE resume_versions
        SET image_url = substring(image_url FROM '(/uploads/.*)$')
        WHERE image_url ~ '^https?://[^/]+/uploads/'
    """)
    op.execute("""
        UPDATE resume_versions
        SET pdf_url = substring(pdf_url FROM '(/uploads/.*)$')
        WHERE pdf_url ~ '^https?://[^/]+/uploads/'
    """)
    op.execute("""
        UPDATE notes AS note
        SET images = normalized.images
        FROM (
            SELECT
                notes.id,
                json_agg(
                    CASE
                        WHEN item.url ~ '^https?://[^/]+/uploads/'
                            THEN substring(item.url FROM '(/uploads/.*)$')
                        ELSE item.url
                    END
                    ORDER BY item.position
                ) AS images
            FROM notes
            CROSS JOIN LATERAL json_array_elements_text(notes.images)
                WITH ORDINALITY AS item(url, position)
            GROUP BY notes.id
        ) AS normalized
        WHERE note.id = normalized.id
          AND note.images::text ~ 'https?://[^/]+/uploads/'
    """)


def downgrade() -> None:
    # The previous host cannot be inferred safely. Relative upload URLs remain
    # valid in both development and production after a code downgrade.
    pass
