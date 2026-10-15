from datetime import datetime, date, timedelta, timezone

# Shared in-memory data store for Instant Startup & Demo Execution
MOCK_BRANCHES = [
    {
        "id": "branch-blr-01",
        "code": "IC-BLR-01",
        "name": "IronClub Downtown Flagship",
        "city": "Bengaluru",
        "address": "42 Indiranagar 100ft Road, Bengaluru, KA 560038",
        "phone": "+91 80 4991 7700",
        "email": "downtown@ironclub.zolexora.io",
        "maxCapacity": 160,
        "currentOccupancy": 68,
        "activeGateDevicesCount": 4,
        "openHours": {
            "weekdays": "05:00 - 23:30",
            "weekends": "06:00 - 22:00"
        },
        "amenities": [
            "Olympic Lifting Platforms",
            "Infrared Sauna & Cold Plunges",
            "Cardio Cinema",
            "Smoothie Bar & Pro-Shop",
            "Valet Parking"
        ]
    },
    {
        "id": "branch-mum-02",
        "code": "IC-MUM-02",
        "name": "IronClub Marine Beachfront",
        "city": "Mumbai",
        "address": "18 Marine Drive, Nariman Point, Mumbai, MH 400021",
        "phone": "+91 22 2284 3300",
        "email": "beachfront@ironclub.zolexora.io",
        "maxCapacity": 120,
        "currentOccupancy": 44,
        "activeGateDevicesCount": 3,
        "openHours": {
            "weekdays": "05:30 - 23:00",
            "weekends": "06:00 - 21:00"
        },
        "amenities": [
            "Sea View Cardio Deck",
            "Heavy Bag Boxing Ring",
            "Recovery Lounge",
            "Steam & Sauna"
        ]
    }
]

MOCK_GATE_DEVICES = [
    {
        "id": "gate-dev-01",
        "branchId": "branch-blr-01",
        "name": "Main Entrance Turnstile A (Left)",
        "type": "SWING_SPEED_GATE",
        "zone": "MAIN_ENTRY",
        "ipAddress": "192.168.10.101",
        "macAddress": "B8:27:EB:01:A4:11",
        "isOnline": True,
        "lastHeartbeat": datetime.now(timezone.utc).isoformat(),
        "latencyMs": 14,
        "todayCyclesCount": 342,
        "firmwareVersion": "v3.1.2-arm",
        "isLockedDown": False
    },
    {
        "id": "gate-dev-02",
        "branchId": "branch-blr-01",
        "name": "Main Entrance Turnstile B (Right)",
        "type": "SWING_SPEED_GATE",
        "zone": "MAIN_ENTRY",
        "ipAddress": "192.168.10.102",
        "macAddress": "B8:27:EB:01:A4:12",
        "isOnline": True,
        "lastHeartbeat": datetime.now(timezone.utc).isoformat(),
        "latencyMs": 12,
        "todayCyclesCount": 389,
        "firmwareVersion": "v3.1.2-arm",
        "isLockedDown": False
    },
    {
        "id": "gate-dev-03",
        "branchId": "branch-blr-01",
        "name": "VIP Studio & Sauna Flap Barrier",
        "type": "FLAP_BARRIER",
        "zone": "VIP_LOUNGE",
        "ipAddress": "192.168.10.105",
        "macAddress": "B8:27:EB:02:C9:88",
        "isOnline": True,
        "lastHeartbeat": datetime.now(timezone.utc).isoformat(),
        "latencyMs": 18,
        "todayCyclesCount": 94,
        "firmwareVersion": "v3.0.8-arm",
        "isLockedDown": False
    },
    {
        "id": "gate-dev-04",
        "branchId": "branch-blr-01",
        "name": "Main Exit Turnstile",
        "type": "TURNSTILE_TRIPOD",
        "zone": "MAIN_EXIT",
        "ipAddress": "192.168.10.110",
        "macAddress": "B8:27:EB:03:D1:45",
        "isOnline": True,
        "lastHeartbeat": datetime.now(timezone.utc).isoformat(),
        "latencyMs": 11,
        "todayCyclesCount": 310,
        "firmwareVersion": "v2.9.4-arm",
        "isLockedDown": False
    }
]

