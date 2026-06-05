#!/usr/bin/env python3
"""
Vondic Desktop Client
Authenticates via Yandex using API key and cloud password from .env
"""

import os
import sys
import requests
from dotenv import load_dotenv
from urllib.parse import urlencode


desktop_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(desktop_dir, ".env.desktop")
load_dotenv(env_path)


class VondicDesktopClient:
    """Desktop client for Vondic API with Yandex authentication"""

    def __init__(self):
        self.backend_url = os.getenv("BACKEND_URL", "http://localhost:5000")
        self.api_key = os.getenv("API_KEY")
        self.cloud_password = os.getenv("CLOUD_PASSWORD")
        self.yandex_client_id = os.getenv("YANDEX_CLIENT_ID")
        self.yandex_client_secret = os.getenv("YANDEX_CLIENT_SECRET")
        self.yandex_redirect_uri = os.getenv("YANDEX_REDIRECT_URI")
        self.device_name = os.getenv("DEVICE_NAME", "Vondic Desktop")
        self.device_type = os.getenv("DEVICE_TYPE", "desktop")

        self.access_token = None
        self.refresh_token = None
        self.user_info = None
        self.session = requests.Session()

    def authenticate_with_api_key(self):
        """
        Authenticate using API key and cloud password.
        This uses the existing /api/v1/auth/api-key-login endpoint.
        """
        if not self.api_key:
            return False, "API_KEY not found in .env.desktop"

        url = f"{self.backend_url}/api/v1/auth/api-key-login"
        payload = {
            "api_key": self.api_key,
        }
        if self.cloud_password:
            payload["cloud_password"] = self.cloud_password

        try:
            response = self.session.post(url, json=payload)
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access_token")
                self.refresh_token = data.get("refresh_token")
                self.user_info = data.get("user")
                return True, data
            else:
                error = response.json().get("error", "Unknown error")
                return False, f"Authentication failed: {error}"
        except Exception as e:
            return False, f"Request failed: {str(e)}"

    def get_yandex_auth_url(self):
        """Get Yandex OAuth URL for desktop authentication"""
        url = f"{self.backend_url}/api/v1/auth/yandex/login"
        try:
            response = self.session.get(url)
            if response.status_code == 200:
                data = response.json()
                return data.get("auth_url"), None
            return None, response.json().get("error", "Failed to get auth URL")
        except Exception as e:
            return None, f"Request failed: {str(e)}"

    def check_yandex_desktop_session(self, cid):
        """
        Check if Yandex desktop session is ready.
        Used after OAuth flow to get tokens.
        """
        url = f"{self.backend_url}/api/v1/auth/yandex/desktop-session"
        params = {"cid": cid}
        try:
            response = self.session.get(url, params=params)
            data = response.json()
            if data.get("ready"):
                self.access_token = data.get("access_token")
                self.refresh_token = data.get("refresh_token")
                self.user_info = data.get("user")
                return True, data
            return False, data
        except Exception as e:
            return False, f"Request failed: {str(e)}"

    def authenticate_with_yandex_oauth(self):
        """
        Full Yandex OAuth flow for desktop:
        1. Get auth URL
        2. Open browser for user to authorize
        3. Poll for session completion
        """
        import webbrowser
        import time

        cid = os.urandom(16).hex()

        auth_url, error = self.get_yandex_auth_url()
        if error:
            return False, error

        if "?" in auth_url:
            auth_url += f"&state={cid}"
        else:
            auth_url += f"?state={cid}"

        print(f"Opening browser for Yandex authentication...")
        print(f"Auth URL: {auth_url}")

        webbrowser.open(auth_url)

        print("Waiting for authentication...")
        max_attempts = 60
        for attempt in range(max_attempts):
            ready, data = self.check_yandex_desktop_session(cid)
            if ready:
                return True, data
            time.sleep(2)

        return False, "Authentication timeout"

    def get_user_info(self):
        """Get current user info using access token"""
        if not self.access_token:
            return False, "Not authenticated"

        url = f"{self.backend_url}/api/v1/auth/me"
        payload = {"access_token": self.access_token}
        try:
            response = self.session.post(url, json=payload)
            if response.status_code == 200:
                return True, response.json()
            return False, response.json().get("error", "Failed to get user info")
        except Exception as e:
            return False, f"Request failed: {str(e)}"

    def make_authenticated_request(self, method, endpoint, **kwargs):
        """Make an authenticated request to the API"""
        if not self.access_token:
            return False, "Not authenticated"

        url = f"{self.backend_url}{endpoint}"
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {self.access_token}"

        try:
            response = self.session.request(
                method, url, headers=headers, **kwargs)
            return True, response
        except Exception as e:
            return False, f"Request failed: {str(e)}"

    def is_authenticated(self):
        """Check if client is authenticated"""
        return self.access_token is not None

    def logout(self):
        """Clear authentication tokens"""
        self.access_token = None
        self.refresh_token = None
        self.user_info = None


def main():
    """Main entry point for desktop client"""
    print("=" * 50)
    print("Vondic Desktop Client")
    print("=" * 50)

    client = VondicDesktopClient()

    if client.api_key:
        print("\nAttempting authentication with API key...")
        success, result = client.authenticate_with_api_key()
        if success:
            print("✓ Authentication successful!")
            print(
                f"  User: {
                    client.user_info.get('username') if client.user_info else 'Unknown'}")
            print(
                f"  Email: {
                    client.user_info.get('email') if client.user_info else 'Unknown'}")
        else:
            print(f"✗ Authentication failed: {result}")
            return 1
    else:
        print("\nNo API_KEY found in .env.desktop")
        print("Starting Yandex OAuth flow...")
        success, result = client.authenticate_with_yandex_oauth()
        if success:
            print("✓ Yandex authentication successful!")
            print(
                f"  User: {
                    client.user_info.get('username') if client.user_info else 'Unknown'}")
        else:
            print(f"✗ Authentication failed: {result}")
            return 1

    print("\nMaking authenticated request to /api/v1/auth/me...")
    success, response = client.make_authenticated_request(
        "POST", "/api/v1/auth/me", json={"access_token": client.access_token})
    if success and response.status_code == 200:
        print("✓ Request successful!")
        print(f"  Response: {response.json()}")

    print("\n" + "=" * 50)
    print("Desktop client is ready!")
    print("=" * 50)

    return 0


if __name__ == "__main__":
    sys.exit(main())
