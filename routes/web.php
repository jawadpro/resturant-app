<?php

use App\Http\Controllers\AppController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\InstallController;
use App\Http\Controllers\NightController;
use App\Http\Controllers\PayrollController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

// One-time setup (only when INSTALL_TOKEN is set in .env)
Route::get('/install', [InstallController::class, 'show']);
Route::post('/install', [InstallController::class, 'run'])->middleware('throttle:10,1');

Route::middleware('installed')->group(function () {
    Route::get('/', [AppController::class, 'index']);
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/api/bootstrap', [AppController::class, 'bootstrap']);

    // Everyone signed in
    Route::middleware('role')->group(function () {
        Route::post('/api/me/password', [AuthController::class, 'changePassword']);
        Route::put('/api/nights/{date}', [NightController::class, 'save']);
        Route::post('/api/nights/{date}/submit', [NightController::class, 'submit']);
        Route::post('/api/nights/{date}/expenses/{uid}/receipt', [NightController::class, 'uploadReceipt']);
        Route::get('/api/receipts/{expense}', [NightController::class, 'receipt']);
    });

    // Manager and owner
    Route::middleware('role:owner,manager')->group(function () {
        Route::post('/api/nights/{date}/approve', [NightController::class, 'approve']);
        Route::post('/api/nights/{date}/send-back', [NightController::class, 'sendBack']);
        Route::post('/api/nights/{date}/close', [NightController::class, 'close']);
        Route::delete('/api/nights/{date}', [NightController::class, 'unclose']);
        Route::patch('/api/payroll/lines/{line}', [PayrollController::class, 'updateLine']);
        Route::post('/api/payroll/lines', [PayrollController::class, 'addPerson']);
        Route::delete('/api/payroll/lines/{line}', [PayrollController::class, 'removePerson']);
    });

    // Owner only
    Route::middleware('role:owner')->group(function () {
        Route::post('/api/nights/{date}/reopen', [NightController::class, 'reopen']);
        Route::post('/api/payroll/approve', [PayrollController::class, 'approve']);
        Route::post('/api/payroll/start', [PayrollController::class, 'start']);
        Route::get('/api/reports/{type}/preview', [ReportController::class, 'preview']);
        Route::get('/reports/{type}.csv', [ReportController::class, 'download']);
        Route::post('/api/users', [UserController::class, 'store']);
        Route::post('/api/users/{user}/reset', [UserController::class, 'resetPassword']);
        Route::post('/api/users/{user}/toggle', [UserController::class, 'toggle']);
        Route::delete('/api/users/{user}', [UserController::class, 'destroy']);
    });
});
