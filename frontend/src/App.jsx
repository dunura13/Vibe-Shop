import {useState} from "react";


function App(){

  const[selectedImage, setSelectedImage] = useState(null);
  const[results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // handle image selection
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if(file){
      setSelectedImage(file);

      // fake local url to show preview
      const previewUrl = URL.createObjectURL(file);
      document.getElementById("preview").src = previewUrl;
    }
  };

  // send selected image to backendAPI
  const handleSearch = async() => {
    if(!selectedImage) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", selectedImage);
    try{
      const response = await fetch("http://127.0.0.1:8000/search", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResults(data.matches); // store the matches in state
    } catch(error){
      console.error("Error searching:", error);
    }finally{
      setLoading(false)
    }

  };


  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      {/* HEADER */}
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Vibe Search
        </h1>
        <p className="text-gray-400 text-lg mb-8">
          Upload an image to find products with the same aesthetic.
        </p>

        {/* UPLOAD SECTION */}
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-full md:w-1/2 bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
            <h2 className="text-xl font-semibold mb-4">1. Upload Image</h2>
            
            {/* Hidden Input + Custom Button */}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="block w-full text-sm text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-600 file:text-white
                hover:file:bg-blue-700
                cursor-pointer"
            />

            {/* Preview Box */}
            <div className="mt-6 relative w-full h-64 bg-gray-900 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center overflow-hidden">
              <img
                id="preview"
                src="#"
                alt="Preview"
                className={`max-h-full max-w-full object-contain ${
                  selectedImage ? "block" : "hidden"
                }`}
              />
              {!selectedImage && (
                <span className="text-gray-500">No image selected</span>
              )}
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearch}
              disabled={!selectedImage || loading}
              className={`mt-6 w-full py-3 px-4 rounded-lg font-bold text-lg transition-colors ${
                !selectedImage || loading
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30"
              }`}
            >
              {loading ? "Searching Vibe..." : "Find Matches 🔍"}
            </button>
          </div>

          {/* RESULTS SECTION */}
          <div className="w-full md:w-1/2">
            <h2 className="text-xl font-semibold mb-4">2. Visual Matches</h2>
            
            <div className="grid grid-cols-2 gap-4">
              {results.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-blue-500 transition-all group"
                >
                  {/* Image */}
                  <div className="aspect-square relative overflow-hidden bg-white">
                    <img
                      src={item.metadata.image_url}
                      alt={item.metadata.name}
                      className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  
                  {/* Info */}
                  <div className="p-3">
                    <p className="text-green-400 font-bold text-sm">
                      ${item.metadata.price}
                    </p>
                    <h3 className="text-gray-300 text-sm truncate mt-1">
                      {item.metadata.name}
                    </h3>
                  </div>
                </div>
              ))}
              
              {results.length === 0 && !loading && (
                <div className="col-span-2 text-center py-12 text-gray-500 border border-gray-700 border-dashed rounded-lg">
                  Results will appear here
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