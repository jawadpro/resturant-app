<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Activity extends Model
{
    public $timestamps = false;
    protected $guarded = ['id'];
    protected function casts(): array { return ['created_at' => 'datetime']; }

    public static function log(string $who, string $text): void
    {
        static::create(['who' => $who, 'text' => mb_substr($text, 0, 255), 'created_at' => now()]);
    }

    public function toApp(): array
    {
        return ['t' => $this->created_at->timezone(config('books.timezone'))->format('Y-m-d H:i'), 'who' => $this->who, 'text' => $this->text];
    }
}
