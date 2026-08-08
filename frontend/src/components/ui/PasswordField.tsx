import { useState } from "react";
import { Eye, EyeOff, Copy, Check, RefreshCw } from "lucide-react";
import { Input } from "./Input";
import { Button } from "./Button";
import { useToast } from "./Toast";
import { generateStrongPassword, scorePasswordStrength, passwordStrengthLabel, passwordStrengthColor } from "@/utils/passwordStrength";

interface PasswordFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Defaults to a strong random password (uppercase/lowercase/number/special) — pass a custom generator (e.g. name+ID based) to keep an existing admin form's scheme. */
  onGenerate?: () => void;
  error?: string;
  /** Shows the weak/fair/good/strong meter below the field — on by default, since every registration form wants it, but existing compact admin modals can opt out. */
  showStrength?: boolean;
}

/**
 * Password input with Generate/Show-Hide/Copy + an optional strength meter.
 * No email invite is sent anywhere in this app, so whoever fills this form
 * needs to see/share the value directly — that's why Show and Copy exist
 * here at all, unlike a typical "type blind" password field.
 */
export function PasswordField({
  label = "Password",
  value,
  onChange,
  onGenerate,
  error,
  showStrength = true,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  function handleGenerate() {
    if (onGenerate) {
      onGenerate();
    } else {
      onChange(generateStrongPassword());
    }
    setVisible(true);
  }

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

  const strength = scorePasswordStrength(value);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <Input
            label={label}
            type={visible ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            error={error}
            className="pr-20"
            autoComplete="new-password"
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!value}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-slate-300"
              aria-label="Copy password"
              title="Copy password"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
              aria-label={visible ? "Hide password" : "Show password"}
              title={visible ? "Hide password" : "Show password"}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="invisible text-sm font-medium">Generate</span>
          <Button type="button" variant="secondary" onClick={handleGenerate} title="Generate a strong password">
            <RefreshCw className="h-3.5 w-3.5" />
            Generate
          </Button>
        </div>
      </div>

      {showStrength && value && (
        <div className="flex items-center gap-2">
          <div className="flex h-1.5 flex-1 gap-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            {(["weak", "fair", "good", "strong"] as const).map((tier, i) => {
              const order = ["weak", "fair", "good", "strong"];
              const reached = order.indexOf(strength) >= i;
              return <div key={tier} className={`flex-1 transition-colors ${reached ? passwordStrengthColor(strength) : ""}`} />;
            })}
          </div>
          <span className="w-10 text-xs font-medium text-slate-500 dark:text-slate-400">{passwordStrengthLabel(strength)}</span>
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">No email is sent — share this password with them directly.</p>
    </div>
  );
}
