<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Usage: ->middleware('role:owner') or ->middleware('role:owner,manager') */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        if (! $user || ! $user->active) {
            return response()->json(['message' => 'Please sign in again.'], 401);
        }
        if ($roles && ! in_array($user->role, $roles, true)) {
            return response()->json(['message' => 'You don’t have access to this.'], 403);
        }
        return $next($request);
    }
}
