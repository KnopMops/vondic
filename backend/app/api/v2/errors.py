from fastapi.responses import JSONResponse


def validation_error(message: str, status_code: int = 400):
    return JSONResponse(status_code=status_code, content={"error": message})


def not_found(message: str = "Not found"):
    return JSONResponse(status_code=404, content={"error": message})
