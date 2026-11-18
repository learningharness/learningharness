"""Validate private release assets and export only the public payload. No execution."""
import hashlib
import json
import re
import stat
import sys
import zipfile
from pathlib import Path, PurePosixPath

GATES = ('native_ui', 'session_binding', 'host_model', 'fresh_install', 'live_eval')
SENSITIVE = re.compile(rb'/Users/|/home/runner/|dontdumbai@gmail\.com|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_-]{20,}', re.I)
BLOCKED = {'.git', '.env', 'node_modules', 'evals', 'fixtures', 'reports', 'learner.json', 'companion.json', 'writer.lock', 'COORDINATOR.md'}

def check_archive(path):
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        if not entries or len(entries) > 15000 or sum(e.file_size for e in entries) > 200_000_000:
            raise ValueError('Empty or oversized release archive')
        seen = set()
        for entry in entries:
            name = entry.filename
            parts = PurePosixPath(name).parts
            if not parts or name.startswith('/') or '\\' in name or any(p in ('.', '..') or ':' in p for p in parts):
                raise ValueError('Unsafe archive path')
            if any(p in BLOCKED or p.startswith('.env.') for p in parts):
                raise ValueError('Internal/state file in release archive')
            if name in seen:
                raise ValueError('Duplicate archive entry')
            seen.add(name)
            mode = entry.external_attr >> 16
            if stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR):
                raise ValueError('Special file in archive')
            if SENSITIVE.search(name.encode()) or (not entry.is_dir() and SENSITIVE.search(archive.read(entry))):
                raise ValueError('Private identity, path or credential in release archive')
        names = {PurePosixPath(n).name for n in seen}
        if not {'THIRD_PARTY_NOTICES.txt', 'BETA_NOTICE.md'}.issubset(names):
            raise ValueError('Release notices missing')

def prepare(source, destination, tag):
    source, destination = Path(source), Path(destination)
    if not re.fullmatch(r'learning-harness-v\d+\.\d+\.\d+(?:-[a-z0-9]+(?:[.-][a-z0-9]+)*)?', tag):
        raise ValueError('Invalid release tag')
    if destination.exists():
        raise ValueError('Output must be a fresh directory')
    manifest = json.loads((source / 'distribution.json').read_text())
    if manifest.get('schemaVersion') != 1 or manifest.get('tag') != tag or manifest.get('approved') is not True:
        raise ValueError('Release is not explicitly approved for this tag')
    if not isinstance(manifest.get('hosts'), list) or not manifest['hosts']:
        raise ValueError('No accepted hosts')
    payload, public_hosts, hosts = {}, [], set()
    for host in manifest['hosts']:
        name = host.get('host')
        if name not in ('codex', 'claude', 'opencode') or name in hosts:
            raise ValueError('Invalid or duplicate host')
        hosts.add(name)
        checks = host.get('checks', {})
        if any(checks.get(g, {}).get('passed') is not True or not isinstance(checks[g].get('evidence'), str) or not checks[g]['evidence'].strip() for g in GATES):
            raise ValueError('Host acceptance evidence missing')
        filename = host.get('file', '')
        if not re.fullmatch(r'learning-harness-' + name + r'-[a-z0-9.-]+\.zip', filename) or filename in payload:
            raise ValueError('Invalid artifact filename')
        path = source / filename
        if path.is_symlink() or not path.is_file():
            raise ValueError('Missing regular release archive')
        if path.stat().st_size > 100_000_000:
            raise ValueError('Release archive exceeds size limit')
        data = path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        if host.get('sha256') != digest:
            raise ValueError('Artifact checksum mismatch')
        check_archive(path)
        payload[filename] = data
        public_hosts.append({'host': name, 'file': filename, 'sha256': digest})
    notes = (source / 'RELEASE_NOTES.md').read_bytes()
    if not notes.strip() or len(notes) > 50000 or SENSITIVE.search(notes):
        raise ValueError('Invalid public release notes')
    payload['RELEASE_NOTES.md'] = notes
    payload['release.json'] = (json.dumps({'schemaVersion': 1, 'tag': tag, 'hosts': public_hosts}, indent=2) + '\n').encode()
    payload['SHA256SUMS'] = ''.join(hashlib.sha256(data).hexdigest() + '  ' + name + '\n' for name, data in sorted(payload.items())).encode()
    destination.mkdir(parents=True)
    for name, data in payload.items():
        (destination / name).write_bytes(data)
    return sorted(payload)

if __name__ == '__main__':
    try:
        print('\n'.join(prepare(*sys.argv[1:])))
    except Exception as error:
        sys.exit('Release validation failed: ' + str(error))
