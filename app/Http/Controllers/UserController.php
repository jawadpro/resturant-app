<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Owner only: create and manage logins. */
class UserController extends Controller
{
    public static function generatePassword(): string
    {
        $words = ['mango', 'lotus', 'sunset', 'bamboo', 'coral', 'orchid', 'pepper', 'island', 'harbor', 'jasmine', 'papaya', 'lagoon'];
        return $words[random_int(0, count($words) - 1)].'-'.$words[random_int(0, count($words) - 1)].random_int(10, 99);
    }

    private function list()
    {
        return User::orderByRaw("FIELD(role,'owner','manager','staff')")->orderBy('name')->get()->map->toPublic()->values();
    }

    public function store(Request $request)
    {
        $request->merge(['username' => Str::lower(trim((string) $request->input('username')))]);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'username' => ['required', 'string', 'regex:/^[a-z0-9._-]{2,20}$/', Rule::unique('users', 'username')],
            'role' => ['required', Rule::in(User::ROLES)],
            'password' => ['required', 'string', 'min:8', 'max:200'],
        ], [
            'username.regex' => 'Usernames use 2–20 letters or numbers, no spaces.',
            'username.unique' => 'That username is taken. Try another.',
            'password.min' => 'Passwords need at least 8 characters.',
        ]);
        $u = User::create($data + ['active' => true]);
        Activity::log($request->user()->name, "added {$u->name} as ".$u->role);
        return response()->json(['user' => $u->toPublic(), 'users' => $this->list()]);
    }

    public function resetPassword(Request $request, User $user)
    {
        abort_if($user->id === $request->user()->id, 422, 'Change your own password from your account menu.');
        $pw = self::generatePassword();
        $user->password = $pw;
        $user->save();
        Activity::log($request->user()->name, "reset {$user->name}’s password");
        return response()->json(['password' => $pw, 'user' => $user->toPublic()]);
    }

    public function toggle(Request $request, User $user)
    {
        abort_if($user->id === $request->user()->id, 422, 'You can’t turn off your own login.');
        if ($user->isOwner() && $user->active && User::where('role', 'owner')->where('active', true)->count() <= 1) {
            abort(422, 'There must always be at least one owner who can sign in.');
        }
        $user->active = ! $user->active;
        $user->save();
        Activity::log($request->user()->name, ($user->active ? 'turned on ' : 'turned off ')."{$user->name}’s login");
        return response()->json(['users' => $this->list()]);
    }

    public function destroy(Request $request, User $user)
    {
        abort_if($user->id === $request->user()->id, 422, 'You can’t remove your own login.');
        if ($user->isOwner() && User::where('role', 'owner')->count() <= 1) abort(422, 'There must always be at least one owner.');
        $name = $user->name;
        $user->delete();
        Activity::log($request->user()->name, "removed {$name}’s login");
        return response()->json(['users' => $this->list()]);
    }
}
