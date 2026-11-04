<?php

namespace App\Support;

use App\Http\Controllers\PayrollController;
use App\Models\Night;
use App\Models\PayrollPeriod;
use App\Models\Staff;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Imports history exported from the old spreadsheet. The files hold client data, so they live in
 * storage/app/import/ (git-ignored) and are never committed:
 *   nights.json  {"2026-04-03": {"inc": {"bar": 8150}, "exp": {"alcohol": 380}, "cash": {"qr": -1200, "card": 0, "banked": 0}}, ...}
 *   staff.json   [{"name": "...", "position": "...", "monthly": 10000}, ...]
 */
class HistoryImport
{
    public static function dir(): string
    {
        return storage_path('app/import');
    }

    public static function available(): array
    {
        return ['nights' => is_file(self::dir().'/nights.json'), 'staff' => is_file(self::dir().'/staff.json')];
    }

    public static function nights(?string $path = null): int
    {
        $path ??= self::dir().'/nights.json';
        $data = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        $inc = config('books.income'); $exp = config('books.expenses');
        $count = 0;
        DB::transaction(function () use ($data, $inc, $exp, &$count) {
            foreach ($data as $date => $r) {
                if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || Night::whereDate('date', $date)->exists()) continue;
                $n = Night::create([
                    'date' => $date, 'status' => 'approved', 'entered_by' => 'Excel import', 'approved_by' => 'Excel import',
                    'qr' => abs((float) ($r['cash']['qr'] ?? 0)), 'card' => abs((float) ($r['cash']['card'] ?? 0)), 'banked' => abs((float) ($r['cash']['banked'] ?? 0)),
                    'approved_at' => now(),
                ]);
                foreach (($r['inc'] ?? []) as $k => $v) if (isset($inc[$k]) && (float) $v != 0.0) $n->sales()->create(['category' => $k, 'amount' => $v]);
                $i = 0;
                foreach (($r['exp'] ?? []) as $k => $v) if (isset($exp[$k]) && (float) $v != 0.0) {
                    $n->expenses()->create(['uid' => Str::lower(Str::random(10)), 'category' => $k, 'amount' => $v, 'paid_from' => 'till', 'needs_receipt' => false, 'sort' => $i++]);
                }
                $count++;
            }
        });
        return $count;
    }

    public static function staff(?string $path = null): int
    {
        $path ??= self::dir().'/staff.json';
        $rows = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        $count = 0;
        foreach ($rows as $i => $r) {
            if (empty($r['name'])) continue;
            Staff::firstOrCreate(['name' => $r['name']], ['position' => $r['position'] ?? null, 'monthly' => (float) ($r['monthly'] ?? 0), 'active' => true, 'sort' => $i]);
            $count++;
        }
        if (! PayrollPeriod::exists()) {
            [$s, $e] = PayrollController::periodFor(CarbonImmutable::parse(Books::today()));
            PayrollController::startPeriod($s, $e);
        }
        return $count;
    }
}
