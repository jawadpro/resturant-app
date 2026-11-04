<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    public const ROLES = ['owner', 'manager', 'staff'];

    protected $fillable = ['name', 'username', 'role', 'password', 'active', 'last_login_at'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function isOwner(): bool { return $this->role === 'owner'; }
    public function isManager(): bool { return $this->role === 'manager'; }
    public function isStaff(): bool { return $this->role === 'staff'; }
    public function canManage(): bool { return in_array($this->role, ['owner', 'manager'], true); }

    public function toPublic(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'username' => $this->username,
            'role' => $this->role,
            'active' => $this->active,
            'last' => $this->last_login_at?->timezone(config('books.timezone'))->format('Y-m-d H:i'),
        ];
    }
}
