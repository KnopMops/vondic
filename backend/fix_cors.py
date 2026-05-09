with open('/home/knopmops/vondic/backend/app/__init__.py', 'r', encoding='utf-8') as f:
    content = f.read()


old_code = """            excluded_headers = {
                'content-encoding',
                'content-length',
                'transfer-encoding',
                'connection'}
            headers = [
                (name, value)
                for name, value in resp.raw.headers.items()
                if name.lower() not in excluded_headers
            ]

            return Response(resp.content, resp.status_code, headers)"""

new_code = """            excluded_headers = {
                'content-encoding',
                'content-length',
                'transfer-encoding',
                'connection'}
            headers = [
                (name, value)
                for name, value in resp.raw.headers.items()
                if name.lower() not in excluded_headers
            ]

            # Add CORS headers for video playback
            origin = request.headers.get('Origin', '*')
            headers.append(('Access-Control-Allow-Origin', origin))
            headers.append(('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD'))
            headers.append(('Access-Control-Allow-Headers', '*'))
            headers.append(('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type'))
            headers.append(('Access-Control-Allow-Credentials', 'true'))

            return Response(resp.content, resp.status_code, headers)"""

if old_code in content:
    content = content.replace(old_code, new_code)
    print('Added CORS headers to proxy response')
else:
    print('WARNING: Could not find the proxy response section!')


old_fallback_1 = """        except http_requests.exceptions.ConnectionError:
            uploads_folder = os.getenv('UPLOADS_DIR', '/app/uploads')
            return send_from_directory(uploads_folder, filename)"""

new_fallback_1 = """        except http_requests.exceptions.ConnectionError:
            uploads_folder = os.getenv('UPLOADS_DIR', '/app/uploads')
            response = send_from_directory(uploads_folder, filename)
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS, HEAD'
            return response"""

if old_fallback_1 in content:
    content = content.replace(old_fallback_1, new_fallback_1)
    print('Added CORS headers to ConnectionError fallback')
else:
    print('WARNING: Could not find ConnectionError fallback!')


old_fallback_2 = """        except Exception as e:
            print(f"Error proxying to static nginx for uploads: {e}")
            uploads_folder = os.getenv('UPLOADS_DIR', '/app/uploads')
            return send_from_directory(uploads_folder, filename)"""

new_fallback_2 = """        except Exception as e:
            print(f"Error proxying to static nginx for uploads: {e}")
            uploads_folder = os.getenv('UPLOADS_DIR', '/app/uploads')
            response = send_from_directory(uploads_folder, filename)
            response.headers['Access-Control-Allow-Origin'] = '*'
            return response"""

if old_fallback_2 in content:
    content = content.replace(old_fallback_2, new_fallback_2)
    print('Added CORS headers to Exception fallback')
else:
    print('WARNING: Could not find Exception fallback!')

with open('/home/knopmops/vondic/backend/app/__init__.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('CORS headers fix completed!')
