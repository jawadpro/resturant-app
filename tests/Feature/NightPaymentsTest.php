<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use App\Support\Books;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NightPaymentsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Setting::put('installed', '1');
    }

    private function user(string $role, string $username): User
    {
        return User::create(['name' => ucfirst($username), 'username' => $username, 'role' => $role, 'password' => 'secret-pass-1', 'active' => true]);
    }

    public function test_grab_is_saved_and_taken_off_cash_sales(): void
    {
        $staff = $this->user('staff', 'donut');
        $today = Books::today();

        $this->actingAs($staff)->putJson("/api/nights/{$today}", [
            'inc' => ['food' => 4000, 'bar' => 3000],
            'exp' => [],
            'qr' => 1000, 'card' => 500, 'grab' => 1200,
            'float' => 5000, 'counted' => 9300,
        ])->assertOk()->assertJsonPath('night.grab', 1200);

        // Cash sales = 7,000 sales - 1,000 QR - 500 card - 1,200 Grab = 4,300; till should hold 5,000 + 4,300.
        $night = \App\Models\Night::with(['sales', 'expenses'])->whereDate('date', $today)->first();
        $c = Books::calc($night);
        $this->assertEqualsWithDelta(4300, $c['cashSales'], 0.001);
        $this->assertEqualsWithDelta(0, $c['variance'], 0.001);

        $this->actingAs($staff)->postJson("/api/nights/{$today}/submit")->assertOk()->assertJsonPath('night.status', 'submitted');
    }

    public function test_reports_include_grab(): void
    {
        $staff = $this->user('staff', 'donut');
        $owner = $this->user('owner', 'ron');
        $today = Books::today();
        $this->actingAs($staff)->putJson("/api/nights/{$today}", ['inc' => ['bar' => 2000], 'grab' => 800, 'float' => 0, 'counted' => 1200])->assertOk();
        $this->actingAs($staff)->postJson("/api/nights/{$today}/submit")->assertOk();

        $daily = $this->actingAs($owner)->get("/reports/daily.csv?from={$today}&to={$today}")->assertOk()->streamedContent();
        $lines = array_values(array_filter(explode("\r\n", ltrim($daily, "\xEF\xBB\xBF"))));
        $head = str_getcsv($lines[0]); $row = str_getcsv($lines[1]);
        $this->assertContains('Grab', $head);
        $this->assertSame('800.00', $row[array_search('Grab', $head)]);
        $this->assertSame('1200.00', $row[array_search('Cash sales', $head)]);

        $all = $this->actingAs($owner)->get("/reports/all.csv?from={$today}&to={$today}")->assertOk()->streamedContent();
        $this->assertStringContainsString('Payment,Grab,800.00', $all);
    }

    public function test_staff_cannot_download_reports(): void
    {
        $this->actingAs($this->user('staff', 'donut'))->getJson('/reports/daily.csv')->assertForbidden();
    }

    public function test_owner_applies_pending_database_update(): void
    {
        $owner = $this->user('owner', 'ron');
        // Simulate the live site: new code uploaded, Grab column not yet added.
        $this->artisan('migrate:rollback', ['--step' => 1])->assertSuccessful();
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('nights', 'grab'));

        $this->actingAs($owner)->getJson('/api/bootstrap')->assertOk()->assertJsonPath('pendingUpdates', 1);
        $this->actingAs($this->user('manager', 'q'))->postJson('/api/system/update')->assertForbidden();
        $this->actingAs($owner)->postJson('/api/system/update')->assertOk()->assertJsonPath('applied', 1);

        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasColumn('nights', 'grab'));
        $this->actingAs($owner)->getJson('/api/bootstrap')->assertJsonPath('pendingUpdates', 0);
    }

    public function test_owner_can_create_one_letter_username(): void
    {
        $owner = $this->user('owner', 'ron');
        $this->actingAs($owner)->postJson('/api/users', ['name' => 'Q', 'username' => 'q', 'role' => 'manager', 'password' => 'manager-pass-1'])
            ->assertOk()->assertJsonPath('user.username', 'q')->assertJsonPath('user.role', 'manager');
    }
}
