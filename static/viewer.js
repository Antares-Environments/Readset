const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const container = document.getElementById('viewer-container');
const uploadInput = document.getElementById('pdf-upload');

const BASE_SCALE = 1.5; 
let currentMemoryBlob = null; // Tracks the volatile RAM allocation

// Event Listener: Intercept the file the moment it is selected
uploadInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // EPHEMERAL PURGE: If a file is already loaded, destroy its memory pointer
    if (currentMemoryBlob) {
        URL.revokeObjectURL(currentMemoryBlob);
        container.innerHTML = ''; // Wipe the DOM
    }

    // Allocate the new file strictly to RAM
    currentMemoryBlob = URL.createObjectURL(file);

    // Feed the RAM blob to the rendering engine
    executeRender(currentMemoryBlob);
});

function executeRender(pdfUrl) {
    pdfjsLib.getDocument(pdfUrl).promise.then(async pdf => {
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: BASE_SCALE });
            
            const outputScale = window.devicePixelRatio || 1;

            // Structural Container
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page-container';
            pageDiv.style.width = `${viewport.width}px`;
            pageDiv.style.height = `${viewport.height}px`;

            // High-Fidelity Visual Canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;

            const transform = outputScale !== 1 
                ? [outputScale, 0, 0, outputScale, 0, 0] 
                : null;

            const renderContext = { 
                canvasContext: ctx, 
                transform: transform,
                viewport: viewport 
            };

            // Alignment Text Layer
            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'textLayer';
            textLayerDiv.style.width = `${viewport.width}px`;
            textLayerDiv.style.height = `${viewport.height}px`;
            textLayerDiv.style.setProperty('--scale-factor', viewport.scale);

            // Assemble DOM
            pageDiv.appendChild(canvas);
            pageDiv.appendChild(textLayerDiv);
            container.appendChild(pageDiv);

            // Execute Render
            await page.render(renderContext).promise;
            const textContent = await page.getTextContent();
            
            await pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayerDiv,
                viewport: viewport,
                textDivs: []
            }).promise;
        }
    }).catch(err => {
        console.error("Critical rendering failure: ", err);
    });
}