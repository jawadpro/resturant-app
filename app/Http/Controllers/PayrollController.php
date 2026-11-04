<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\PayrollLine;
use App\Models\PayrollPeriod;
use App\Models\Staff;
use App\Support\Books;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PayrollController extends Controller
{
    private function current(): ?PayrollPeriod
    {
        return PayrollPeriod::with('lines')->latest('start_date')->first();
    }

    private function draft(): PayrollPeriod
    {
        $p = $this->current();
        abort_if(! $p, 404, 'No pay period yet.');
        abort_if($p->status !== 'draft', 409, 'This pay period is approved and locked.');
        return $p;
    }

    /** Half-month periods: 1–15 and 16–end of month. */
    public static function periodFor(CarbonImmutable $d): array
    {
        return $d->day <= 15
            ? [$d->startOfMonth(), $d->startOfMonth()->addDays(14)]
            : [$d->startOfMonth()->addDays(15), $d->endOfMonth()->startOfDay()];
    }

    public static function startPeriod(CarbonImmutable $start, CarbonImmutable $end, ?PayrollPeriod $copyFrom = null): PayrollPeriod
    {
        $p = PayrollPeriod::create(['start_date' => $start->format('Y-m-d'), 'end_date' => $end->format('Y-m-d'), 'status' => 'draft']);
        foreach (Staff::where('active', true)->orderBy('sort')->orderBy('id')->get() as $i => $s) {
            $p->lines()->create(['staff_id' => $s->id, 'name' => $s->name, 'position' => $s->position, 'monthly' => $s->monthly, 'sort' => $i]);
        }
        return $p;
    }

    private function out(PayrollPeriod $p)
    {
        return response()->json(['payroll' => $p->fresh('lines')->toApp()]);
    }

    public function start(Request $request)
    {
        $cur = $this->current();
        if ($cur && $cur->status === 'draft') return response()->json(['message' => 'Finish and approve the current pay period first.'], 409);
        $from = $cur ? CarbonImmutable::parse($cur->end_date)->addDay() : CarbonImmutable::parse(Books::today());
        [$s, $e] = self::periodFor($from);
        $p = self::startPeriod($s, $e);
        Activity::log($request->user()->name, "started payroll for {$p->label()}");
        return $this->out($p);
    }

    public function updateLine(Request $request, PayrollLine $line)
    {
        $p = $this->draft();
        abort_unless($line->payroll_period_id === $p->id, 404);
        $data = $request->validate([
            'field' => ['required', Rule::in(['abs', 'fine', 'adv', 'rent', 'elec', 'm'])],
            'value' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
        ]);
        $map = ['abs' => 'absent_days', 'fine' => 'late_fine', 'adv' => 'advance', 'rent' => 'rent', 'elec' => 'electricity', 'm' => 'monthly'];
        $line->{$map[$data['field']]} = $data['value'] ?? 0;
        $line->save();
        if ($data['field'] === 'm' && $line->staff_id) Staff::whereKey($line->staff_id)->update(['monthly' => $line->monthly]);
        return response()->json(['ok' => true]);
    }

    public function addPerson(Request $request)
    {
        $p = $this->draft();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'position' => ['nullable', 'string', 'max:60'],
            'monthly' => ['required', 'numeric', 'min:0', 'max:10000000'],
        ]);
        $s = Staff::create($data + ['active' => true, 'sort' => (Staff::max('sort') ?? 0) + 1]);
        $p->lines()->create(['staff_id' => $s->id, 'name' => $s->name, 'position' => $s->position, 'monthly' => $s->monthly, 'sort' => $p->lines()->count()]);
        Activity::log($request->user()->name, "added {$s->name} to payroll");
        return $this->out($p);
    }

    public function removePerson(Request $request, PayrollLine $line)
    {
        $p = $this->draft();
        abort_unless($line->payroll_period_id === $p->id, 404);
        if ($line->staff_id) Staff::whereKey($line->staff_id)->update(['active' => false]);
        $name = $line->name;
        $line->delete();
        Activity::log($request->user()->name, "removed {$name} from payroll");
        return $this->out($p);
    }

    public function approve(Request $request)
    {
        $p = $this->draft();
        $p->fill(['status' => 'approved', 'approved_by' => $request->user()->name, 'approved_at' => now()])->save();
        Activity::log($request->user()->name, "approved payroll for {$p->label()}");
        return $this->out($p);
    }
}
