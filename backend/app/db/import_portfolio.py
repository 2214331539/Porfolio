"""Explicitly import the requested portfolio additions; never run on startup.

Preview: uv run python -m app.db.import_portfolio
Apply:   uv run python -m app.db.import_portfolio --apply
Existing projects retain their content, media, status and position; only their
GitHub link and link label are updated. All writes use one transaction.
"""
import argparse
import json
from pathlib import Path

from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models.content import Project
from app.schemas.portfolio import ProjectIn


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    source = Path(__file__).with_name('data') / 'portfolio_projects.json'
    entries = [ProjectIn(**item, link_label='查看 GitHub', status='published')
               for item in json.loads(source.read_text(encoding='utf-8'))]
    with SessionLocal.begin() as db:
        next_order = (db.scalar(select(func.max(Project.sort_order))) or 0) + 10
        for entry in entries:
            project = db.scalar(select(Project).where(Project.slug == entry.slug))
            print(f'{"UPDATE LINK" if project else "ADD"}: {entry.slug} -> {entry.url}')
            if not args.apply:
                continue
            if project:
                project.url = entry.url
                project.link_label = entry.link_label
            else:
                values = entry.model_dump()
                values['sort_order'] = next_order
                next_order += 10
                db.add(Project(**values))
    print('Applied.' if args.apply else 'Preview only; pass --apply to save.')


if __name__ == '__main__':
    main()
