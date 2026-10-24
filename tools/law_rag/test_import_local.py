"""Isolated regression tests: staging never touches the real project or SQL."""
import contextlib
import csv
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('gds_law_pipeline',Path(__file__).with_name('pipeline.py'))
pipeline=importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)

class LocalIntakeTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory()
  self.addCleanup(self.tmp.cleanup)
  self.root=Path(self.tmp.name)
  self.upload=self.root/'intake';self.upload.mkdir()
  pipeline.ROOT=self.root
  pipeline.DATA=self.root/'data'/'law_rag'
  pipeline.RAW=pipeline.DATA/'raw'
  pipeline.TEXT=pipeline.DATA/'text'
  pipeline.PROCESSED=pipeline.DATA/'processed'

 def manifest(self,items):
  with (self.upload/'manifest.csv').open('w',encoding='utf-8',newline='') as f:
   writer=csv.DictWriter(f,fieldnames=['filename','title','domain','topic','source_url'])
   writer.writeheader();writer.writerows(items)
  return self.upload/'manifest.csv'

 def stage(self):
  with contextlib.redirect_stdout(io.StringIO()):
   return pipeline.import_local(self.upload,self.upload/'manifest.csv')

 def test_extract_dedupe_and_pending(self):
  (self.upload/'law.txt').write_text('Điều khoản thử nghiệm có cấu trúc. '*15,encoding='utf-8')
  (self.upload/'dup.txt').write_bytes((self.upload/'law.txt').read_bytes())
  m=self.manifest([
   dict(filename='law.txt',title='Tài liệu thử nghiệm',domain='LEGAL',topic='lao-dong',source_url='https://vbpl.vn/example'),
   dict(filename='dup.txt',title='Trùng nội dung',domain='LEGAL',topic='lao-dong',source_url=''),
  ])
  report=self.stage()
  self.assertEqual((report['imported'],report['unchanged'],report['failed']),(1,1,0))
  index=pipeline.PROCESSED/'documents.jsonl'
  arr=[json.loads(x) for x in index.read_text(encoding='utf-8').splitlines()]
  self.assertEqual(len(arr),1)
  self.assertEqual(arr[0]['intake_status'],'pending_review')
  self.assertIs(arr[0]['verified'],False)
  self.assertIs(arr[0]['published'],False)
  self.assertTrue((self.root/arr[0]['raw_file']).is_file())
  with contextlib.redirect_stdout(io.StringIO()):pipeline.process()
  chunks=(pipeline.PROCESSED/'chunks.jsonl').read_text(encoding='utf-8').strip().splitlines()
  self.assertGreater(len(chunks),0)
  self.assertTrue(all(json.loads(c)['verified'] is False for c in chunks))
  rerun=self.stage()
  self.assertEqual((rerun['imported'],rerun['unchanged'],rerun['failed']),(0,2,0))

 def test_invalid_path_and_source_not_accepted(self):
  (self.upload/'valid.txt').write_text('Dữ liệu thử nghiệm '*20,encoding='utf-8')
  self.manifest([
   dict(filename='../outside.txt',title='Tiêu đề thử nghiệm',domain='LEGAL',topic='law',source_url=''),
   dict(filename='valid.txt',title='Tiêu đề thử nghiệm',domain='LEGAL',topic='law',source_url='http://127.0.0.1/x'),
   dict(filename='valid.txt',title='Tiêu đề thử nghiệm',domain='SCAM',topic='warning',source_url=''),
  ])
  result=self.stage()
  self.assertEqual((result['imported'],result['failed']),(1,2))
  self.assertTrue(all('traversal' not in x['error'].lower() for x in result['failures']))

 def test_pdf_needs_ocr(self):
  import fitz
  doc=fitz.open();doc.new_page();doc.save(str(self.upload/'scan.pdf'));doc.close()
  self.manifest([dict(filename='scan.pdf',title='Tài liệu PDF scan',domain='ADMIN',topic='cu-tru',source_url='')])
  report=self.stage()
  self.assertEqual((report['imported'],report['requires_ocr']),(1,1))
  with contextlib.redirect_stdout(io.StringIO()):pipeline.process()
  self.assertEqual((pipeline.PROCESSED/'chunks.jsonl').read_text(encoding='utf-8'),'')

 def test_html_script_is_stripped(self):
  (self.upload/'notice.html').write_text('<html><body><script>STEAL_SECRET</script><h1>Thông báo</h1><p>'+('Nội dung hợp lệ '*25)+'</p></body></html>',encoding='utf-8')
  self.manifest([dict(filename='notice.html',title='Thông báo kiểm thử',domain='SCAM',topic='warning',source_url='')])
  report=self.stage()
  self.assertEqual(report['imported'],1)
  record=json.loads((pipeline.PROCESSED/'documents.jsonl').read_text(encoding='utf-8').strip())
  text=(self.root/record['text_file']).read_text(encoding='utf-8')
  self.assertNotIn('STEAL_SECRET',text)
  self.assertIn('Thông báo',text)

if __name__=='__main__':unittest.main(verbosity=2)
