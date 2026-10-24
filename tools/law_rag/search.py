"""Command-line semantic search with grounded citations from the ingested documents.
Does not assert legal validity, and does not generate model answers.
"""
import argparse,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def main():
 p=argparse.ArgumentParser();p.add_argument('question');p.add_argument('--domain',choices=['LEGAL','ADMIN']);p.add_argument('--topic');p.add_argument('--limit',type=int,default=5);args=p.parse_args()
 import chromadb
 from sentence_transformers import SentenceTransformer
 db=ROOT/'data'/'law_rag'/'chroma';collection=chromadb.PersistentClient(path=str(db)).get_collection('gds_legal_v1')
 model=SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
 where={}
 if args.domain:where['domain']=args.domain
 if args.topic:where['topic']=args.topic
 if len(where)>1:where={'$and':[{k:v} for k,v in where.items()]}
 q={'query_embeddings':[model.encode(args.question,normalize_embeddings=True).tolist()], 'n_results':max(1,min(20,args.limit))}
 if where:q['where']=where
 res=collection.query(**q)
 for meta,doc,dist in zip(res['metadatas'][0],res['documents'][0],res['distances'][0]):
  print(json.dumps({'title':meta['title'],'topic':meta['topic'],'source_url':meta['url'],'score_distance':dist,'verified':False,'excerpt':doc[:700]},ensure_ascii=False))
if __name__=='__main__':main()
