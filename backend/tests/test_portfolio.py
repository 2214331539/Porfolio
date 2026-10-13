"""Portfolio API and migration regression tests, using an isolated in-memory DB.

Run: uv run --with httpx python -m unittest discover -s tests
"""
import importlib.util
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.main import create_app


class PortfolioTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        spec = importlib.util.spec_from_file_location('portfolio_migration', Path(__file__).parents[1] / 'alembic/versions/20261013_0006_portfolio.py')
        self.migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.migration)
        with self.engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
            self.migration.upgrade()
        factory = sessionmaker(bind=self.engine)

        def test_db():
            with factory() as db:
                yield db

        self.app = create_app()
        self.app.dependency_overrides[get_db] = test_db
        self.app.dependency_overrides[get_current_admin] = lambda: object()
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_seed_migration_and_downgrade(self):
        result = self.client.get('/api/portfolio')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.headers['cache-control'], 'no-store')
        self.assertEqual(result.json()['profile']['title'], '小潘同学')
        self.assertEqual([p['slug'] for p in result.json()['projects']], ['couploc', 'soundtag', 'cooking', 'impromptu', 'shopify'])
        with self.engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
            self.migration.downgrade()
        self.assertNotIn('projects', inspect(self.engine).get_table_names())

    def test_admin_routes_require_authentication(self):
        del self.app.dependency_overrides[get_current_admin]
        for method, path, body in [
            ('GET', '/api/admin/portfolio', None), ('GET', '/api/admin/projects/1', None),
            ('POST', '/api/admin/projects', {'name': 'private', 'slug': 'private'}),
            ('PUT', '/api/admin/projects/1', {'name': 'change', 'slug': 'change'}),
            ('DELETE', '/api/admin/projects/1', None),
            ('PUT', '/api/admin/portfolio/profile', {'title': 'change'}),
        ]:
            self.assertEqual(self.client.request(method, path, json=body).status_code, 401)

    def test_publish_hide_sort_and_delete(self):
        payload = {'name': 'New project', 'slug': 'new-project', 'sort_order': 1,
                   'screenshots': [{'src': '/uploads/one.webp', 'alt': 'one'}, {'src': '/uploads/two.webp', 'alt': 'two'}]}
        created = self.client.post('/api/admin/projects', json=payload)
        self.assertEqual(created.status_code, 201)
        project_id = created.json()['id']
        self.assertEqual(len(self.client.get('/api/portfolio').json()['projects']), 5)
        self.assertEqual(len(self.client.get('/api/admin/portfolio').json()['projects']), 6)
        payload.update(status='published', screenshots=list(reversed(payload['screenshots'])))
        self.assertEqual(self.client.put(f'/api/admin/projects/{project_id}', json=payload).status_code, 200)
        projects = self.client.get('/api/portfolio').json()['projects']
        self.assertEqual(projects[1]['id'], project_id)
        self.assertEqual(projects[1]['screenshots'][0]['alt'], 'two')
        payload['status'] = 'draft'
        self.client.put(f'/api/admin/projects/{project_id}', json=payload)
        self.assertNotIn(project_id, [p['id'] for p in self.client.get('/api/portfolio').json()['projects']])
        self.assertEqual(self.client.delete(f'/api/admin/projects/{project_id}').status_code, 200)
        self.assertEqual(self.client.get(f'/api/admin/projects/{project_id}').status_code, 404)
        self.assertEqual(len(self.client.get('/api/admin/portfolio').json()['projects']), 5)

    def test_duplicates_and_invalid_urls_do_not_write(self):
        self.assertEqual(self.client.post('/api/admin/projects', json={'name': 'duplicate', 'slug': 'couploc'}).status_code, 409)
        for update in [{'url': 'javascript:alert(1)'}, {'icon_url': '//evil.test/icon'}, {'name': '   '},
                       {'slug': 'work-intro#bad'}, {'screenshots': [{'src': 'data:image/svg+xml,bad'}]},
                       {'sort_order': -1}, {'status': 'invalid'}]:
            response = self.client.post('/api/admin/projects', json={'name': 'test', 'slug': 'test', **update})
            self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(len(self.client.get('/api/admin/portfolio').json()['projects']), 5)

    def test_profile_persists_without_changing_other_settings(self):
        profile = {'title': '小潘同学', 'introduction': '第一段\n\n第二段'}
        self.assertEqual(self.client.put('/api/admin/portfolio/profile', json=profile).status_code, 200)
        self.assertEqual(self.client.get('/api/portfolio').json()['profile'], profile)
        self.assertEqual(self.client.put('/api/admin/portfolio/profile', json={'title': ''}).status_code, 422)

    def test_image_upload_preserves_transparency_and_rejects_bad_files(self):
        with TemporaryDirectory() as directory, patch('app.api.routes.admin.UPLOADS_DIR', Path(directory)):
            source = BytesIO()
            Image.new('RGBA', (32, 32), (30, 70, 120, 80)).save(source, 'PNG')
            response = self.client.post('/api/admin/upload', files={'file': ('icon.png', source.getvalue(), 'image/png')})
            self.assertEqual(response.status_code, 200)
            with Image.open(Path(directory) / response.json()['url'].split('/')[-1]) as saved:
                self.assertEqual(saved.mode, 'RGBA')
                self.assertEqual(saved.getpixel((0, 0))[3], 80)
            invalid = self.client.post('/api/admin/upload', files={'file': ('bad.png', b'not an image', 'image/png')})
            self.assertEqual(invalid.status_code, 400)
            oversized = self.client.post('/api/admin/upload', files={'file': ('large.png', b'x' * (10 * 1024 * 1024 + 1), 'image/png')})
            self.assertEqual(oversized.status_code, 400)
            self.assertEqual(len(list(Path(directory).iterdir())), 1)


if __name__ == '__main__':
    unittest.main()
