"""Add the 信息源泉 list of websites, starting with the sites the owner reads most.

Revision ID: 20261109_0008
Revises: 20261108_0007
"""
from alembic import op
import sqlalchemy as sa

revision = '20261109_0008'
down_revision = '20261108_0007'
branch_labels = None
depends_on = None

DEFAULT_SOURCES = [
    ('LinuxDo', 'https://linux.do/', '技术与 AI 话题都很活跃的中文社区。', '社区', '#1d6bff', 5),
    ('AIHOT', 'https://aihot.virxact.com/', '每天筛过一遍的 AI 热点。', '资讯', '#ff6b3d', 4),
    ('北邮人论坛', 'https://bbs.byr.cn/', '学校里的大小事。', '社区', '#c6f24e', 4),
    ('小红书', 'https://www.xiaohongshu.com/', '生活方式与灵感。', '社交', '#ff4f6d', 4),
    ('抖音', 'https://www.douyin.com/', '短视频，放松一下。', '视频', '#1a1a1a', 3),
    ('哔哩哔哩', 'https://www.bilibili.com/', '长视频、课程和各种有趣的 up 主。', '视频', '#4fb3ff', 5),
]


def upgrade():
    sources = op.create_table('info_sources',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(60), nullable=False),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('description', sa.Text(), nullable=False, server_default=''),
        sa.Column('category', sa.String(40), nullable=False, server_default=''),
        sa.Column('color', sa.String(20), nullable=False, server_default=''),
        sa.Column('icon_url', sa.String(500), nullable=False, server_default=''),
        sa.Column('weight', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_visible', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.bulk_insert(sources, [
        {'name': name, 'url': url, 'description': description, 'category': category, 'color': color, 'icon_url': '', 'weight': weight, 'sort_order': index, 'is_visible': True}
        for index, (name, url, description, category, color, weight) in enumerate(DEFAULT_SOURCES)
    ])


def downgrade():
    op.drop_table('info_sources')
