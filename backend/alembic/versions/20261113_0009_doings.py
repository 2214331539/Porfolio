"""Add the Doing page: notes about what the owner is working on, on a main or a side line.

Revision ID: 20261113_0009
Revises: 20261109_0008
"""
from alembic import op
import sqlalchemy as sa

revision = '20261113_0009'
down_revision = '20261109_0008'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('doings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(60), nullable=False),
        sa.Column('body', sa.Text(), nullable=False, server_default=''),
        sa.Column('started_on', sa.Date(), nullable=False),
        sa.Column('kind', sa.String(10), nullable=False, server_default='main'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))


def downgrade():
    op.drop_table('doings')
