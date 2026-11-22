<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\Expense;
use App\Models\Night;
use App\Models\User;
use App\Support\Books;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class NightController extends Controller
{
    /** Can this person change this night (or start it, when $night is null)? */
    private function canEdit(User $u, string $date, ?Night $night): bool
    {
        if ($date > Books::today()) return false;
        if ($u->isStaff()) {
            return $date === Books::today() && (! $night || $night->status === 'draft');
        }
        return ! $night || in_array($night->status, ['draft', 'submitted'], true);
    }

    private function canView(User $u, Night $night): bool
    {
        return $u->canManage() || $night->entered_by_id === $u->id || $night->dateString() === Books::today();
    }

    private function find(string $date): ?Night
    {
        $this->checkDate($date);
        return Night::with(['sales', 'expenses'])->whereDate('date', $date)->first();
    }

    private function checkDate(string $date): void
    {
        abort_unless(preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) && CarbonImmutable::createFromFormat('Y-m-d', $date)?->format('Y-m-d') === $date, 404);
    }

    private function fresh(Night $n): array
    {
        return $n->fresh(['sales', 'expenses'])->toApp();
    }

    private function short(string $date): string
    {
        return CarbonImmutable::parse($date)->format('j M');
    }

    /** Autosave: the whole form for one night. */
    public function save(Request $request, string $date)
    {
        $u = $request->user();
        $night = $this->find($date);
        if (! $this->canEdit($u, $date, $night)) {
            return response()->json(['message' => 'This night is locked and can’t be changed.'], 409);
        }
        $money = ['nullable', 'numeric', 'min:0', 'max:100000000'];
        $data = $request->validate([
            'inc' => ['nullable', 'array'],
            'inc.*' => $money,
            'exp' => ['nullable', 'array', 'max:200'],
            'exp.*.id' => ['required', 'string', 'max:20', 'regex:/^[A-Za-z0-9_-]+$/'],
            'exp.*.cat' => ['required', Rule::in(array_keys(config('books.expenses')))],
            'exp.*.amt' => $money,
            'exp.*.paid' => ['required', Rule::in(array_keys(config('books.paid_from')))],
            'exp.*.note' => ['nullable', 'string', 'max:500'],
            'exp.*.auto' => ['nullable', 'boolean'],
            'qr' => $money, 'card' => $money, 'grab' => $money, 'banked' => $money, 'float' => $money, 'counted' => $money,
            'note' => ['nullable', 'string', 'max:2000'],
        ]);
        $incomeKeys = array_keys(config('books.income'));

        DB::transaction(function () use (&$night, $date, $u, $data, $incomeKeys) {
            if (! $night) {
                $night = Night::create(['date' => $date, 'status' => 'draft', 'entered_by_id' => $u->id, 'entered_by' => $u->name]);
            }
            $night->fill([
                'qr' => $data['qr'] ?? null, 'card' => $data['card'] ?? null, 'grab' => $data['grab'] ?? null, 'banked' => $data['banked'] ?? null,
                'opening_float' => $data['float'] ?? null, 'counted' => $data['counted'] ?? null, 'note' => $data['note'] ?? null,
            ])->save();

            $inc = array_intersect_key($data['inc'] ?? [], array_flip($incomeKeys));
            $night->sales()->whereNotIn('category', array_keys($inc))->delete();
            foreach ($inc as $cat => $amt) {
                if ($amt === null || (float) $amt == 0.0) { $night->sales()->where('category', $cat)->delete(); continue; }
                $night->sales()->updateOrCreate(['category' => $cat], ['amount' => $amt]);
            }

            $keep = [];
            foreach (array_values($data['exp'] ?? []) as $i => $l) {
                $keep[] = $l['id'];
                $auto = ! empty($l['auto']) && $l['cat'] === 'staffcomm';
                $e = $night->expenses()->firstOrNew(['uid' => $l['id']]);
                if (! $e->exists) $e->needs_receipt = ! $auto;
                $e->fill(['category' => $l['cat'], 'amount' => $l['amt'] ?? null, 'paid_from' => $l['paid'], 'note' => $l['note'] ?? null, 'is_auto' => $auto, 'sort' => $i]);
                if ($auto) $e->needs_receipt = false;
                $e->save();
            }
            foreach ($night->expenses()->whereNotIn('uid', $keep)->get() as $gone) {
                if ($gone->receipt_path) Storage::disk('local')->delete($gone->receipt_path);
                $gone->delete();
            }
        });

        return response()->json(['night' => $this->fresh($night)]);
    }

    public function submit(Request $request, string $date)
    {
        $u = $request->user();
        $night = $this->find($date);
        if (! $night || ! $this->canEdit($u, $date, $night) || $night->status !== 'draft') {
            return response()->json(['message' => 'This night can’t be sent right now.'], 409);
        }
        $c = Books::calc($night);
        if ($c['sales'] <= 0) return response()->json(['message' => 'Step 1: enter at least one sale.'], 422);
        if ($night->opening_float === null) return response()->json(['message' => 'Step 4: enter the opening float.'], 422);
        if ($night->counted === null) return response()->json(['message' => 'Step 4: count the cash before sending.'], 422);

        $night->fill(['status' => 'submitted', 'submitted_at' => now()]);
        if (! $night->entered_by_id) $night->fill(['entered_by_id' => $u->id, 'entered_by' => $u->name]);
        $night->save();
        Activity::log($u->name, "sent the {$this->short($date)} close for approval");
        return response()->json(['night' => $this->fresh($night)]);
    }

    public function approve(Request $request, string $date)
    {
        $u = $request->user();
        $night = $this->find($date);
        if (! $night || ! in_array($night->status, ['draft', 'submitted'], true)) {
            return response()->json(['message' => 'Only a night waiting for approval can be approved.'], 409);
        }
        $night->fill(['status' => 'approved', 'approved_by' => $u->name, 'approved_at' => now()])->save();
        Activity::log($u->name, "approved the {$this->short($date)} close");
        return response()->json(['night' => $this->fresh($night)]);
    }

    public function sendBack(Request $request, string $date)
    {
        $night = $this->find($date);
        if (! $night || $night->status !== 'submitted') return response()->json(['message' => 'Only a night waiting for approval can be sent back.'], 409);
        $night->fill(['status' => 'draft', 'submitted_at' => null])->save();
        Activity::log($request->user()->name, "sent {$this->short($date)} back to {$night->entered_by}");
        return response()->json(['night' => $this->fresh($night)]);
    }

    public function reopen(Request $request, string $date)
    {
        $night = $this->find($date);
        if (! $night || $night->status !== 'approved') return response()->json(['message' => 'Only an approved night can be reopened.'], 409);
        $night->fill(['status' => 'submitted', 'approved_by' => null, 'approved_at' => null])->save();
        Activity::log($request->user()->name, "reopened {$this->short($date)}");
        return response()->json(['night' => $this->fresh($night)]);
    }

    public function close(Request $request, string $date)
    {
        $u = $request->user();
        $night = $this->find($date);
        if ($date > Books::today()) abort(404);
        if ($night && ($night->status !== 'draft' || $night->sales()->exists())) {
            return response()->json(['message' => 'This night already has figures. Open it instead.'], 409);
        }
        $night ??= new Night(['date' => $date]);
        $night->fill(['status' => 'closed', 'entered_by_id' => $u->id, 'entered_by' => $u->name])->save();
        Activity::log($u->name, "marked {$this->short($date)} as closed");
        return response()->json(['night' => $this->fresh($night)]);
    }

    public function unclose(Request $request, string $date)
    {
        $night = $this->find($date);
        if (! $night || $night->status !== 'closed') return response()->json(['message' => 'Only a closed night can be undone.'], 409);
        $night->delete();
        Activity::log($request->user()->name, "undid closed for {$this->short($date)}");
        return response()->json(['ok' => true]);
    }

    public function uploadReceipt(Request $request, string $date, string $uid)
    {
        $u = $request->user();
        $night = $this->find($date);
        if (! $night || ! $this->canEdit($u, $date, $night)) return response()->json(['message' => 'This night is locked.'], 409);
        $request->validate(['photo' => ['required', 'file', 'image', 'max:10240']]);
        $e = $night->expenses()->where('uid', $uid)->firstOrFail();
        if ($e->receipt_path) Storage::disk('local')->delete($e->receipt_path);
        $ext = strtolower($request->file('photo')->extension() ?: 'jpg');
        $e->receipt_path = $request->file('photo')->storeAs("receipts/{$date}", $uid.'-'.bin2hex(random_bytes(4)).'.'.$ext, 'local');
        $e->save();
        return response()->json(['night' => $this->fresh($night)]);
    }

    public function receipt(Request $request, Expense $expense)
    {
        $night = $expense->night()->with([])->first();
        abort_unless($night && $expense->receipt_path && $this->canView($request->user(), $night), 404);
        return Storage::disk('local')->response($expense->receipt_path, null, ['Cache-Control' => 'private, max-age=86400']);
    }
}
