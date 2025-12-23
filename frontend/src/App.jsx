import { useState, useRef, useEffect } from "react";

function App() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [boxes, setBoxes] = useState([]); // store YOLO boxes
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // canvas refs for drawing boxes and cropping
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  // handle image upload & auto-detect
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSelectedImage(file);
    setBoxes([]); // clear old boxes
    setResults([]); // clear old results
    
    // create preview URL
    const previewUrl = URL.createObjectURL(file);
    if(imgRef.current) imgRef.current.src = previewUrl;

    // run object detection immediately
    await detectObjects(file);
  };

  // call YOLO API
  const detectObjects = async (file) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:8000/detect", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setBoxes(data.detections); // save boxes to state
    } catch (error) {
      console.error("Detection failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // handle box click (crop & search)
  const handleBoxClick = async (box) => {
    if (!imgRef.current) return;

    setLoading(true);
    
    // create a temporary canvas to crop the image
    const [x1, y1, x2, y2] = box.box;
    const width = x2 - x1;
    const height = y2 - y1;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");


    // need to scale coordinates if the displayed image size differs from natural size
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    ctx.drawImage(
      imgRef.current,
      x1, y1, width, height, // original image
      0, 0, width, height    // destination (canvas)
    );

    // convert canvas to blob (file)
    canvas.toBlob(async (blob) => {

      // send cropped image to search API
      const formData = new FormData();
      formData.append("file", blob);

      try {
        const response = await fetch("http://127.0.0.1:8000/search", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        setResults(data.matches);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setLoading(false);
      }
    }, "image/jpeg");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Vibe Shop <span className="text-2xl text-gray-500 font-normal ml-2">(AI Object Detection)</span>
        </h1>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* LEFT: Upload & Detection Area */}
          <div className="w-full lg:w-1/2 space-y-6">
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
              <h2 className="text-xl font-semibold mb-4">1. Upload Room Photo</h2>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
              />

              {/* Image Container */}
              <div className="mt-6 relative w-full bg-gray-900 rounded-lg overflow-hidden border-2 border-dashed border-gray-600">
                {/* The Image */}
                <img
                  ref={imgRef}
                  alt="Preview"
                  className={`w-full h-auto block ${!selectedImage ? 'hidden' : ''}`}
                />

                {/* The Detection Overlay */}
                {boxes.map((det, i) => {
                   // Calculate percentages for responsive boxes
                   const img = imgRef.current;
                   if(!img) return null;
                   
                   const [x1, y1, x2, y2] = det.box;
                   const width = x2 - x1;
                   const height = y2 - y1;
                   
                   // Convert to % to be responsive
                   const left = (x1 / img.naturalWidth) * 100;
                   const top = (y1 / img.naturalHeight) * 100;
                   const w = (width / img.naturalWidth) * 100;
                   const h = (height / img.naturalHeight) * 100;

                   return (
                    <button
                      key={i}
                      onClick={() => handleBoxClick(det)}
                      style={{
                        position: 'absolute',
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${w}%`,
                        height: `${h}%`,
                      }}
                      className="border-2 border-red-500 bg-red-500/20 hover:bg-red-500/40 transition-colors group cursor-pointer"
                    >
                      <span className="absolute -top-6 left-0 bg-red-500 text-white text-xs px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {det.label} ({Math.round(det.score * 100)}%)
                      </span>
                    </button>
                   );
                })}

                {!selectedImage && (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    No image selected
                  </div>
                )}
              </div>
              
              <p className="mt-4 text-sm text-gray-400 text-center">
                {loading ? "AI is processing..." : boxes.length > 0 ? "👆 Click a red box to search for that item!" : "Upload an image to detect objects"}
              </p>
            </div>
          </div>

          {/* RIGHT: Results Area */}
          <div className="w-full lg:w-1/2">
            <h2 className="text-xl font-semibold mb-4">2. Visual Matches</h2>
            <div className="grid grid-cols-2 gap-4">
              {results.map((item) => (
                <div key={item.id} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-blue-500 transition-all">
                  <div className="aspect-square relative bg-white">
                    <img
                      src={item.metadata.image_url}
                      alt={item.metadata.name}
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-green-400 font-bold text-sm">${item.metadata.price}</p>
                    <h3 className="text-gray-300 text-sm truncate mt-1">{item.metadata.name}</h3>
                  </div>
                </div>
              ))}
              {results.length === 0 && (
                <div className="col-span-2 text-center py-12 text-gray-500 border border-gray-700 border-dashed rounded-lg">
                  {loading ? "Searching..." : "Select an object to see matches"}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;