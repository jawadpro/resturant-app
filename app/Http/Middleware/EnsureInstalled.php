<?php

namespace App\Http\Middleware;

use App\Models\Setting;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureInstalled
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! Setting::installed()) {
            return $request->expectsJson()
                ? response()->json(['message' => 'The app has not been set up yet.'], 503)
                : redirect('/install');
        }
        return $next($request);
    }
}
