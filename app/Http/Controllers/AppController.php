<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\Night;
use App\Models\PayrollPeriod;
use App\Models\User;
use App\Support\Books;
use Illuminate\Http\Request;

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
            $out['users'] = User::orderByRaw("FIELD(role,'owner','manager','staff')")->orderBy('name')->get()->map->toPublic()->values();
        }
        return response()->json($out);
    }

    private function publicConfig(): array
    {
        $list = fn ($k) => collect(config("books.$k"))->map(fn ($v, $key) => ['k' => $key] + $v)->values();
        return [
            'business' => config('books.business_name'),
            'owner' => config('books.owner_name'),
            'manager' => config('books.manager_name'),
            'income' => $list('income'),
            'expenses' => $list('expenses'),
            'paid' => config('books.paid_from'),
            'commRate' => config('books.commission_rate'),
            'drinkPrice' => config('books.drink_price'),
            'receiptFlag' => config('books.receipt_flag_amount'),
        ];
    }
}
