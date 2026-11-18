import hashlib
import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('release', Path(__file__).with_name('prepare-release.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

class ReleaseTests(unittest.TestCase):
    def setup_payload(self, root, extra=None):
        filename = 'learning-harness-codex-1.0.0.zip'
        with zipfile.ZipFile(root / filename, 'w') as z:
            for name, value in {'plugin/view.html': '<p>Learn</p>', 'plugin/THIRD_PARTY_NOTICES.txt': 'Notices', 'plugin/BETA_NOTICE.md': 'Beta', **(extra or {})}.items():
                z.writestr(name, value)
        manifest = {'schemaVersion': 1, 'tag': 'learning-harness-v1.0.0', 'approved': True, 'hosts': [{'host': 'codex', 'file': filename, 'sha256': hashlib.sha256((root / filename).read_bytes()).hexdigest(), 'checks': {g: {'passed': True, 'evidence': 'internal acceptance record'} for g in release.GATES}}]}
        (root / 'distribution.json').write_text(json.dumps(manifest))
        (root / 'RELEASE_NOTES.md').write_text('A public beta release.')
        return manifest
    def test_exports_only_public_payload(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t); self.setup_payload(root)
            (root / 'private-report.md').write_text('Must not be copied')
            files = release.prepare(root, root/'out', 'learning-harness-v1.0.0')
            self.assertEqual(len(files), 4)
            self.assertNotIn('checks', (root/'out/release.json').read_text())
            self.assertFalse((root/'out/distribution.json').exists())
    def test_missing_acceptance_and_tampering_fail_closed(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t); m = self.setup_payload(root)
            m['hosts'][0]['checks']['native_ui']['passed'] = False
            (root/'distribution.json').write_text(json.dumps(m))
            with self.assertRaises(ValueError): release.prepare(root, root/'out', m['tag'])
            m['hosts'][0]['checks']['native_ui']['passed'] = True
            m['hosts'][0]['sha256'] = '0'*64
            (root/'distribution.json').write_text(json.dumps(m))
            with self.assertRaises(ValueError): release.prepare(root, root/'out', m['tag'])
            self.assertFalse((root/'out').exists())
    def test_public_author_attribution_is_not_a_secret(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'attributed.zip'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('plugin/LICENSE', 'MIT License Copyright arvindm1991')
                archive.writestr('plugin/THIRD_PARTY_NOTICES.txt', 'Notices')
                archive.writestr('plugin/BETA_NOTICE.md', 'Beta')
            release.check_archive(path)

    def test_internal_files_traversal_and_identity_rejected(self):
        for name, content in [('plugin/../../private.txt','x'), ('plugin/evals/run.js','x'), ('plugin/config.js','/Users/someone/private'), ('plugin/a.js','-----BEGIN PRIVATE KEY-----')]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as t:
                root = Path(t); self.setup_payload(root, {name: content})
                with self.assertRaises(ValueError): release.prepare(root, root/'out', 'learning-harness-v1.0.0')
                self.assertFalse((root/'out').exists())

    def test_bad_tags_approval_host_and_empty_evidence_rejected(self):
        for change in ('tag', 'approved', 'host', 'evidence'):
            with self.subTest(change=change), tempfile.TemporaryDirectory() as t:
                root = Path(t); m = self.setup_payload(root)
                if change == 'tag': m['tag'] = 'learning-harness-v9.0.0'
                elif change == 'approved': m['approved'] = 'true'
                elif change == 'host': m['hosts'][0]['host'] = 'unknown'
                else: m['hosts'][0]['checks']['live_eval']['evidence'] = ''
                (root/'distribution.json').write_text(json.dumps(m))
                with self.assertRaises(ValueError): release.prepare(root, root/'out', 'learning-harness-v1.0.0')
                self.assertFalse((root/'out').exists())

if __name__ == '__main__': unittest.main()
