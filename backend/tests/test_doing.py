"""Doing page API tests, using an isolated in-memory DB.

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


class DoingTests(unittest.TestCase):
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

    def add(self, title, kind='main', started_on='2026-11-05', body=''):
        response = self.client.post('/api/admin/doing', json={'title': title, 'kind': kind, 'started_on': started_on, 'body': body})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def names(self, kind):
        return [item['title'] for item in self.client.get('/api/doing').json() if item['kind'] == kind]

    def test_new_notes_hang_at_the_front_of_their_own_line(self):
        self.add('first')
        self.add('second')
        self.add('side one', kind='side')
        self.assertEqual(self.names('main'), ['second', 'first'])
        self.assertEqual(self.names('side'), ['side one'])

    def test_update_and_delete(self):
        note = self.add('draft', body='**hi**')
        self.assertEqual(note['started_on'], '2026-11-05')
        updated = self.client.put(f"/api/admin/doing/{note['id']}", json={'title': 'final', 'body': '', 'started_on': '2026-10-01', 'kind': 'main'})
        self.assertEqual((updated.json()['title'], updated.json()['started_on']), ('final', '2026-10-01'))
        self.assertEqual(self.client.delete(f"/api/admin/doing/{note['id']}").status_code, 200)
        self.assertEqual(self.client.delete(f"/api/admin/doing/{note['id']}").status_code, 404)
        self.assertEqual(self.client.put('/api/admin/doing/999', json={'title': 'x', 'started_on': '2026-10-01'}).status_code, 404)

    def test_switching_line_moves_the_note_to_the_front_of_the_other_one(self):
        self.add('a', kind='side')
        mover = self.add('mover')
        self.client.put(f"/api/admin/doing/{mover['id']}", json={'title': 'mover', 'started_on': '2026-11-05', 'kind': 'side'})
        self.assertEqual(self.names('side'), ['mover', 'a'])
        self.assertEqual(self.names('main'), [])

    def test_arrange_reorders_and_moves_between_lines(self):
        a, b, c = self.add('a'), self.add('b'), self.add('c', kind='side')
        result = self.client.put('/api/admin/doing/order', json={'main': [a['id']], 'side': [c['id'], b['id']]})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.names('main'), ['a'])
        self.assertEqual(self.names('side'), ['c', 'b'])
        self.assertEqual(self.client.put('/api/admin/doing/order', json={'main': [a['id'], 999], 'side': []}).status_code, 404)
        self.assertEqual(self.client.put('/api/admin/doing/order', json={'main': [a['id']], 'side': [a['id']]}).status_code, 422)

    def test_validation(self):
        for payload in [
            {'title': '', 'started_on': '2026-11-05'},
            {'title': 'x' * 61, 'started_on': '2026-11-05'},
            {'title': 'ok', 'started_on': 'yesterday'},
            {'title': 'ok', 'started_on': '2026-11-05', 'kind': 'weekly'},
            {'title': 'ok', 'started_on': '2026-11-05', 'body': 'x' * 5001},
        ]:
            self.assertEqual(self.client.post('/api/admin/doing', json=payload).status_code, 422, payload)

    def test_migration_creates_an_empty_table(self):
        engine = create_engine('sqlite://')
        spec = importlib.util.spec_from_file_location('doing_migration', Path(__file__).parents[1] / 'alembic/versions/20261113_0009_doings.py')
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            count = connection.exec_driver_sql('SELECT COUNT(*) FROM doings').scalar()
        self.assertEqual(count, 0)


if __name__ == '__main__':
    unittest.main()
