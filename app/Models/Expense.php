<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['amount' => 'float', 'needs_receipt' => 'boolean', 'is_auto' => 'boolean'];
    }

    public function night(): BelongsTo { return $this->belongsTo(Night::class); }

    /** receipt: null = not needed, false = missing, string = URL of the photo. */
    public function receiptState(): bool|string|null
    {
        if ($this->receipt_path) return url('/api/receipts/'.$this->id);
        return $this->needs_receipt ? false : null;
    }

    public function toApp(): array
    {
        return [
            'id' => $this->uid,
            'cat' => $this->category,
            'amt' => $this->amount,
            'note' => $this->note ?? '',
            'paid' => $this->paid_from,
            'receipt' => $this->receiptState(),
            'auto' => $this->is_auto,
        ];
    }
}
