"""Stage auto-downloaded official PDFs into the PRIVATE unverified RAG inbox.

The public original-source index is independent of legal knowledge publication.
No SQL approval, source verification, or chatbot public evidence is created here.
"""
import csv
import hashlib
import json
import re
import shutil
import tempfile
from pathlib import Path
import pipeline

ROOT=Path(__file__).resolve().parents[2]
CATALOG=ROOT/'public'/'official-reference-catalog.json'
PUBLIC_PDF=ROOT/'public'/'library-files'
PDF_NAME=re.compile(r'^/library-files/(official-[a-f0-9]{24}\.pdf)$')

def stage():
    if not CATALOG.is_file():
        print('No official-reference-catalog.json yet. Run official RSS sync first.')
        return {'imported':0,'unchanged':0,'failed':0}
    catalog=json.loads(CATALOG.read_text(encoding='utf-8'))
    if catalog.get('schemaVersion')!=1 or catalog.get('source')!='congbao.chinhphu.vn':
        raise ValueError('Unsupported official catalog')
    items=catalog.get('items')
    if not isinstance(items,list) or len(items)>20000:
        raise ValueError('Invalid official catalog size')
    with tempfile.TemporaryDirectory(prefix='gds-official-pending-') as tmp:
        directory=Path(tmp)
        rows=[]
        for item in items:
            if not isinstance(item,dict) or item.get('status')!='official_source_validity_unchecked':
                raise ValueError('Unexpected official catalog status')
            link=item.get('localPdfUrl')
            if not link:continue
            m=PDF_NAME.fullmatch(link)
            if not m:raise ValueError('Unsafe PDF path')
            src=PUBLIC_PDF/m.group(1)
            if not src.is_file() or src.stat().st_size>25_000_000:raise ValueError('Missing or oversized downloaded PDF')
            digest=hashlib.sha256(src.read_bytes()).hexdigest()
            if digest != item.get('sha256') or not src.name.startswith('official-'+digest[:24]):
                raise ValueError('Official file integrity failed')
            url=item.get('sourceUrl','')
            if not isinstance(url,str) or not url.startswith('https://congbao.chinhphu.vn/'):
                raise ValueError('Untrusted official source URL')
            filename=digest[:24]+'.pdf'
            shutil.copyfile(src,directory/filename)
            rows.append({'filename':filename,'title':item.get('title',''),
                         'domain':item.get('domain','LEGAL'),
                         'topic':item.get('topic','Văn bản khác'), 'source_url':url})
        if not rows:
            print('No PDF downloads to stage yet. Original official references remain available on the website.')
            return {'imported':0,'unchanged':0,'failed':0}
        with (directory/'manifest.csv').open('w',newline='',encoding='utf-8') as fp:
            writer=csv.DictWriter(fp,fieldnames=['filename','title','domain','topic','source_url'])
            writer.writeheader();writer.writerows(rows)
        result=pipeline.import_local(directory,directory/'manifest.csv')
        if result['failed']:
            raise RuntimeError('Some files failed private RAG staging: '+str(result['failures'][:3]))
        pipeline.process()
    print(f"OFFICIAL PRIVATE RAG STAGING: {len(rows)} PDF examined; {result['imported']} imported; all PENDING_REVIEW.")
    return result

if __name__=='__main__':stage()
