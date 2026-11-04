<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="csrf-token" content="{{ csrf_token() }}">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#1D4A35">
<title>MFD Books</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Thai:wght@400;500;600&display=swap">
<link rel="stylesheet" href="{{ asset('assets/app.css') }}?v={{ filemtime(public_path('assets/app.css')) }}">
</head>
<body>
<div id="app"><div class="login"><p class="muted">Loading…</p></div></div>
<div id="toast" class="toast" hidden></div>
<div id="modal" hidden></div>
<script src="{{ asset('assets/app.js') }}?v={{ filemtime(public_path('assets/app.js')) }}"></script>
</body>
</html>
