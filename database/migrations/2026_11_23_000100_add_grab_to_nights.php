<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Grab (delivery app) payments: paid out by Grab, so not cash in the till.
    public function up(): void
    {
        if (! Schema::hasColumn('nights', 'grab')) {
            Schema::table('nights', function (Blueprint $table) {
                $table->decimal('grab', 12, 2)->nullable()->after('card');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('nights', 'grab')) {
            Schema::table('nights', fn (Blueprint $table) => $table->dropColumn('grab'));
        }
    }
};
