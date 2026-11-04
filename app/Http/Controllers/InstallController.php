<?php

namespace App\Http\Controllers;

use App\Http\Controllers\PayrollController;
use App\Models\Activity;
use App\Models\PayrollPeriod;
use App\Models\Setting;
use App\Models\User;
use App\Support\Books;
use App\Support\HistoryImport;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;

/**
 * First-time setup and later database updates, for hosting without a command line.
 * Protected by INSTALL_TOKEN in .env (at least 20 characters). Remove the token afterwards to switch this page off.
 */
class InstallController extends Controller
{
    private function tokenOk(?string $given): bool
    {
        $token = (string) config('books.install_token');
        return strlen($token) >= 20 && is_string($given) && hash_equals($token, $given);
    }

    public function show()
    {
        if (strlen((string) config('books.install_token')) < 20) abort(404);
        return view('install', ['installed' => Setting::installed(), 'import' => HistoryImport::available(), 'done' => session('done'), 'business' => config('books.business_name')]);
    }

    public function run(Request $request)
    {
        if (strlen((string) config('books.install_token')) < 20) abort(404);
        if (! $this->tokenOk($request->input('token'))) {
            return back()->withErrors(['token' => 'That setup token is not right.'])->withInput($request->except('token', 'password'));
        }

        Artisan::call('migrate', ['--force' => true]);
        $log = trim(Artisan::output());

        if (Setting::installed()) {
            return back()->with('done', 'Database is up to date.'.($log ? "\n".$log : ''));
        }

        $request->merge(['username' => Str::lower(trim((string) $request->input('username')))]);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'username' => ['required', 'regex:/^[a-z0-9._-]{2,20}$/'],
            'password' => ['required', 'string', 'min:8', 'max:200', 'confirmed'],
        ]);
        $owner = User::firstOrCreate(['username' => $data['username']], ['name' => $data['name'], 'role' => 'owner', 'password' => $data['password'], 'active' => true]);

        $msgs = ['Owner login created for '.$owner->username.'.'];
        $avail = HistoryImport::available();
        if ($request->boolean('import_nights') && $avail['nights']) $msgs[] = HistoryImport::nights().' nights imported.';
        if ($request->boolean('import_staff') && $avail['staff']) $msgs[] = HistoryImport::staff().' people added to payroll.';
        if (! PayrollPeriod::exists()) {
            [$s, $e] = PayrollController::periodFor(CarbonImmutable::parse(Books::today()));
            PayrollController::startPeriod($s, $e);
        }
        Setting::put('installed', '1');
        Activity::log($owner->name, 'set up MFD Books');

        return redirect('/install')->with('done', implode(' ', $msgs).' Setup is finished. Remove INSTALL_TOKEN from .env to switch this page off.');
    }
}
