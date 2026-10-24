"""Stage the bundled PDF reference library into the PRIVATE RAG review inbox.

No SQL writes, API calls, internet downloads, automatic approval or publication.
Run from existing project: py -3 tools/law_rag/stage_bundled_library.py
Requires tools/law_rag/requirements.txt in the Python environment used.
"""
import csv
import hashlib
import json
import shutil
import tempfile
from pathlib import Path
import pipeline

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / 'public' / 'library-catalog.json'
EVIDENCE = ROOT / 'evidence'


def stage():
    index = json.loads(CATALOG.read_text(encoding='utf-8'))
    entries = index.get('items')
    if not isinstance(entries, list) or len(entries) > 100:
        raise ValueError('Bundled library manifest missing or too large')
    with tempfile.TemporaryDirectory(prefix='gds-reference-stage-') as temp:
        staging = Path(temp)
        rows = []
        for item in entries:
            if not isinstance(item, dict) or item.get('status') != 'reference_unverified':
                raise ValueError('Only unverified reference items can be staged')
            relative = item.get('sourcePath')
            if not isinstance(relative, str):
                raise ValueError('Missing relative source path')
            src = (EVIDENCE / relative).resolve()
            if not src.is_relative_to(EVIDENCE.resolve()) or not src.is_file() or src.suffix.lower() != '.pdf':
                raise ValueError('Evidence file missing or escapes evidence folder')
            digest = hashlib.sha256(src.read_bytes()).hexdigest()
            if digest != item.get('sha256'):
                raise ValueError('Source file hash mismatch: ' + relative)
            filename = digest[:24] + '.pdf'
            shutil.copyfile(src, staging / filename)
            rows.append({'filename': filename, 'title': item['title'], 'domain': item['domain'],
                         'topic': item.get('topic') or 'tai-lieu-tham-khao', 'source_url': ''})
        manifest = staging / 'manifest.csv'
        with manifest.open('w', newline='', encoding='utf-8') as out:
            writer = csv.DictWriter(out, fieldnames=['filename', 'title', 'domain', 'topic', 'source_url'])
            writer.writeheader();writer.writerows(rows)
        report = pipeline.import_local(staging, manifest)
        if report['failed']:
            raise RuntimeError('Some files could not be staged; inspect report before processing')
        pipeline.process()
    print('BUNDLED REFERENCE STAGING COMPLETE:', len(rows), 'PDF(s) examined; all pending human review.')
    print('Documents are NOT published and NOT eligible as verified public chatbot evidence.')
    return report

if __name__ == '__main__':
    stage()
