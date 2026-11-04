<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\PayrollPeriod;
use App\Support\Books;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

/** Owner only: every report as a CSV file (UTF-8 with BOM so Excel shows Thai text correctly). */
class ReportController extends Controller
{
    public const TYPES = [
        'daily' => 'Daily summary', 'sales' => 'Sales by category', 'expenses' => 'Expenses list',
        'pl' => 'Monthly profit and loss', 'cash' => 'Cash counts', 'payroll' => 'Payroll', 'all' => 'Everything',
    ];
    private const STATUS = ['draft' => 'Being filled in', 'submitted' => 'Waiting for approval', 'approved' => 'Approved', 'closed' => 'Closed'];

    public function download(Request $request, string $type)
    {
        abort_unless(isset(self::TYPES[$type]), 404);
        $data = $request->validate(['from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d']]);
        $to = $data['to'] ?? Books::today();
        $from = $data['from'] ?? CarbonImmutable::parse($to)->startOfMonth()->format('Y-m-d');
        if ($from > $to) [$from, $to] = [$to, $from];

        $rows = $this->rows($type, $from, $to);
        $name = 'MFD_'.str_replace(' ', '_', self::TYPES[$type]).'_'.($type === 'payroll' ? 'current_period' : "{$from}_to_{$to}").'.csv';
        Activity::log($request->user()->name, 'downloaded the '.strtolower(self::TYPES[$type]).' report');

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            foreach ($rows as $r) fputcsv($out, $r, ',', '"', '\\', "\r\n");
            fclose($out);
        }, $name, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** First rows of a report for the on-screen preview. */
    public function preview(Request $request, string $type)
    {
        abort_unless(isset(self::TYPES[$type]), 404);
        $data = $request->validate(['from' => ['required', 'date_format:Y-m-d'], 'to' => ['required', 'date_format:Y-m-d']]);
        [$from, $to] = $data['from'] <= $data['to'] ? [$data['from'], $data['to']] : [$data['to'], $data['from']];
        $rows = $this->rows($type, $from, $to);
        return response()->json(['head' => $rows[0] ?? [], 'rows' => array_slice($rows, 1, 8), 'count' => max(0, count($rows) - 1)]);
    }

    public function rows(string $type, string $from, string $to): array
    {
        $inc = config('books.income'); $exp = config('books.expenses'); $paid = config('books.paid_from');
        $n2 = fn ($v) => number_format((float) $v, 2, '.', '');
        $dow = fn ($d) => CarbonImmutable::parse($d)->format('D');

        switch ($type) {
            case 'daily':
                $rows = [array_merge(['Date', 'Day', 'Status', 'Entered by', 'Approved by'], array_column($inc, 'en'), ['Total sales', 'QR / PromptPay', 'Card', 'Cash sales', 'Total costs', 'Profit', 'Cash counted', 'Till difference'])];
                foreach (Books::nights($from, $to) as $n) {
                    $c = Books::calc($n); $s = $n->sales->pluck('amount', 'category');
                    $rows[] = array_merge([$n->dateString(), $dow($n->date), self::STATUS[$n->status], $n->entered_by, $n->approved_by],
                        array_map(fn ($k) => $n2($s[$k] ?? 0), array_keys($inc)),
                        [$n2($c['sales']), $n2($n->qr), $n2($n->card), $n2($c['cashSales']), $n2($c['pl']), $n2($c['net']), $n->counted === null ? '' : $n2($n->counted), $c['variance'] === null ? '' : $n2($c['variance'])]);
                }
                return $rows;

            case 'sales':
                $rows = [array_merge(['Date'], array_column($inc, 'en'), ['Total'])]; $tot = [];
                foreach (Books::nights($from, $to) as $n) {
                    $s = $n->sales->pluck('amount', 'category'); $line = [$n->dateString()]; $sum = 0;
                    foreach (array_keys($inc) as $k) { $v = (float) ($s[$k] ?? 0); $sum += $v; $tot[$k] = ($tot[$k] ?? 0) + $v; $line[] = $n2($v); }
                    $line[] = $n2($sum); $rows[] = $line;
                }
                $rows[] = array_merge(['TOTAL'], array_map(fn ($k) => $n2($tot[$k] ?? 0), array_keys($inc)), [$n2(array_sum($tot))]);
                return $rows;

            case 'expenses':
                $rows = [['Date', 'Category', 'Thai', 'Amount (THB)', 'Paid from', 'Note', 'Receipt', 'Entered by', 'Status']];
                foreach (Books::nights($from, $to) as $n) foreach ($n->expenses as $e) {
                    $rows[] = [$n->dateString(), $exp[$e->category]['en'] ?? $e->category, $exp[$e->category]['th'] ?? '', $n2($e->amount), $paid[$e->paid_from]['en'], $e->note,
                        $e->receipt_path ? 'Yes' : ($e->needs_receipt ? 'No' : '—'), $n->entered_by, self::STATUS[$n->status]];
                }
                return $rows;

            case 'pl':
                $months = [];
                for ($m = CarbonImmutable::parse($from)->startOfMonth(); $m->format('Y-m') <= substr($to, 0, 7); $m = $m->addMonth()) $months[] = $m->format('Y-m');
                $A = array_combine($months, array_map([Books::class, 'month'], $months));
                $rows = [array_merge(['Line'], array_map(fn ($m) => CarbonImmutable::parse($m.'-01')->format('M Y'), $months))];
                foreach ($inc as $k => $c) $rows[] = array_merge([$c['en']], array_map(fn ($m) => $n2($A[$m]['inc'][$k] ?? 0), $months));
                $rows[] = array_merge(['Total sales'], array_map(fn ($m) => $n2($A[$m]['sales']), $months));
                foreach ($exp as $k => $c) {
                    if (isset($c['group'])) continue;
                    if (! array_filter($months, fn ($m) => ! empty($A[$m]['exp'][$k]))) continue;
                    $rows[] = array_merge([$c['en']], array_map(fn ($m) => $n2($A[$m]['exp'][$k] ?? 0), $months));
                }
                $rows[] = array_merge(['Total costs'], array_map(fn ($m) => $n2($A[$m]['pl']), $months));
                $rows[] = array_merge(['Profit'], array_map(fn ($m) => $n2($A[$m]['net']), $months));
                $rows[] = array_merge(['Margin %'], array_map(fn ($m) => $A[$m]['margin'] === null ? '' : number_format($A[$m]['margin'] * 100, 1), $months));
                $rows[] = array_merge(['Refurbishment (not in costs)'], array_map(fn ($m) => $n2($A[$m]['capex']), $months));
                return $rows;

            case 'cash':
                $rows = [['Date', 'Entered by', 'Opening float', 'Cash sales', 'Paid from till', 'Taken to bank', 'Expected in till', 'Counted', 'Difference']];
                foreach (Books::nights($from, $to) as $n) {
                    if ($n->opening_float === null && $n->counted === null) continue;
                    $c = Books::calc($n);
                    $rows[] = [$n->dateString(), $n->entered_by, $n2($n->opening_float), $n2($c['cashSales']), $n2($c['till']), $n2($n->banked),
                        $c['expected'] === null ? '' : $n2($c['expected']), $n->counted === null ? '' : $n2($n->counted), $c['variance'] === null ? '' : $n2($c['variance'])];
                }
                return $rows;

            case 'payroll':
                $p = PayrollPeriod::with('lines')->latest('start_date')->first();
                $rows = [['Period', 'Name', 'Position', 'Monthly', 'Half-month', 'Absent days', 'Absence deduction', 'Late fine', 'Gross', 'Rent', 'Electricity', 'Advance', 'Net pay', 'Carried to next pay']];
                if ($p) foreach ($p->lines as $l) {
                    $r = $l->toApp(); $x = Books::pay($r);
                    $rows[] = [$p->label(), $l->name, $l->position, $n2($l->monthly), $n2($x['half']), $l->absent_days, $n2($x['absDed']), $n2($l->late_fine), $n2($x['gross']), $n2($x['rent']), $n2($x['elec']), $n2($x['adv']), $n2(round($x['pay'])), $n2($x['carry'])];
                }
                return $rows;

            case 'all':
                $rows = [['Date', 'Status', 'Entered by', 'Approved by', 'Type', 'Category', 'Amount (THB)', 'Paid from', 'Note', 'Receipt']];
                foreach (Books::nights($from, $to) as $n) {
                    $base = [$n->dateString(), self::STATUS[$n->status], $n->entered_by, $n->approved_by];
                    foreach ($n->sales as $s) $rows[] = array_merge($base, ['Sale', $inc[$s->category]['en'] ?? $s->category, $n2($s->amount), '', '', '']);
                    if ($n->qr) $rows[] = array_merge($base, ['Payment', 'QR / PromptPay', $n2($n->qr), '', '', '']);
                    if ($n->card) $rows[] = array_merge($base, ['Payment', 'Card', $n2($n->card), '', '', '']);
                    foreach ($n->expenses as $e) $rows[] = array_merge($base, ['Expense', $exp[$e->category]['en'] ?? $e->category, $n2($e->amount), $paid[$e->paid_from]['en'], $e->note, $e->receipt_path ? 'Yes' : ($e->needs_receipt ? 'No' : '—')]);
                    if ($n->counted !== null) $rows[] = array_merge($base, ['Cash count', 'Counted', $n2($n->counted), '', $n->note, '']);
                }
                return $rows;
        }
        return [];
    }
}
