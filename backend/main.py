from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from io import BytesIO
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone
import os
from dotenv import load_dotenv
import uvicorn
from ultralytics import YOLO

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = os.getenv("INDEX_NAME", "ecommerce-visual-search")


app = FastAPI(title="Vibe-Search API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods = ["*"],
    allow_headers = ["*"]
)

# load CLIP model - "the brain"
print("Loading CLIP Model...")
clip_model = SentenceTransformer('clip-ViT-B-32')

# load YOLO-World model - "the eye"
print("Loading YOLO-World Model...")
yolo_model = YOLO('yolov8s-world.pt') # n for nano (smallest + fastest)

# THIS LINE IS USED TO TEACH THE MODEL - tell it exactly what to look for (MAY NEED MODIFICATIONS)
yolo_model.set_classes(["lamp", "floor lamp", "sofa", "couch", "table", "chair", "plant", "bed"])

print("Connecting to Pinecone...")
pc = Pinecone(api_key = PINECONE_API_KEY)
index = pc.Index(INDEX_NAME)

@app.get("/")
def home():
    return {"Message":"Vibe Search API is running!"}


@app.post("/search")
async def search_image(file: UploadFile = File(...), label: str = Form(None)):
    try:
        # read image
        image_data = await file.read()
        image = Image.open(BytesIO(image_data)).convert("RGB")

        # generate embedding
        embedding = clip_model.encode(image).tolist()

        # query pinecone
        results = index.query(
            vector=embedding,
            top_k=50,
            include_metadata=True
        )

        # convert pinecone vector into python dictionary
        final_matches = [match.to_dict() for match in results.matches]

        if label:
            print(f"Filtering for: {label}")
            filtered_matches = []

            #key word mapping (YOLO label -> Amazon keywords), adding synonyms
            keywords = [label.lower()]

            # SYNONYMS
            if label == "couch":
                keywords.append("sofa")
            
            if label == "sofa":
                keywords.append("couch")
            
            if label == "cup":
                keywords.append("mug")
            
            for match in final_matches:
                product_name = match['metadata']['name'].lower()

                # check if any keyword is in the product name
                if any(k in product_name for k in keywords):
                    filtered_matches.append(match)
                
            # if the filter worked, use it, if it filtered EVEYRTHING, fall back to raw visual matches

            if filtered_matches:
                final_matches = filtered_matches[:5] # Return top 5 valid ones
            else:
                print("Warning: Filter was too strict, returning raw visual matches.")
                final_matches = final_matches[:5]
        else:
            final_matches = final_matches[:5]
        
        return {"matches":final_matches}

    
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect")
async def detect_objects(file: UploadFile = File(...)):
    # scan image, return bounding boxes for furniture

    try:
        # first read image
        image_data = await file.read()
        image = Image.open(BytesIO(image_data)).convert("RGB")

        # Run YOLO
        yolo_model.set_classes(["lamp", "floor lamp", "sofa", "couch", "table", "chair", "plant", "bed"]) # re-assert custom classes
        results = yolo_model.predict(image, conf=0.1) # keep predictions YOLO is 10% sure about

        # format for frontend
        detections = []
        for result in results:
            for box in result.boxes:
                # get coordinates
                x1, y1, x2, y2 = box.xyxy[0].tolist()

                # get class name
                class_id = int(box.cls[0])
                label = yolo_model.names[class_id]

                # filter in order to return only relevant items
                detections.append({
                    "box":[x1,y1,x2,y2],
                    "label":label,
                    "score":float(box.conf[0])
                })

        return {"detections":detections}

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

    