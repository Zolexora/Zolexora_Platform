export const FIXTURES = {
  turnstile: {
    valid: "0.valid-cf-turnstile-token",
    invalid: "0.invalid-cf-turnstile-token",
    timeoutDuplicate: "0.timeout-or-duplicate-token",
  },
  ids: {
    validUser: "ZX-8K9M-4P2W-7Y3X",
    validOrg: "ZX-ORG-4B8T-9M2K-7Y4X",
    validOrgLowercase: "zx-org-4b8t-9m2k-7y4x",
    invalidAmbiguousOrg: "ZX-ORG-0000-IIII-OOOO", // 0, I, O not allowed in Crockford Base32
    invalidFormatOrg: "ORG-12345",
  },
  emails: {
    publicUser: "consumer@clarityfi.app",
    enterpriseUser: "logistics.manager@globalfreight.com",
    adminUser: "superadmin@zolexora.com",
    webmailList: [
      "dispatcher@gmail.com",
      "admin@yahoo.com",
      "support@hotmail.com",
      "driver@outlook.com",
      "logistics@icloud.com",
    ],
    corporateList: [
      "dispatcher@zolexora.com",
      "admin@acme-transport.com",
      "fleet@speedy-logistics.org",
    ],
  },
  passwords: {
    standard: "CorporateSecurePass123!",
    admin: "MasterSuperadminSecret2026!",
    short11Chars: "ShortP@ss11", // 11 chars -> violation
    exact12Chars: "Valid12Pass!", // 12 chars -> valid
    max1024Bytes: "A".repeat(1024), // 1024 bytes -> valid
    tooLong1025Bytes: "A".repeat(1025), // 1025 bytes -> violation
  },
  products: {
    consumer: ["clarityfi", "marketplace", "maunkavach"],
    enterprise: ["zolexora-tms", "zolexora-ims", "zolexora-erp"],
  },
  storage: {
    allowedMimes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
    forbiddenMimes: ["application/zip", "application/x-msdownload", "text/javascript", "application/x-sh"],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    exceededFileSize: 10 * 1024 * 1024 + 1024, // 10.001MB
  },
};
