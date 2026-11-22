<?php

namespace App\Support;

use App\Models\Night;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/** Business date and the arithmetic behind every screen and report. Mirrors public/assets/app.js. */
class Books
{
    public static function now(): CarbonImmutable
    {
        return CarbonImmutable::now(config('books.timezone'));
    }

    /** Tonight's business date: before the cut-off hour it still counts as the previous night. */
    public static function today(): string
    {
        $now = static::now();
        if ($now->hour < config('books.cutoff_hour')) $now = $now->subDay();
        return $now->format('Y-m-d');
    }

    public static function expenseGroup(string $cat): ?string
    {
        return config("books.expenses.$cat.group");
    }

    /** sales, costs (P&L), capex, paid from till, cash sales, expected cash, till difference, profit. */
    public static function calc(Night $n): array
    {
        $sales = (float) $n->sales->sum('amount');
        $pl = 0.0; $capex = 0.0; $till = 0.0;
        foreach ($n->expenses as $e) {
            $a = (float) ($e->amount ?? 0);
            $g = static::expenseGroup($e->category);
            if ($g === 'capital') $capex += $a; elseif ($g !== 'advance') $pl += $a;
            if ($e->paid_from === 'till') $till += $a;
        }
        $cashSales = $sales - (float) $n->qr - (float) $n->card - (float) $n->grab;
        $expected = $n->opening_float === null ? null : (float) $n->opening_float + $cashSales - $till - (float) $n->banked;
        $variance = ($expected === null || $n->counted === null) ? null : (float) $n->counted - $expected;
        return compact('sales', 'pl', 'capex', 'till', 'cashSales', 'expected', 'variance') + ['net' => $sales - $pl];
    }

    /** Nights in a date range that count toward the books (not drafts, not closed). */
    public static function nights(string $from, string $to): Collection
    {
        return Night::with(['sales', 'expenses'])
            ->whereBetween('date', [$from, $to])
            ->whereNotIn('status', ['draft', 'closed'])
            ->orderBy('date')->get();
    }

    public static function month(string $ym): array
    {
        $start = CarbonImmutable::parse($ym.'-01');
        $nights = static::nights($start->format('Y-m-d'), $start->endOfMonth()->format('Y-m-d'));
        $a = ['sales' => 0.0, 'pl' => 0.0, 'capex' => 0.0, 'inc' => [], 'exp' => [], 'nights' => 0];
        foreach ($nights as $n) {
            $c = static::calc($n);
            $a['sales'] += $c['sales']; $a['pl'] += $c['pl']; $a['capex'] += $c['capex'];
            if ($c['sales'] > 0) $a['nights']++;
            foreach ($n->sales as $s) $a['inc'][$s->category] = ($a['inc'][$s->category] ?? 0) + (float) $s->amount;
            foreach ($n->expenses as $e) if (! static::expenseGroup($e->category)) $a['exp'][$e->category] = ($a['exp'][$e->category] ?? 0) + (float) $e->amount;
        }
        $a['net'] = $a['sales'] - $a['pl'];
        $a['margin'] = $a['sales'] ? $a['net'] / $a['sales'] : null;
        return $a;
    }

    /** Half-month pay. Rent and electricity come off first, then advances; anything left over carries. */
    public static function pay(array $r): array
    {
        $half = $r['m'] / 2; $daily = $r['m'] * 12 / 365;
        $gross = max(0, $half - $r['abs'] * $daily - $r['fine']);
        $left = $gross;
        $rent = min($r['rent'], $left); $left -= $rent;
        $elec = min($r['elec'], $left); $left -= $elec;
        $adv = min($r['adv'], $left); $left -= $adv;
        $carry = $r['rent'] + $r['elec'] + $r['adv'] - $rent - $elec - $adv;
        return ['half' => $half, 'daily' => $daily, 'absDed' => $r['abs'] * $daily, 'gross' => $gross, 'rent' => $rent, 'elec' => $elec, 'adv' => $adv, 'carry' => $carry, 'pay' => $left];
    }

    public static function label(string $kind, string $key): string
    {
        return config("books.$kind.$key.en") ?? $key;
    }
}
