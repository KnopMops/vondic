import json
import os
import sys

sys.path.append(os.getcwd())

from app import create_app


def generate_swagger_json():
    app = create_app()
    
    with app.test_client() as client:
        response = client.get('/apispec.json')
        
        if response.status_code == 200:
            data = response.get_json()
            
            output_file = 'api_docs.json'
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            print(f"Documentation generated successfully at {os.path.abspath(output_file)}")
        else:
            print(f"Failed to fetch documentation. Status code: {response.status_code}")
            print(response.data.decode('utf-8'))

if __name__ == "__main__":
    generate_swagger_json()
