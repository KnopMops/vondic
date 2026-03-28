from vondic_api import AuthenticationError, VondicAPIException, VondicClient

def main():

    api_key = "YOUR_API_KEY_HERE"
    client = VondicClient(api_key=api_key)

    try:

        print("Getting current user...")
        current_user = client.get_current_user()
        print(f"Current user: {current_user.username} ({current_user.id})")

        print("\nGetting recent posts...")
        posts = client.get_posts(limit=5)
        for i, post in enumerate(posts[:3], 1):
            username = post.user.username if post.user else "Unknown"
            print(f"{i}. {username}: {post.content[:50]}...")

        print("\nCreating a new post...")
        new_post = client.create_post(
            content="Hello from the Vondic API Python client! This is a test post.",
            privacy="public")
        print(f"Created post with ID: {new_post.id}")

        print("\nGetting users...")
        users = client.get_users(limit=5)
        for i, user in enumerate(users[:3], 1):
            print(f"{i}. {user.username} - {user.bio or 'No bio'}")

        if posts:
            print(f"\nGetting comments for post {posts[0].id}...")
            comments = client.get_comments_for_post(posts[0].id, limit=5)

            for i, comment in enumerate(comments[:3], 1):
                username = comment.user.username if comment.user else "Unknown"
                print(f"{i}. {username}: {comment.content[:50]}...")

        print("\nAll operations completed successfully!")

    except AuthenticationError:
        print("Authentication failed. Please check your API key.")
    except VondicAPIException as e:
        print(f"API Error: {e.message}")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")

if __name__ == "__main__":
    main()
