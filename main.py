from fastapi import Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from browserkube import BrowserKube


# ============================================================================
class EditorApp(BrowserKube):
    def init_routes(self):
        self.app.mount("/assets", StaticFiles(directory="assets"), name="assets")
        self.app.mount("/dist", StaticFiles(directory="dist"), name="dist")

        super().init_routes()

        # pylint: disable=unused-variable
        @self.app.get("/", response_class=HTMLResponse)
        async def homepage(request: Request):
            return self.templates.TemplateResponse("index.html", {"request": request})


# ============================================================================
app = EditorApp().app
