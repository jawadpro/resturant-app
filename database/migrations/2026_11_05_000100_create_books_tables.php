<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per trading night (business date, Bangkok time, rolls over at the cut-off hour).
        Schema::create('nights', function (Blueprint $table) {
            $table->id();
            $table->date('date')->unique();
            $table->enum('status', ['draft', 'submitted', 'approved', 'closed'])->default('draft');
            $table->foreignId('entered_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('entered_by', 80)->nullable();      // name kept even if the login is removed
            $table->string('approved_by', 80)->nullable();
            $table->decimal('qr', 12, 2)->nullable();
            $table->decimal('card', 12, 2)->nullable();
            $table->decimal('banked', 12, 2)->nullable();
            $table->decimal('opening_float', 12, 2)->nullable();
            $table->decimal('counted', 12, 2)->nullable();
            $table->text('note')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('night_sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('night_id')->constrained()->cascadeOnDelete();
            $table->string('category', 30);
            $table->decimal('amount', 12, 2)->default(0);
            $table->unique(['night_id', 'category']);
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('night_id')->constrained()->cascadeOnDelete();
            $table->string('uid', 20);                         // stable id from the form, used for receipts
            $table->string('category', 30);
            $table->decimal('amount', 12, 2)->nullable();
            $table->enum('paid_from', ['till', 'bank', 'owner'])->default('till');
            $table->string('note', 500)->nullable();
            $table->boolean('needs_receipt')->default(true);  // false for automatic and imported lines
            $table->string('receipt_path')->nullable();
            $table->boolean('is_auto')->default(false);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
            $table->unique(['night_id', 'uid']);
        });

        // People on payroll. Not everyone on payroll has a login, so this is separate from users.
        Schema::create('staff', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80);
            $table->string('position', 60)->nullable();
            $table->decimal('monthly', 12, 2)->default(0);
            $table->boolean('active')->default(true);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('payroll_periods', function (Blueprint $table) {
            $table->id();
            $table->date('start_date');
            $table->date('end_date');
            $table->enum('status', ['draft', 'approved'])->default('draft');
            $table->string('approved_by', 80)->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->unique(['start_date', 'end_date']);
        });

        Schema::create('payroll_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payroll_period_id')->constrained()->cascadeOnDelete();
            $table->foreignId('staff_id')->nullable()->constrained('staff')->nullOnDelete();
            $table->string('name', 80);
            $table->string('position', 60)->nullable();
            $table->decimal('monthly', 12, 2)->default(0);
            $table->decimal('absent_days', 5, 2)->default(0);
            $table->decimal('late_fine', 12, 2)->default(0);
            $table->decimal('advance', 12, 2)->default(0);
            $table->decimal('rent', 12, 2)->default(0);
            $table->decimal('electricity', 12, 2)->default(0);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('activities', function (Blueprint $table) {
            $table->id();
            $table->string('who', 80);
            $table->string('text', 255);
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->string('key', 60)->primary();
            $table->text('value')->nullable();
        });
    }

    public function down(): void
    {
        foreach (['settings', 'activities', 'payroll_lines', 'payroll_periods', 'staff', 'expenses', 'night_sales', 'nights'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
