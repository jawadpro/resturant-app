<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:40'],
            'password' => ['required', 'string', 'max:200'],
        ]);
        $username = Str::lower(trim($data['username']));
        $key = 'login:'.$username.'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, 5)) {
            $wait = RateLimiter::availableIn($key);
            return response()->json(['message' => "Too many tries. Wait {$wait} seconds."], 429);
        }

        $user = User::where('username', $username)->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($key, 30);
            return response()->json(['message' => 'That username and password don’t match.'], 422);
        }
        if (! $user->active) {
            return response()->json(['message' => 'This login is turned off. Ask the owner to turn it back on.'], 403);
        }

        RateLimiter::clear($key);
        Auth::login($user);
        $request->session()->regenerate();
        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json(['ok' => true, 'csrf' => csrf_token()]);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return response()->json(['ok' => true, 'csrf' => csrf_token()]);
    }

    public function changePassword(Request $request)
    {
        $data = $request->validate([
            'current' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'max:200'],
        ]);
        $user = $request->user();
        if (! Hash::check($data['current'], $user->password)) {
            return response()->json(['message' => 'Your current password is not right.'], 422);
        }
        $user->password = $data['password'];
        $user->save();
        Activity::log($user->name, 'changed their password');
        return response()->json(['ok' => true]);
    }
}