MOCK_MEMBERS = [
    {
        "id": "mem-001",
        "membershipNumber": "IC-2026-0811",
        "firstName": "Vikram",
        "lastName": "Singhania",
        "email": "vikram.s@ironclub.demo",
        "phone": "+91 98200 11223",
        "gender": "MALE",
        "dob": "1994-06-15",
        "avatarUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
        "homeBranchId": "branch-blr-01",
        "tier": "BLACK_IRON_VIP",
        "status": "ACTIVE",
        "joinDate": "2024-01-10",
        "expiryDate": "2027-01-10",
        "rfidTagId": "RFID-88910-A",
        "dynamicQrSecret": "QRSEC-VIKRAM-2026",
        "emergencyContact": {
            "name": "Rhea Singhania",
            "phone": "+91 98200 44556",
            "relation": "Spouse"
        },
        "assignedTrainerId": "trn-001",
        "healthConditions": [],
        "lockerNumber": "L-104",
        "stats": {
            "totalWorkouts": 214,
            "monthVisits": 18,
            "streakDays": 5,
            "lastVisit": "2026-10-15T07:15:00Z"
        }
    },
    {
        "id": "mem-002",
        "membershipNumber": "IC-2026-0942",
        "firstName": "Ananya",
        "lastName": "Deshmukh",
        "email": "ananya.d@ironclub.demo",
        "phone": "+91 98199 44321",
        "gender": "FEMALE",
        "dob": "1997-11-22",
        "avatarUrl": "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80",
        "homeBranchId": "branch-blr-01",
        "tier": "GOLD",
        "status": "ACTIVE",
        "joinDate": "2024-03-01",
        "expiryDate": "2026-12-31",
        "rfidTagId": "RFID-94201-B",
        "dynamicQrSecret": "QRSEC-ANANYA-2026",
        "emergencyContact": {
            "name": "Karan Deshmukh",
            "phone": "+91 98199 88776",
            "relation": "Brother"
        },
        "assignedTrainerId": "trn-002",
        "healthConditions": ["Mild lower back strain - cleared"],
        "lockerNumber": "L-218",
        "stats": {
            "totalWorkouts": 142,
            "monthVisits": 14,
            "streakDays": 3,
            "lastVisit": "2026-10-14T18:30:00Z"
        }
    },
    {
        "id": "mem-003",
        "membershipNumber": "IC-2026-1004",
        "firstName": "Arjun",
        "lastName": "Mehta",
        "email": "arjun.m@ironclub.demo",
        "phone": "+91 97690 99881",
        "gender": "MALE",
        "dob": "1990-04-05",
        "avatarUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
        "homeBranchId": "branch-blr-01",
        "tier": "SILVER",
        "status": "EXPIRING_SOON",
        "joinDate": "2025-10-20",
        "expiryDate": "2026-10-20",
        "rfidTagId": "RFID-10044-C",
        "dynamicQrSecret": "QRSEC-ARJUN-2026",
        "emergencyContact": {
            "name": "Deepa Mehta",
            "phone": "+91 97690 11223",
            "relation": "Mother"
        },
        "assignedTrainerId": None,
        "healthConditions": [],
        "lockerNumber": "L-045",
        "stats": {
            "totalWorkouts": 88,
            "monthVisits": 9,
            "streakDays": 1,
            "lastVisit": "2026-10-13T08:00:00Z"
        }
    },
    {
        "id": "mem-004",
        "membershipNumber": "IC-2025-0551",
        "firstName": "Dev",
        "lastName": "Kapoor",
        "email": "dev.k@ironclub.demo",
        "phone": "+91 99300 55442",
        "gender": "MALE",
        "dob": "1992-08-19",
        "avatarUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
        "homeBranchId": "branch-blr-01",
        "tier": "BRONZE",
        "status": "EXPIRED",
        "joinDate": "2025-09-01",
        "expiryDate": "2026-09-01",
        "rfidTagId": "RFID-EXPIRED-DEV",
        "dynamicQrSecret": "QRSEC-DEV-EXPIRED",
        "emergencyContact": {
            "name": "Nisha Kapoor",
            "phone": "+91 99300 11111",
            "relation": "Sister"
        },
        "assignedTrainerId": None,
        "healthConditions": [],
        "lockerNumber": None,
        "stats": {
            "totalWorkouts": 65,
            "monthVisits": 0,
            "streakDays": 0,
            "lastVisit": "2026-08-30T19:00:00Z"
        }
    }
]

