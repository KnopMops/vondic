"""
Example usage of the Vondic API Client Library.
"""
from vondic_api import AuthenticationError, VondicAPIException, VondicClient


def main():
    """
    Example demonstrating various API operations.
    """
    # Initialize the client with your API key
    # NOTE: Replace with your actual API key
    api_key = "YOUR_API_KEY_HERE"
    client = VondicClient(api_key=api_key)

    try:
        # Get current user
        print("Getting current user...")
        current_user = client.get_current_user()
        print(f"Current user: {current_user.username} ({current_user.id})")

        # Get recent posts
        print("\nGetting recent posts...")
        posts = client.get_posts(limit=5)
        for i, post in enumerate(posts[:3], 1):  # Show first 3 posts
            username = post.user.username if post.user else "Unknown"
            print(f"{i}. {username}: {post.content[:50]}...")

        # Create a new post
        print("\nCreating a new post...")
        new_post = client.create_post(
            content="Hello from the Vondic API Python client! This is a test post.",
            privacy="public")
        print(f"Created post with ID: {new_post.id}")

        # Get users
        print("\nGetting users...")
        users = client.get_users(limit=5)
        for i, user in enumerate(users[:3], 1):  # Show first 3 users
            print(f"{i}. {user.username} - {user.bio or 'No bio'}")

        # Get comments for a post
        if posts:
            print(f"\nGetting comments for post {posts[0].id}...")
            comments = client.get_comments_for_post(posts[0].id, limit=5)
            # Show first 3 comments
            for i, comment in enumerate(comments[:3], 1):
                username = comment.user.username if comment.user else "Unknown"
                print(f"{i}. {username}: {comment.content[:50]}...")

        # Send a message (if you have a recipient ID)
        # Uncomment and adjust as needed
        # print("\nSending a message...")
        # message = client.send_message(
        #     recipient_id="RECIPIENT_USER_ID",
        #     content="Hello from the API client!"
        # )
        # print(f"Sent message with ID: {message.id}")

        print("\nAll operations completed successfully!")

    except AuthenticationError:
        print("Authentication failed. Please check your API key.")
    except VondicAPIException as e:
        print(f"API Error: {e.message}")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")


if __name__ == "__main__":
    main()
