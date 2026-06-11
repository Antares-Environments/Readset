from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn

app = FastAPI(title="Antares PDF Vault - Ephemeral Engine", version="2.0")

# Mount only the execution assets
app.mount("/static", StaticFiles(directory="static"), name="static")

# Connect the Jinja2 template engine
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def render_interface(request: Request):
    """Renders the secure, stateless vault interface."""
    return templates.TemplateResponse("index.html", {"request": request})

if __name__ == "__main__":
    print("Ephemeral Environment active on http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")