MOCK_ACCESS_LOGS = [
    {
        "id": "log-001",
        "timestamp": "2026-10-15T17:42:15Z",
        "memberId": "mem-001",
        "memberName": "Vikram Singhania",
        "memberPhotoUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
        "membershipTier": "BLACK_IRON_VIP",
        "deviceId": "gate-dev-01",
        "deviceName": "Main Entrance Turnstile A (Left)",
        "zone": "MAIN_ENTRY",
        "direction": "ENTRY",
        "decision": "GRANTED",
        "reason": "Authorized Active VIP Pass"
    },
    {
        "id": "log-002",
        "timestamp": "2026-10-15T17:35:40Z",
        "memberId": "mem-002",
        "memberName": "Ananya Deshmukh",
        "memberPhotoUrl": "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80",
        "membershipTier": "GOLD",
        "deviceId": "gate-dev-02",
        "deviceName": "Main Entrance Turnstile B (Right)",
        "zone": "MAIN_ENTRY",
        "direction": "ENTRY",
        "decision": "GRANTED",
        "reason": "Authorized Active Gold Pass"
    },
    {
        "id": "log-003",
        "timestamp": "2026-10-15T17:28:10Z",
        "memberId": "mem-004",
        "memberName": "Dev Kapoor",
        "memberPhotoUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
        "membershipTier": "BRONZE",
        "deviceId": "gate-dev-01",
        "deviceName": "Main Entrance Turnstile A (Left)",
        "zone": "MAIN_ENTRY",
        "direction": "ENTRY",
        "decision": "DENIED_EXPIRED",
        "reason": "Membership expired on 2026-09-01. Please renew at front desk."
    },
    {
        "id": "log-004",
        "timestamp": "2026-10-15T17:20:05Z",
        "memberId": "mem-003",
        "memberName": "Arjun Mehta",
        "memberPhotoUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
        "membershipTier": "SILVER",
        "deviceId": "gate-dev-04",
        "deviceName": "Main Exit Turnstile",
        "zone": "MAIN_EXIT",
        "direction": "EXIT",
        "decision": "GRANTED",
        "reason": "Checkout recorded"
    }
]

