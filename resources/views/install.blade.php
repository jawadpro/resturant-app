<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Set up MFD Books</title>
<link rel="stylesheet" href="{{ asset('assets/app.css') }}?v={{ filemtime(public_path('assets/app.css')) }}">
</head>
<body>
<div class="login"><div class="lbox" style="grid-template-columns:1fr;max-width:560px">
  <form class="lform" method="post" action="/install">
    @csrf
    <div class="logo" style="padding:0"><span class="m"><i></i><i></i><i></i><i></i></span>MFD Books</div>
    <div><h1>{{ $installed ? 'Update the database' : 'Set up '.$business }}</h1>
      <p class="muted" style="margin:6px 0 0">{{ $installed ? 'Runs any pending database updates after a new version is uploaded.' : 'Creates the database tables and the owner login. Only needed once.' }}</p></div>
    @if ($done)<div class="banner b-good" style="white-space:pre-line">{{ $done }}</div>@endif
    @if ($errors->any())<div class="banner b-crit">{{ $errors->first() }}</div>@endif
    <label class="f" for="token">Setup token <span class="muted xs" style="font-weight:400">from INSTALL_TOKEN in .env</span><input type="password" id="token" name="token" required autocomplete="off"></label>
    @unless ($installed)
      <label class="f" for="name">Owner's name<input type="text" id="name" name="name" value="{{ old('name') }}" required></label>
      <label class="f" for="username">Owner's username<input type="text" id="username" name="username" value="{{ old('username') }}" required autocapitalize="none"></label>
      <label class="f" for="password">Password <span class="muted xs" style="font-weight:400">at least 8 characters</span><input type="password" id="password" name="password" required minlength="8" autocomplete="new-password"></label>
      <label class="f" for="password_confirmation">Password again<input type="password" id="password_confirmation" name="password_confirmation" required minlength="8" autocomplete="new-password"></label>
      @if ($import['nights'])<label class="row small"><input type="checkbox" name="import_nights" value="1" checked> Import the nights in storage/app/import/nights.json</label>@endif
      @if ($import['staff'])<label class="row small"><input type="checkbox" name="import_staff" value="1" checked> Add the people in storage/app/import/staff.json to payroll</label>@endif
    @endunless
    <button class="btn pri" type="submit" style="padding:12px">{{ $installed ? 'Run updates' : 'Set up' }}</button>
    @if ($installed)<a class="btn" href="/">Open the app</a>@endif
  </form>
</div></div>
</body>
</html>
