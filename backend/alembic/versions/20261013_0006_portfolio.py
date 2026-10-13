"""Add portfolio management and preserve the original five projects.

Revision ID: 20261013_0006
Revises: 20260824_0005
"""
from alembic import op
import sqlalchemy as sa

revision = '20261013_0006'
down_revision = '20260824_0005'
branch_labels = None
depends_on = None


def upgrade():
    profile = op.create_table('portfolio_profile',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(120), nullable=False),
        sa.Column('introduction', sa.Text(), nullable=False))
    projects = op.create_table('projects',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('slug', sa.String(80), nullable=False, unique=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('summary', sa.String(300), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('icon_key', sa.String(30), nullable=False),
        sa.Column('icon_url', sa.String(500), nullable=False),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('link_label', sa.String(30), nullable=False),
        sa.Column('keywords', sa.JSON(), nullable=False),
        sa.Column('screenshots', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False))
    op.bulk_insert(profile, [{'id': 1, 'title': '小潘同学', 'introduction':
        '积极乐观、自信果决，对未知保持好奇，充满向上的能量。热爱足球、音乐与社交，生活的众多支点，让我能从容应对挑战与压力。做事客观明确，也重视高效的沟通。\n\n'
        '很幸运生在 AI 时代，借助 AI 工具做了这些有意思的小项目。它们还没有成长为商业化或高访问量的产品，却在我的个人生活中，提供了莫大的帮助与宽慰。'}])
    initial = [
        ('couploc', 'Couploc', '移动应用 · 陪伴', '为异地恋做的定位与沟通 App。', '把异地恋中的定位与沟通需求，变成一个自己制作的小应用。它是我借助 AI 探索个人生活需求的作品之一。', ['异地恋', '定位', '沟通']),
        ('soundtag', 'SoundTag', '移动应用 · 声音', '探索 NFC 与音频读写的连接。', '围绕 NFC 音频读写制作的 App。音乐是我的生活支点之一，这个小项目也承载着我对声音与工具的好奇。', ['NFC', '音频', '读写']),
        ('cooking', 'Cooking', '移动应用 · 日常', '一个给日常生活提供菜品灵感的 App。', '围绕每日菜品推荐制作的应用。从每天都会遇到的小问题出发，让自己做的工具参与生活。', ['每日推荐', '菜品', '生活']),
        ('impromptu', 'Impromptu', '网站 · 学习', '为口语练习而做的网站。', '把口语练习的想法做成一个网站。它是我用 AI 工具探索学习场景的一次实践。', ['口语', '练习', '表达']),
        ('shopify', 'Shopify 独立站插件', '插件 · 电商', '围绕独立站场景的一次工具探索。', '在 Shopify 独立站场景下尝试制作插件。和其他作品一样，这是我借助 AI 将好奇落到实际项目中的探索。', ['Shopify', '独立站', '插件']),
    ]
    op.bulk_insert(projects, [dict(slug=slug, name=name, category=category, summary=summary,
        description=description, keywords=keywords, icon_key=slug, icon_url='', url='',
        link_label='访问作品', screenshots=[], status='published', sort_order=index * 10)
        for index, (slug, name, category, summary, description, keywords) in enumerate(initial)])


def downgrade():
    op.drop_table('projects')
    op.drop_table('portfolio_profile')
