import { useState } from "react";
import { Eye, EyeOff, Copy, Check, RefreshCw } from "lucide-react";
import { AuthInput } from "./AuthInput";
import { useToast } from "@/components/ui/Toast";
import { generateStrongPassword, scorePasswordStrength, passwordStrengthLabel, passwordStrengthColor } from "@/utils/passwordStrength";

interface AuthPasswordInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/** Dark-glass counterpart to components/ui/PasswordField, for the Login/Register panels — same Generate/Show/Copy/strength-meter behavior, styled to match AuthInput. */
export function AuthPasswordInput({ label = "Password", value, onChange, error }: AuthPasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const strength = scorePasswordStrength(value);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select and copy the password manually.");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <AuthInput
          label={label}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={error}
          autoComplete="new-password"
          className="pr-24"
        />
        <div className="absolute right-2 top-2.5 flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!value}
            className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
            aria-label="Copy password"
            title="Copy password"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label={visible ? "Hide password" : "Show password"}
            title={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(generateStrongPassword());
              setVisible(true);
            }}
            className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Generate a strong password"
            title="Generate a strong password"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {value && (
        <div className="flex items-center gap-2 px-0.5">
          <div className="flex h-1.5 flex-1 gap-1 overflow-hidden rounded-full bg-white/10">
            {(["weak", "fair", "good", "strong"] as const).map((tier, i) => {
              const order = ["weak", "fair", "good", "strong"];
              const reached = order.indexOf(strength) >= i;
              return <div key={tier} className={`flex-1 transition-colors ${reached ? passwordStrengthColor(strength) : ""}`} />;
            })}
          </div>
          <span className="w-10 text-xs font-medium text-slate-400">{passwordStrengthLabel(strength)}</span>
        </div>
      )}
    </div>
  );
}
