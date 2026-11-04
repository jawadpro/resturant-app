<?php

// Business rules for MFD Books. Category keys are stored in the database; change labels freely,
// but do not rename keys once there is data.
return [
    // Set these in .env on the server; the defaults keep the public code free of client details.
    'business_name' => env('BOOKS_BUSINESS_NAME', 'The Restaurant'),
    'owner_name' => env('BOOKS_OWNER_NAME', 'the owner'),
    'manager_name' => env('BOOKS_MANAGER_NAME', 'the manager'),

    // One-time setup page (/install). Set a long random value to enable it; remove it afterwards.
    'install_token' => env('INSTALL_TOKEN', ''),

    // The bar's night runs past midnight: before this hour (local time) still counts as the previous night.
    'timezone' => env('BOOKS_TIMEZONE', 'Asia/Bangkok'),
    'cutoff_hour' => (int) env('BOOKS_CUTOFF_HOUR', 6),

    // Staff drink commission: 37.5% of staff drink sales (฿60 on each ฿160 drink).
    'commission_rate' => (float) env('BOOKS_COMMISSION_RATE', 0.375),
    'drink_price' => (int) env('BOOKS_DRINK_PRICE', 160),

    // An expense at or above this amount without a receipt photo is flagged for the manager.
    'receipt_flag_amount' => 500,

    'income' => [
        'food' => ['en' => 'Food sales', 'th' => 'ยอดขายอาหาร'],
        'bar' => ['en' => 'Bar sales', 'th' => 'ขายสุรา'],
        'staff' => ['en' => 'Staff drink sales', 'th' => 'ยอดขายเครื่องดื่มพนักงาน'],
        'away' => ['en' => 'Staff away fees', 'th' => 'ค่าออกพนักงาน'],
        'rooms' => ['en' => 'Room rental', 'th' => 'ค่าเช่าห้อง'],
        'other' => ['en' => 'Other income', 'th' => 'รายได้อื่นๆ'],
    ],

    // group: null = running cost (in profit & loss), 'advance' = staff advance (asset), 'capital' = refurbishment.
    'expenses' => [
        'alcohol' => ['en' => 'Alcohol & bar stock', 'th' => 'สุราและของใช้บาร์'],
        'food' => ['en' => 'Kitchen food', 'th' => 'วัตถุดิบอาหาร'],
        'thaifood' => ['en' => 'Thai food (Beer)', 'th' => 'อาหารไทย (เบียร์)'],
        'ice' => ['en' => 'Ice', 'th' => 'น้ำแข็ง'],
        'staffcomm' => ['en' => 'Staff commission', 'th' => 'ค่าคอมมิชชั่นพนักงาน'],
        'hostcomm' => ['en' => 'Staff host commission', 'th' => 'ค่าคอมพนักงานออก'],
        'bottlecomm' => ['en' => 'Bottle commission', 'th' => 'ค่าคอมขายขวด'],
        'salaries' => ['en' => 'Salaries (old sheet)', 'th' => 'เงินเดือน', 'legacy' => true],
        'advance' => ['en' => 'Staff advance', 'th' => 'เบิกเงินล่วงหน้า', 'group' => 'advance'],
        'stafffood' => ['en' => 'Staff food', 'th' => 'อาหารพนักงาน'],
        'utilities' => ['en' => 'Electricity & water', 'th' => 'ค่าไฟ / ค่าน้ำ'],
        'internet' => ['en' => 'Internet', 'th' => 'ค่าอินเทอร์เน็ต'],
        'rent' => ['en' => 'Rent', 'th' => 'ค่าเช่า'],
        'security' => ['en' => 'Police / security', 'th' => 'ตำรวจ / รักษาความปลอดภัย'],
        'maint' => ['en' => 'Repairs & cleaning', 'th' => 'ซ่อมบำรุง / ทำความสะอาด'],
        'discounts' => ['en' => 'Discounts', 'th' => 'ส่วนลด'],
        'promo' => ['en' => 'Promotions', 'th' => 'โปรโมชั่น'],
        'office' => ['en' => 'Office, taxi & fuel', 'th' => 'สำนักงาน / แท็กซี่'],
        'roomcost' => ['en' => 'Room costs', 'th' => 'ค่าใช้จ่ายห้องพัก'],
        'othercost' => ['en' => 'Other costs', 'th' => 'ค่าใช้จ่ายอื่นๆ'],
        'capex' => ['en' => 'Refurbishment', 'th' => 'ปรับปรุงร้าน', 'group' => 'capital'],
    ],

    'paid_from' => [
        'till' => ['en' => 'Till cash', 'th' => 'เงินสดในลิ้นชัก'],
        'bank' => ['en' => 'Bank transfer', 'th' => 'โอนธนาคาร'],
        'owner' => ['en' => 'Paid by owner', 'th' => 'เจ้าของจ่าย'],
    ],
];
