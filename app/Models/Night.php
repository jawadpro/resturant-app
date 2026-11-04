<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Night extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
            'qr' => 'float', 'card' => 'float', 'banked' => 'float', 'opening_float' => 'float', 'counted' => 'float',
            'submitted_at' => 'datetime', 'approved_at' => 'datetime',
        ];
    }

    public function sales(): HasMany { return $this->hasMany(NightSale::class); }
    public function expenses(): HasMany { return $this->hasMany(Expense::class)->orderBy('sort')->orderBy('id'); }

    public function dateString(): string { return $this->date->format('Y-m-d'); }

    /** Shape used by the browser app (same as the demo). */
    public function toApp(): array
    {
        $tz = config('books.timezone');
        return [
            'date' => $this->dateString(),
            'status' => $this->status,
            'by' => $this->entered_by,
            'byId' => $this->entered_by_id,
            'approvedBy' => $this->approved_by,
            'inc' => $this->sales->mapWithKeys(fn ($s) => [$s->category => (float) $s->amount])->all() ?: new \stdClass(),
            'exp' => $this->expenses->map(fn ($e) => $e->toApp())->values()->all(),
            'qr' => $this->qr, 'card' => $this->card, 'banked' => $this->banked,
            'float' => $this->opening_float, 'counted' => $this->counted,
            'note' => $this->note ?? '',
            'submittedAt' => $this->submitted_at?->timezone($tz)->format('Y-m-d H:i'),
            'approvedAt' => $this->approved_at?->timezone($tz)->format('Y-m-d H:i'),
        ];
    }
}
