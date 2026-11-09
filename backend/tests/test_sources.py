"""信息源泉 API tests, using an isolated in-memory DB.

Run: uv run --with httpx python -m unittest discover -s tests
"""
import importlib.util
from pathlib import Path
import unittest

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_admin
from app.db.session import Base, get_db
from app.main import create_app


class SourceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        factory = sessionmaker(bind=self.engine)

        def test_db():
            with factory() as db:
                yield db

        app = create_app()
        app.dependency_overrides[get_db] = test_db
        app.dependency_overrides[get_current_admin] = lambda: object()
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_crud_and_visibility(self):
        created = self.client.post('/api/admin/sources', json={'name': 'LinuxDo', 'url': 'https://linux.do/', 'category': '社区', 'weight': 5})
        self.assertEqual(created.status_code, 201, created.text)
        hidden = self.client.post('/api/admin/sources', json={'name': 'Secret', 'url': 'https://example.com/', 'is_visible': False}).json()
        self.assertEqual(hidden['sort_order'], 1)

        self.assertEqual([item['name'] for item in self.client.get('/api/sources').json()], ['LinuxDo'])
        self.assertEqual(len(self.client.get('/api/admin/sources').json()), 2)

        updated = self.client.put(f"/api/admin/sources/{hidden['id']}", json={**hidden, 'is_visible': True, 'color': '#ff6b3d'})
        self.assertEqual(updated.json()['color'], '#ff6b3d')
        self.assertEqual(len(self.client.get('/api/sources').json()), 2)

        self.assertEqual(self.client.delete(f"/api/admin/sources/{hidden['id']}").status_code, 200)
        self.assertEqual(self.client.delete(f"/api/admin/sources/{hidden['id']}").status_code, 404)

    def test_validation(self):
        for payload in [
            {'name': 'Bad', 'url': 'javascript:alert(1)'},
            {'name': 'Bad', 'url': 'https://ok.example/', 'color': 'red'},
            {'name': 'Bad', 'url': 'https://ok.example/', 'weight': 9},
            {'name': '', 'url': 'https://ok.example/'},
        ]:
            self.assertEqual(self.client.post('/api/admin/sources', json=payload).status_code, 422, payload)

    def test_migration_seeds_default_sites(self):
        engine = create_engine('sqlite://')
        spec = importlib.util.spec_from_file_location('sources_migration', Path(__file__).parents[1] / 'alembic/versions/20261109_0008_info_sources.py')
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            names = [row[0] for row in connection.exec_driver_sql('SELECT name FROM info_sources ORDER BY sort_order')]
        self.assertEqual(names[:3], ['LinuxDo', 'AIHOT', '北邮人论坛'])
        self.assertIn('哔哩哔哩', names)


if __name__ == '__main__':
    unittest.main()