MOCK_CLASSES = [
    {
        "id": "cls-01",
        "title": "IronPower Heavy Lifting & Deadlift Mechanics",
        "category": "POWERLIFTING",
        "branchId": "branch-blr-01",
        "instructorId": "trn-001",
        "instructorName": "Coach Raghav Sharma",
        "instructorAvatar": "https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=300&q=80",
        "room": "Platform Pit 01",
        "startTime": "2026-10-15T18:30:00Z",
        "endTime": "2026-10-15T19:30:00Z",
        "durationMinutes": 60,
        "capacity": 12,
        "enrolledCount": 11,
        "waitlistCount": 2,
        "intensityLevel": "ADVANCED",
        "burnCaloriesEstimate": 650,
        "description": "Master the raw mechanics of deadlifts, squats, and overhead presses with bar path video review."
    },
    {
        "id": "cls-02",
        "title": "Metcon 500: High Intensity Functional Circuit",
        "category": "HIIT",
        "branchId": "branch-blr-01",
        "instructorId": "trn-002",
        "instructorName": "Pooja Roy (CrossFit L2)",
        "instructorAvatar": "https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=300&q=80",
        "room": "CrossFit Arena",
        "startTime": "2026-10-15T19:45:00Z",
        "endTime": "2026-10-15T20:30:00Z",
        "durationMinutes": 45,
        "capacity": 20,
        "enrolledCount": 18,
        "waitlistCount": 0,
        "intensityLevel": "INTERMEDIATE",
        "burnCaloriesEstimate": 550,
        "description": "Kettlebells, ski ergs, assault bikes, and sled pushes designed to incinerate fat and build engine stamina."
    },
    {
        "id": "cls-03",
        "title": "Mobility, Fascia Release & Breathwork",
        "category": "YOGA",
        "branchId": "branch-blr-01",
        "instructorId": "trn-003",
        "instructorName": "Simran Khanna",
        "instructorAvatar": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80",
        "room": "Mind-Body Studio B",
        "startTime": "2026-10-16T06:30:00Z",
        "endTime": "2026-10-16T07:30:00Z",
        "durationMinutes": 60,
        "capacity": 25,
        "enrolledCount": 14,
        "waitlistCount": 0,
        "intensityLevel": "ALL_LEVELS",
        "burnCaloriesEstimate": 250,
        "description": "Decompress heavy spinal loads, increase hip mobility, and optimize recovery using somatic breath."
    }
]

MOCK_TRAINERS = [
    {
        "id": "trn-001",
        "firstName": "Raghav",
        "lastName": "Sharma",
        "email": "raghav.pt@ironclub.zolexora.io",
        "phone": "+91 98334 11229",
        "avatarUrl": "https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=300&q=80",
        "specialties": ["Powerlifting", "Hypertrophy", "Strength Conditioning"],
        "bio": "Former National Powerlifter. Specializes in barbell technique, peaking cycles, and injury prevention.",
        "experienceYears": 9,
        "activeClientsCount": 14,
        "rating": 4.95,
        "reviewsCount": 86,
        "hourlyRate": 1800,
        "certifications": ["CSCS", "IPF Level 2", "Precision Nutrition L1"]
    },
    {
        "id": "trn-002",
        "firstName": "Pooja",
        "lastName": "Roy",
        "email": "pooja.pt@ironclub.zolexora.io",
        "phone": "+91 98211 44552",
        "avatarUrl": "https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=300&q=80",
        "specialties": ["CrossFit", "Athletic Conditioning", "Weight Loss"],
        "bio": "Competitive CrossFit athlete. Helps busy founders and executives build high-stamina bodies.",
        "experienceYears": 6,
        "activeClientsCount": 12,
        "rating": 4.92,
        "reviewsCount": 64,
        "hourlyRate": 1600,
        "certifications": ["CrossFit L2 Trainer", "ACE-CPT", "Kettlebell Specialist"]
    }
]

