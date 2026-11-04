<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayrollLine extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['monthly' => 'float', 'absent_days' => 'float', 'late_fine' => 'float', 'advance' => 'float', 'rent' => 'float', 'electricity' => 'float'];
    }

    public function toApp(): array
    {
        return [
            'id' => $this->id, 'n' => $this->name, 'p' => $this->position, 'm' => $this->monthly,
            'abs' => $this->absent_days, 'fine' => $this->late_fine, 'adv' => $this->advance, 'rent' => $this->rent, 'elec' => $this->electricity,
        ];
    }
}
