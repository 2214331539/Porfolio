"""Content library API tests (repositories, posts, notes), using an isolated in-memory DB.

Run: uv run --with httpx python -m unittest discover -s tests
"""
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_admin
from app.db.session import Base, get_db
from app.main import create_app
from app.services.content_service import reading_minutes


class ContentLibraryTests(unittest.TestCase):
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

    def repo(self, name, parent_id=None, content_type='post'):
        response = self.client.post('/api/admin/repositories', json={'name': name, 'content_type': content_type, 'parent_id': parent_id})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def post(self, title, **values):
        response = self.client.post('/api/admin/posts', json={'title': title, **values})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def tree(self, content_type='post'):
        items = self.client.get(f'/api/admin/repositories?content_type={content_type}').json()
        return {item['name']: item for item in items}

    def test_new_repositories_are_appended_and_can_be_reordered_or_nested(self):
        a, b, c = self.repo('A'), self.repo('B'), self.repo('C')
        self.assertEqual([a['sort_order'], b['sort_order'], c['sort_order']], [0, 1, 2])

        moved = self.client.post(f"/api/admin/repositories/{c['id']}/move", json={'parent_id': None, 'position': 0})
        self.assertEqual(moved.status_code, 200, moved.text)
        tree = self.tree()
        self.assertEqual(sorted(tree, key=lambda name: tree[name]['sort_order']), ['C', 'A', 'B'])

        self.client.post(f"/api/admin/repositories/{b['id']}/move", json={'parent_id': a['id'], 'position': 0})
        tree = self.tree()
        self.assertEqual(tree['B']['parent_id'], a['id'])
        self.assertEqual(tree['A']['child_count'], 1)

    def test_move_rejects_cycles_and_other_content_types(self):
        parent = self.repo('Parent')
        child = self.repo('Child', parent['id'])
        cycle = self.client.post(f"/api/admin/repositories/{parent['id']}/move", json={'parent_id': child['id'], 'position': 0})
        self.assertEqual(cycle.status_code, 400)
        note_repo = self.repo('Photos', content_type='note')
        mixed = self.client.post(f"/api/admin/repositories/{child['id']}/move", json={'parent_id': note_repo['id'], 'position': 0})
        self.assertEqual(mixed.status_code, 400)

    def test_deleting_a_repository_can_lift_its_contents_one_level(self):
        root = self.repo('Root')
        middle = self.repo('Middle', root['id'])
        leaf = self.repo('Leaf', middle['id'])
        post = self.post('Inside', repository_id=middle['id'])

        self.assertEqual(self.client.delete(f"/api/admin/repositories/{middle['id']}").status_code, 409)
        self.assertEqual(self.client.delete(f"/api/admin/repositories/{middle['id']}?lift_contents=true").status_code, 200)

        tree = self.tree()
        self.assertNotIn('Middle', tree)
        self.assertEqual(tree['Leaf']['parent_id'], root['id'])
        self.assertEqual(self.client.get(f"/api/admin/posts/{post['id']}").json()['repository_id'], root['id'])
        self.assertEqual(leaf['id'], tree['Leaf']['id'])

    def test_bulk_move_publish_and_delete_posts(self):
        target = self.repo('Target')
        first = self.post('First', tag_names=['solo'])
        second = self.post('Second')
        ids = [first['id'], second['id']]

        moved = self.client.post('/api/admin/posts/bulk', json={'ids': ids, 'action': 'move', 'repository_id': target['id']})
        self.assertEqual(moved.json(), {'ok': True, 'count': 2})
        published = self.client.post('/api/admin/posts/bulk', json={'ids': ids, 'action': 'publish'})
        self.assertEqual(published.status_code, 200)
        public = self.client.get('/api/posts').json()
        self.assertEqual({item['repository_id'] for item in public}, {target['id']})
        self.assertEqual(len(public), 2)

        self.client.post('/api/admin/posts/bulk', json={'ids': [first['id']], 'action': 'delete'})
        self.assertEqual(self.client.get(f"/api/admin/posts/{first['id']}").status_code, 404)
        missing = self.client.post('/api/admin/posts/bulk', json={'ids': [first['id']], 'action': 'draft'})
        self.assertEqual(missing.status_code, 404)

    def test_publishing_a_draft_stamps_the_publish_time(self):
        draft = self.post('Draft', published_at='2020-01-01T00:00:00+00:00')
        self.assertTrue(draft['published_at'].startswith('2020-01-01'))
        published = self.client.put(f"/api/admin/posts/{draft['id']}", json={'status': 'published'}).json()
        self.assertFalse(published['published_at'].startswith('2020'))

        chosen = self.client.put(f"/api/admin/posts/{draft['id']}", json={'status': 'draft'}).json()
        republished = self.client.put(f"/api/admin/posts/{chosen['id']}", json={'status': 'published', 'published_at': '2021-05-06T07:08:09+00:00'}).json()
        self.assertTrue(republished['published_at'].startswith('2021-05-06'))

        edited = self.client.put(f"/api/admin/posts/{draft['id']}", json={'content': 'more', 'status': 'published'}).json()
        self.assertTrue(edited['published_at'].startswith('2021-05-06'))

    def test_post_slugs_are_derived_and_conflicts_are_reported(self):
        first = self.post('Hello World')
        second = self.post('Hello World')
        self.assertEqual(first['slug'], 'hello-world')
        self.assertEqual(second['slug'], 'hello-world-2')
        conflict = self.client.put(f"/api/admin/posts/{second['id']}", json={'slug': 'Hello World'})
        self.assertEqual(conflict.status_code, 409)
        renamed = self.client.put(f"/api/admin/posts/{second['id']}", json={'slug': '你好 世界'})
        self.assertEqual(renamed.json()['slug'], '你好-世界')

    def test_note_detail_bulk_and_publish_time(self):
        note = self.client.post('/api/admin/notes', json={'title': 'Trip', 'images': ['/uploads/a.webp']}).json()
        self.assertEqual(self.client.get(f"/api/admin/notes/{note['id']}").json()['title'], 'Trip')
        self.assertEqual(self.client.get(f"/api/notes/{note['id']}").status_code, 404)
        self.assertEqual(self.client.post(f"/api/notes/{note['id']}/like").status_code, 404)
        self.client.post('/api/admin/notes/bulk', json={'ids': [note['id']], 'action': 'publish'})
        self.assertEqual(self.client.get(f"/api/notes/{note['id']}").status_code, 200)

    def test_views_and_likes_do_not_count_as_edits(self):
        post = self.post('Read me', status='published')
        viewed = self.client.get(f"/api/posts/{post['slug']}").json()
        self.assertEqual(viewed['views'], 1)
        self.assertEqual(viewed['updated_at'], post['updated_at'])
        note = self.client.post('/api/admin/notes', json={'title': 'Like me', 'status': 'published'}).json()
        liked = self.client.post(f"/api/notes/{note['id']}/like").json()
        self.assertEqual(liked['likes'], 1)
        self.assertEqual(liked['updated_at'], note['updated_at'])

    def test_reading_time_counts_chinese_and_latin_text(self):
        self.assertEqual(reading_minutes(''), 1)
        self.assertEqual(reading_minutes('字' * 1200), 3)
        self.assertEqual(reading_minutes('word ' * 600), 3)


if __name__ == '__main__':
    unittest.main()
