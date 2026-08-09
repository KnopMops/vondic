import json
import os
import sys

from app.main import app

sys.path.append(os.getcwd())


def generate_swagger_json():
    data = app.openapi()
    output_file = "api_docs.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Documentation generated successfully at {os.path.abspath(output_file)}")


if __name__ == "__main__":
    generate_swagger_json()
