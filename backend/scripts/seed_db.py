# Dec 22, 2025


# ETL pipeline
# extract images
# transform into vectors using CLIP
# save embeddings to pinecone

import os
import requests
from PIL import Image
from io import BytesIO
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv
from datasets import load_dataset


load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME =  os.getenv("INDEX_NAME")

if not PINECONE_API_KEY:
    raise ValueError("Pinecone api key not found")

# setup pinecone

print("Initializing Pinecone...")
pc = Pinecone(api_key=PINECONE_API_KEY)

# check if index exists, if not create it
if INDEX_NAME not in pc.list_indexes().names():
    pc.create_index(
        name=INDEX_NAME,
        dimension=512,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1")
    )
    print(f"Created index: {INDEX_NAME}")

index = pc.Index(INDEX_NAME) # set index object

# load CLIP model
model = SentenceTransformer('clip-ViT-B-32')

# Stream amazon products dataset (from huggingface)
print("Loading Amazon products dataset...")

dataset = load_dataset(
    "McAuley-Lab/Amazon-Reviews-2023", 
    "raw_meta_Home_and_Kitchen", 
    split="full", 
    streaming=True,
    trust_remote_code=True
)

# process and upsert 
MAX_ITEMS = 100 # limit to first 100 items for testing
vectors = []
processed_count = 0


headers = { # to avoid being blocked by amazon
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36"
}

print(f"Starting ETL. Goal: {MAX_ITEMS} items...")

for item in dataset:
    if processed_count >= MAX_ITEMS:
        break

    try:
        # filter items so they are high res and have a price
        if not item.get('images') or not item['images'].get('hi_res'):
            continue
        
        image_url = item['images']['hi_res'][0] # Get first image
        title = item.get('title', 'Unknown Product')
        price = item.get('price', '')

        if not price or price == "": # skip items with no price
            continue

        response = requests.get(image_url, headers=headers, timeout=5)

        if response.status_code != 200:
            print(f"Skipping {title[:20]}... (Status {response.status_code})")
            continue

        # convert to PIL image
        pil_image = Image.open(BytesIO(response.content)).convert("RGB")

        # generate vector
        embedding = model.encode(pil_image).tolist()

        # prepare metadata
        vector_data = {
            "id": item['parent_asin'], # unique Amazon ID
            "values": embedding,
            "metadata": {
                "name": title[:100], # truncate long titles
                "image_url": image_url,
                "price": str(price),
                "category": "Home_and_Kitchen"
            }
        }

        vectors.append(vector_data)
        processed_count+=1

        print(f"\n[{processed_count}/{MAX_ITEMS}] Processed: {title[:30]}...")

        # batch upsert
        if len(vectors) >= 20:
            index.upsert(vectors=vectors)
            vectors = []
            print("BATCH SAVED TO PINECONE")
    
    except Exception as e:
        continue

if vectors:
    index.upsert(vectors = vectors)
    print("Final Batch saved")

print(f"Success, indexed {processed_count} real amazon items")
