import { CheckCircleIcon } from "./Icons";

export interface PasswordRulesResult {
  length: boolean;
  uppercase: boolean;
  number: boolean;
  special: boolean;
  isValid: boolean;
}

export function checkPasswordRules(value: string): PasswordRulesResult {
  const length = value.length >= 8;
  const uppercase = /[A-Z]/.test(value);
  const number = /\d/.test(value);
  const special = /[^A-Za-z0-9]/.test(value);
  return {
    length,
    uppercase,
    number,
    special,
    isValid: length && uppercase && number && special,
  };
}

export function PasswordRequirements({ value }: { value: string }) {
  const rules = checkPasswordRules(value);

  const items = [
    { key: "length" as const, label: "8+ characters" },
    { key: "uppercase" as const, label: "1 uppercase letter" },
    { key: "number" as const, label: "1 number" },
    { key: "special" as const, label: "1 special character" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "0.375rem",
        fontSize: "0.75rem",
        marginTop: "0.5rem",
        marginBottom: "0.75rem",
      }}
      aria-live="polite"
    >
      {items.map((item) => {
        const valid = rules[item.key];
        return (
          <div
            key={item.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              color: valid ? "#10b981" : "#94a3b8",
              transition: "color 0.2s",
              fontWeight: valid ? 600 : 400,
            }}
          >
            <CheckCircleIcon size={14} className={valid ? "text-emerald-500" : "text-slate-500"} />
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
