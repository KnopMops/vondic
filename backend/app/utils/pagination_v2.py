"""V2 API cursor-based pagination helper."""
import base64
import json
import time
from typing import Any, Dict, List, Optional, Tuple


def encode_cursor(data: dict) -> str:
    """Encode a cursor dict to base64 string."""
    return base64.urlsafe_b64encode(
        json.dumps(data, default=str).encode()
    ).decode()


def decode_cursor(cursor: str) -> Optional[dict]:
    """Decode a base64 cursor string to dict."""
    try:
        return json.loads(
            base64.urlsafe_b64decode(cursor.encode()).decode()
        )
    except Exception:
        return None


def paginate_query(query, limit=20, cursor=None, order_field="created_at", id_field="id"):
    """
    Generic cursor-based pagination for SQLAlchemy queries.

    Args:
        query: SQLAlchemy query object
        limit: Items per page (max 100)
        cursor: Base64-encoded cursor string
        order_field: Column name to paginate on (default: created_at)
        id_field: Primary key column name (default: id)

    Returns:
        Tuple of (items, next_cursor, has_more)
    """
    if limit < 1:
        limit = 1
    if limit > 100:
        limit = 100

    if cursor:
        cursor_data = decode_cursor(cursor)
        if cursor_data:
            cursor_ts = cursor_data.get("ts")
            cursor_id = cursor_data.get("id")
            if cursor_ts and cursor_id:
                # Get items before this cursor (older items)
                order_col = getattr(query.column_descriptions()[0]["expr"], order_field, None)
                id_col = getattr(query.column_descriptions()[0]["expr"], id_field, None)

                if order_col is not None and id_col is not None:
                    query = query.filter(
                        (order_col < cursor_ts) |
                        ((order_col == cursor_ts) & (id_col < cursor_id))
                    )

    # Get one extra to detect has_more
    items = query.order_by(
        getattr(query.column_descriptions()[0]["expr"], order_field).desc(),
        getattr(query.column_descriptions()[0]["expr"], id_field).desc()
    ).limit(limit + 1).all()

    has_more = len(items) > limit
    items = items[:limit]

    next_cursor = None
    if has_more and items:
        last = items[-1]
        next_cursor = encode_cursor({
            "ts": getattr(last, order_field, None),
            "id": getattr(last, id_field, None),
        })

    return items, next_cursor, has_more


def paginate_list(items: list, limit=20, cursor=None, key_fn=None):
    """
    Cursor-based pagination for a Python list.

    Args:
        items: List of dicts/objects to paginate
        limit: Items per page
        cursor: Base64-encoded cursor string
        key_fn: Function to extract (timestamp, id) from item

    Returns:
        Tuple of (items_page, next_cursor, has_more)
    """
    if limit < 1:
        limit = 1
    if limit > 100:
        limit = 100

    if key_fn is None:
        key_fn = lambda x: (x.get("created_at", 0), x.get("id", ""))

    start_idx = 0
    if cursor:
        cursor_data = decode_cursor(cursor)
        if cursor_data:
            cursor_ts = cursor_data.get("ts")
            cursor_id = cursor_data.get("id")
            for i, item in enumerate(items):
                ts, iid = key_fn(item)
                if ts < cursor_ts or (ts == cursor_ts and iid < cursor_id):
                    start_idx = i
                    break

    page = items[start_idx:start_idx + limit + 1]
    has_more = len(page) > limit
    page = page[:limit]

    next_cursor = None
    if has_more and page:
        last = page[-1]
        ts, iid = key_fn(last)
        next_cursor = encode_cursor({"ts": ts, "id": iid})

    return page, next_cursor, has_more


def paginated_response(items, next_cursor, has_more, page=1):
    """Create a standard paginated response dict."""
    result = {
        "items": items,
        "has_more": has_more,
    }
    if next_cursor:
        result["next_cursor"] = next_cursor
    if page:
        result["page"] = page
    return result
