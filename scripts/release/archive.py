"""Create normalized, reviewed distribution ZIPs without local build records."""
import importlib.util
import sys
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

source,destination,root=Path(sys.argv[1]),Path(sys.argv[2]),sys.argv[3]
with ZipFile(destination,'w',ZIP_DEFLATED) as archive:
    for path in sorted(source.rglob('*')):
        relative=path.relative_to(source)
        if 'ui-build' in relative.parts:continue
        if path.is_symlink():raise ValueError('Symlink in package')
        if not path.is_file():continue
        entry=ZipInfo(str(Path(root)/relative),(2026,1,1,0,0,0));entry.compress_type=ZIP_DEFLATED
        entry.external_attr=0o100644<<16
        archive.writestr(entry,path.read_bytes())
spec=importlib.util.spec_from_file_location('validation',Path(__file__).parents[1]/'distribution/prepare-release.py')
validation=importlib.util.module_from_spec(spec);spec.loader.exec_module(validation)
validation.check_archive(destination)
