<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureRole::class,
            'installed' => \App\Http\Middleware\EnsureInstalled::class,
        ]);
        // Hostinger sits behind a proxy; trust it so HTTPS and client IPs are detected correctly.
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // API calls get short JSON errors the app can show, never a stack trace.
        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $code = $e->getStatusCode();
                $msg = $e->getMessage() ?: ($code === 419 ? 'Your session expired. Sign in again.' : 'Something went wrong.');
                return response()->json(['message' => $msg], $code);
            }
        });
    })->create();