MOCK_SMART_EQUIPMENT = [
    {
        "id": "eq-01",
        "assetTag": "EQ-ELEIKO-PL01",
        "name": "Eleiko IPF Competition Power Rack & Platform",
        "category": "FREE_WEIGHT",
        "brand": "Eleiko Sweden",
        "zone": "FREE_WEIGHTS",
        "status": "OPTIMAL",
        "installedDate": "2024-01-15",
        "lastMaintenanceDate": "2026-09-10",
        "nextServiceDueDate": "2026-12-10",
        "totalUsageHours": 2180.5,
        "maintenanceTicketsCount": 0
    },
    {
        "id": "eq-02",
        "assetTag": "EQ-PRIME-HACK02",
        "name": "Prime Fitness USA Plate-Loaded Hack Squat",
        "category": "PLATE_LOADED",
        "brand": "Prime Fitness",
        "zone": "FREE_WEIGHTS",
        "status": "OPTIMAL",
        "installedDate": "2024-02-01",
        "lastMaintenanceDate": "2026-09-22",
        "nextServiceDueDate": "2026-11-22",
        "totalUsageHours": 1845.0,
        "maintenanceTicketsCount": 0
    },
    {
        "id": "eq-03",
        "assetTag": "EQ-CYBEX-CABLE03",
        "name": "Cybex Dual Adjustable Cable Crossover 8-Stack",
        "category": "CABLE_STATION",
        "brand": "Cybex International",
        "zone": "FREE_WEIGHTS",
        "status": "INSPECTION_DUE",
        "installedDate": "2023-11-10",
        "lastMaintenanceDate": "2026-07-05",
        "nextServiceDueDate": "2026-10-18",
        "totalUsageHours": 3290.2,
        "maintenanceTicketsCount": 1
    },
    {
        "id": "eq-04",
        "assetTag": "EQ-ASSAULT-RUNNER04",
        "name": "Assault Fitness Curved Manual Treadmill Elite",
        "category": "CARDIO",
        "brand": "Assault Fitness",
        "zone": "MAIN_ENTRY",
        "status": "OPTIMAL",
        "installedDate": "2024-05-12",
        "lastMaintenanceDate": "2026-09-01",
        "nextServiceDueDate": "2026-12-01",
        "totalUsageHours": 1450.8,
        "maintenanceTicketsCount": 0
    }
]

MOCK_POS_ITEMS = [
    {
        "id": "pos-01",
        "sku": "SUPP-WHEY-ISOLATE",
        "name": "IronClub Pure Whey Isolate (Double Chocolate 2kg)",
        "category": "SUPPLEMENTS",
        "price": 4899,
        "stockQty": 38,
        "imageUrl": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80"
    },
    {
        "id": "pos-02",
        "sku": "SUPP-CREATINE-MONO",
        "name": "Creapure Micronized Creatine 300g",
        "category": "SUPPLEMENTS",
        "price": 1299,
        "stockQty": 65,
        "imageUrl": "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?auto=format&fit=crop&w=300&q=80"
    },
    {
        "id": "pos-03",
        "sku": "GEAR-LEATHER-BELT",
        "name": "IronClub 10mm Lever Competition Belt (Genuine Suede)",
        "category": "GEAR_APPAREL",
        "price": 3499,
        "stockQty": 19,
        "imageUrl": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=300&q=80"
    },
    {
        "id": "pos-04",
        "sku": "BEV-PROTEIN-SHAKE",
        "name": "House Cold Brew Protein Shake (35g Protein)",
        "category": "BEVERAGES",
        "price": 220,
        "stockQty": 42,
        "imageUrl": "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=300&q=80"
    }
]

MOCK_INVOICES = [
    {
        "id": "inv-001",
        "invoiceNumber": "INV-IC-2026-9901",
        "memberId": "mem-001",
        "memberName": "Vikram Singhania",
        "amount": 42000,
        "taxAmount": 7560,
        "totalAmount": 49560,
        "status": "PAID",
        "paymentGateway": "RAZORPAY",
        "paymentDate": "2026-01-10T11:20:00Z",
        "dueDate": "2026-01-10",
        "itemsDescription": "1-Year Black Iron VIP Annual Pass + PT 12-Pack"
    },
    {
        "id": "inv-002",
        "invoiceNumber": "INV-IC-2026-9902",
        "memberId": "mem-002",
        "memberName": "Ananya Deshmukh",
        "amount": 24000,
        "taxAmount": 4320,
        "totalAmount": 28320,
        "status": "PAID",
        "paymentGateway": "CASHFREE",
        "paymentDate": "2026-03-01T14:10:00Z",
        "dueDate": "2026-03-01",
        "itemsDescription": "Gold Membership 12-Month Plan"
    }
]
