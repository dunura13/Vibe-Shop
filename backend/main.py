from fastapi import FastAPI, UploadFile, File, HTTPException
from PIL import Image
from io import BytesIO
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone
import os
from dotenv import load_dotenv
import uvicorn

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = os.getenv("INDEX_NAME", "ecommerce-visual-search")


app = FastAPI(title="Vibe-Search API")

# load AI model
print("Loading CLIP Model...")
model = SentenceTransformer('clip-ViT-B-32')

print("Connecting to Pinecone...")
pc = Pinecone(api_key = PINECONE_API_KEY)
index = pc.Index(INDEX_NAME)

@app.get("/")
def home():
    return {"Message":"Vibe Search API is running!"}


@app.post("/search")
async def search_image(file: UploadFile = File(...)):
    try:
        # read image
        image_data = await file.read()
        image = Image.open(BytesIO(image_data)).convert("RGB")

        # generate embedding
        embedding = model.encode(image).tolist()

        # query pinecone
        results = index.query(
            vector=embedding,
            top_k=5,
            include_metadata=True
        )

        # convert pinecone vector into python dictionary
        final_matches = [match.to_dict() for match in results.matches]

        return {"matches":final_matches}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

    