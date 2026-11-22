<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\Night;
use App\Models\PayrollPeriod;
use App\Models\User;
use App\Support\Books;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

class AppController extends Controller
{
    public function index()
    {
        return view('app', ['business' => config('books.business_name')]);
    }

    /** Everything the signed-in person is allowed to see, in one call. */
    public function bootstrap(Request $request)
    {
        $user = $request->user();
        if (! $user || ! $user->active) {
            return response()->json(['me' => null, 'config' => $this->publicConfig(), 'today' => Books::today()]);
        }
        $today = Books::today();

        $q = Night::with(['sales', 'expenses']);
        if ($user->isStaff()) {
            // Staff see the nights they entered, plus tonight.
            $q->where(fn ($w) => $w->where('entered_by_id', $user->id)->orWhereDate('date', $today));
        }
        $nights = $q->orderBy('date')->get()->mapWithKeys(fn ($n) => [$n->dateString() => $n->toApp()]);

        $out = [
            'me' => $user->toPublic(),
            'today' => $today,
            'config' => $this->publicConfig(),
            'nights' => $nights->isEmpty() ? new \stdClass() : $nights,
            'firstDate' => Night::min('date'),
            // Tonight's opening float starts from the last cash count.
            'lastCount' => ($c = Night::whereDate('date', '<', $today)->whereNotNull('counted')->orderByDesc('date')->value('counted')) === null ? null : (float) $c,
        ];
        if ($user->canManage()) {
            $out['payroll'] = PayrollPeriod::with('lines')->latest('start_date')->first()?->toApp();
            $out['activity'] = Activity::latest('id')->limit(30)->get()->map->toApp()->values();
        }
        if ($user->isOwner()) {
            $out['pendingUpdates'] = count(self::pendingMigrations());
            $out['users'] = User::orderByRaw("CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END")->orderBy('name')->get()->map->toPublic()->values();
        }
        return response()->json($out);
    }

    /** Database changes shipped with the code but not yet applied. */
    public static function pendingMigrations(): array
    {
        try {
            $migrator = app('migrator');
            if (! $migrator->repositoryExists()) return [];
            $files = array_keys($migrator->getMigrationFiles(database_path('migrations')));
            return array_values(array_diff($files, $migrator->getRepository()->getRan()));
        } catch (\Throwable) {
            return [];
        }
    }

    /** Owner only: apply pending database changes after a new version is uploaded. */
    public function applyUpdates(Request $request)
    {
        $pending = self::pendingMigrations();
        if (! $pending) return response()->json(['ok' => true, 'applied' => 0]);
        Artisan::call('migrate', ['--force' => true]);
        Activity::log($request->user()->name, 'applied a database update');
        return response()->json(['ok' => true, 'applied' => count($pending)]);
    }

    /**
     * Who approves the night, from the real logins: the active manager (or "the manager" if there
     * are several); if nobody is a manager, the owner. The .env names are only a fallback.
     */
    private function people(): array
    {
        $active = User::where('active', true)->orderBy('id')->get(['name', 'role']);
        $owners = $active->where('role', 'owner')->pluck('name')->values();
        $managers = $active->where('role', 'manager')->pluck('name')->values();
        $owner = $owners->count() === 1 ? $owners[0] : ($owners->count() > 1 ? 'the owner' : config('books.owner_name'));
        $approver = match (true) {
            $managers->count() === 1 => $managers[0],
            $managers->count() > 1 => 'the manager',
            default => $owner,
        };
        return [$owner, $approver];
    }

    private function publicConfig(): array
    {
        $list = fn ($k) => collect(config("books.$k"))->map(fn ($v, $key) => ['k' => $key] + $v)->values();
        try { [$owner, $approver] = $this->people(); } catch (\Throwable) { [$owner, $approver] = [config('books.owner_name'), config('books.manager_name')]; }
        return [
            'business' => config('books.business_name'),
            'owner' => $owner,
            'manager' => $approver,
            'income' => $list('income'),
            'expenses' => $list('expenses'),
            'paid' => config('books.paid_from'),
            'commRate' => config('books.commission_rate'),
            'drinkPrice' => config('books.drink_price'),
            'receiptFlag' => config('books.receipt_flag_amount'),
        ];
    }
}
