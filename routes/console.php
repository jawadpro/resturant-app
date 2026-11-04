<?php

use App\Models\Setting;
use App\Models\User;
use App\Support\HistoryImport;
use Illuminate\Support\Facades\Artisan;

// For local use or hosting with SSH. On Hostinger shared hosting use /install instead.

Artisan::command('books:import {nights? : Path to nights.json} {--staff= : Path to staff.json}', function () {
    $path = $this->argument('nights') ?? HistoryImport::dir().'/nights.json';
    if (is_file($path)) $this->info(HistoryImport::nights($path).' nights imported.');
    $staff = $this->option('staff') ?? HistoryImport::dir().'/staff.json';
    if (is_file($staff)) $this->info(HistoryImport::staff($staff).' people added to payroll.');
})->purpose('Import history exported from the old spreadsheet');

Artisan::command('books:owner {username} {name}', function (string $username, string $name) {
    $password = $this->secret('Password (at least 8 characters)');
    if (strlen((string) $password) < 8) return $this->error('Too short.');
    User::updateOrCreate(['username' => strtolower($username)], ['name' => $name, 'role' => 'owner', 'password' => $password, 'active' => true]);
    Setting::put('installed', '1');
    $this->info("Owner {$username} is ready.");
})->purpose('Create or reset the owner login');
