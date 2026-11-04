<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollPeriod extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['start_date' => 'date:Y-m-d', 'end_date' => 'date:Y-m-d', 'approved_at' => 'datetime'];
    }

    public function lines(): HasMany { return $this->hasMany(PayrollLine::class)->orderBy('sort')->orderBy('id'); }

    public function label(): string
    {
        $s = $this->start_date; $e = $this->end_date;
        return $s->format('j').'–'.$e->format('j M Y');
    }

    public function toApp(): array
    {
        return [
            'id' => $this->id,
            'period' => $this->label(),
            'start' => $this->start_date->format('Y-m-d'),
            'end' => $this->end_date->format('Y-m-d'),
            'status' => $this->status,
            'approvedBy' => $this->approved_by,
            'rows' => $this->lines->map(fn ($l) => $l->toApp())->values()->all(),
        ];
    }
}
