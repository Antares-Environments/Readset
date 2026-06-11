const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const container = document.getElementById('viewer-container');
const uploadInput = document.getElementById('pdf-upload');
const sideDock = document.getElementById('side-dock');
const pageTracker = document.getElementById('page-tracker');
const topDock = document.getElementById('top-dock');

const BASE_SCALE = 1.5; 
let currentMemoryBlob = null; 
let totalPages = 0;

// ==========================================================
// THE SPATIAL OBSERVER (Page Tracking)
// ==========================================================
const pageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        // If the page is at least 50% visible in the viewport
        if (entry.isIntersecting) {
            const pageNum = entry.target.getAttribute('data-page-num');
            
            // 1. Update Top Tracker
            pageTracker.innerText = `Page ${pageNum} / ${totalPages}`;
            
            // 2. Synchronize Sidebar Target Highlight
            document.querySelectorAll('.thumb-target').forEach(btn => btn.classList.remove('active'));
            const activeThumb = document.getElementById(`thumb-${pageNum}`);
            if (activeThumb) {
                activeThumb.classList.add('active');
                // Auto-scroll the sidebar to keep the active target in view
                activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    });
}, { threshold: 0.5 }); // Triggers when 50% of a page crosses the screen

// ==========================================================
// VOLATILE FILE INTERCEPTION
// ==========================================================
uploadInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (currentMemoryBlob) {
        URL.revokeObjectURL(currentMemoryBlob);
        container.innerHTML = ''; 
        sideDock.innerHTML = ''; // Wipe old sidebar
    }

    currentMemoryBlob = URL.createObjectURL(file);
    executeRender(currentMemoryBlob);
});

function executeRender(pdfUrl) {
    pdfjsLib.getDocument(pdfUrl).promise.then(async pdf => {
        totalPages = pdf.numPages;
        sideDock.classList.remove('hidden'); // Reveal sidebar on load
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: BASE_SCALE });
            const outputScale = window.devicePixelRatio || 1;

            // 1. Structural Canvas 
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page-container';
            pageDiv.style.width = `${viewport.width}px`;
            pageDiv.style.height = `${viewport.height}px`;
            pageDiv.setAttribute('data-page-num', pageNum); // Tag for the observer

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;

            const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
            const renderContext = { canvasContext: ctx, transform: transform, viewport: viewport };

            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'textLayer';
            textLayerDiv.style.width = `${viewport.width}px`;
            textLayerDiv.style.height = `${viewport.height}px`;
            textLayerDiv.style.setProperty('--scale-factor', viewport.scale);

            pageDiv.appendChild(canvas);
            pageDiv.appendChild(textLayerDiv);
            container.appendChild(pageDiv);

            // 2. Build Sidebar Navigation Target
            const thumbBtn = document.createElement('button');
            thumbBtn.className = 'thumb-target';
            thumbBtn.id = `thumb-${pageNum}`;
            thumbBtn.innerText = `[ PG ${pageNum.toString().padStart(3, '0')} ]`;
            thumbBtn.onclick = () => {
                pageDiv.scrollIntoView({ behavior: 'smooth' });
            };
            sideDock.appendChild(thumbBtn);

            // 3. Register page with the Spatial Observer
            pageObserver.observe(pageDiv);

            // 4. Execute Render
            await page.render(renderContext).promise;
            const textContent = await page.getTextContent();
            
            await pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayerDiv,
                viewport: viewport,
                textDivs: []
            }).promise;
        }
    }).catch(err => console.error("Rendering failure: ", err));
}

// ==========================================================
// UI KINEMATICS & FOCUS MODE
// ==========================================================
let lastScrollTop = 0;
let isAbsoluteFocusMode = false;

window.addEventListener('scroll', () => {
    if (isAbsoluteFocusMode) return; 

    let currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    
    // Purge both docks from viewport on downward scroll
    if (currentScroll > lastScrollTop && currentScroll > 50) {
        topDock.classList.add('hidden-top');
        sideDock.classList.add('hidden-side');
    } 
    // Summon both docks on upward scroll
    else {
        topDock.classList.remove('hidden-top');
        sideDock.classList.remove('hidden-side');
    }
    lastScrollTop = currentScroll <= 0 ? 0 : currentScroll; 
}, { passive: true });

// Hardware Interrupt: [H] Key
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h') {
        isAbsoluteFocusMode = !isAbsoluteFocusMode;
        
        if (isAbsoluteFocusMode) {
            topDock.classList.add('hidden-top');
            sideDock.classList.add('hidden-side');
        } else {
            topDock.classList.remove('hidden-top');
            sideDock.classList.remove('hidden-side');
        }
    }
});