<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Staff extends Model
{
    protected $table = 'staff';
    protected $guarded = ['id'];
    protected function casts(): array { return ['monthly' => 'float', 'active' => 'boolean']; }
}
