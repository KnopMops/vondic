extension UrlHelper on String {
  String get toAbsoluteUrl {
    if (isEmpty) return this;
    if (startsWith('http')) {
      // Replicate website behavior: replace any fallback to local upload with s3
      if (contains('/uploads/')) {
        return replaceFirst(RegExp(r'https?://[^/]+/uploads/'), 'https://s3.vondic.ru/uploads/');
      }
      return this;
    }
    if (startsWith('/uploads/')) {
      return 'https://s3.vondic.ru$this';
    }
    final clean = startsWith('/') ? this : '/$this';
    return 'https://vondic.ru$clean';
  }
}

String? getAbsoluteUrl(String? url) {
  if (url == null || url.isEmpty) return null;
  return url.toAbsoluteUrl;
}
