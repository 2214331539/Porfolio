"""Track when notes were last edited, so the admin library can sort by update time.

Revision ID: 20261108_0007
Revises: 20261013_0006
"""
from alembic import op
import sqlalchemy as sa

revision = '20261108_0007'
down_revision = '20261013_0006'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('notes', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))
    op.execute('UPDATE notes SET updated_at = COALESCE(published_at, created_at)')
    op.alter_column('notes', 'updated_at', nullable=False, server_default=sa.func.now())


def downgrade():
    op.drop_column('notes', 'updated_at')
