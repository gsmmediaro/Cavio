import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

import { AuthFormHeader } from "@notra/ui/components/shared/auth/auth-form-header";
import { CtaButton } from "@notra/ui/components/shared/cta-button";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { cn } from "@notra/ui/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

/**
 * Cavio onboarding content for AuthShell mode="onboarding".
 * Shell/brand panel match Notra OnboardingSplitLayout SOURCE.
 * Form chrome mirrors workspace-form: AuthFormHeader + labeled fields + CtaButton.
 */

const SPECIALITIES = [
  "General dentist",
  "Orthodontist",
  "Endodontist",
  "Oral surgeon",
  "Pediatric dentist",
  "Periodontist",
  "Prosthodontist",
  "Other",
];

const ROLES = ["Founder", "Dentist", "Assistant", "Manager", "Other"];
const ORG_SIZES = ["Solo", "2-5", "6-10", "10+"];

type TranslatedOption = { value: string; label: string };

function StyledSelect({
  value,
  onValueChange,
  placeholder,
  options,
  id,
  label,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  options: TranslatedOption[];
  id: string;
  label: string;
}) {
  const selectedLabel = options.find((o) => o.value === value)?.label;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <SelectPrimitive.Root value={value || undefined} onValueChange={onValueChange}>
        <SelectPrimitive.Trigger
          id={id}
          className={cn(
            "border-input bg-transparent flex h-11 w-full items-center justify-between rounded-xl border px-4 text-base outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            value ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder}>
            {selectedLabel}
          </SelectPrimitive.Value>
          <SelectPrimitive.Icon>
            <ChevronDown className="text-muted-foreground size-4" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="bg-popover text-popover-foreground z-[1100] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border shadow-md"
            position="popper"
            sideOffset={6}
            side="bottom"
            align="start"
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((opt) => (
                <SelectPrimitive.Item
                  key={opt.value}
                  value={opt.value}
                  className="data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm outline-none"
                >
                  <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

function TermsContent() {
  const { t } = useTranslation();
  return (
    <div className="text-muted-foreground space-y-3 text-sm">
      <h2 className="text-foreground text-base font-semibold">{t("onboarding.termsContent.s1h")}</h2>
      <p>{t("onboarding.termsContent.s1p")}</p>
      <h2 className="text-foreground text-base font-semibold">{t("onboarding.termsContent.s2h")}</h2>
      <p>{t("onboarding.termsContent.s2p")}</p>
      <h2 className="text-foreground text-base font-semibold">{t("onboarding.termsContent.s3h")}</h2>
      <p>{t("onboarding.termsContent.s3p")}</p>
      <h2 className="text-foreground text-base font-semibold">{t("onboarding.termsContent.s4h")}</h2>
      <p>{t("onboarding.termsContent.s4p")}</p>
      <h2 className="text-foreground text-base font-semibold">{t("onboarding.termsContent.s5h")}</h2>
      <p>{t("onboarding.termsContent.s5p")}</p>
      <h2 className="text-foreground text-base font-semibold">{t("onboarding.termsContent.s6h")}</h2>
      <p>{t("onboarding.termsContent.s6p")}</p>
      <h2 className="text-foreground text-base font-semibold">{t("onboarding.termsContent.s7h")}</h2>
      <p>{t("onboarding.termsContent.s7p")}</p>
    </div>
  );
}

function PrivacyContent() {
  const { t } = useTranslation();
  return (
    <div className="text-muted-foreground space-y-3 text-sm">
      <h2 className="text-foreground text-base font-semibold">{t("onboarding.privacyContent.s1h")}</h2>
      <p>{t("onboarding.privacyContent.s1p")}</p>
      <h2 className="text-foreground text-base font-semibold">{t("onboarding.privacyContent.s2h")}</h2>
      <p>{t("onboarding.privacyContent.s2p")}</p>
      <h2 className="text-foreground text-base font-semibold">{t("onboarding.privacyContent.s3h")}</h2>
      <p>{t("onboarding.privacyContent.s3p")}</p>
      <h2 className="text-foreground text-base font-semibold">{t("onboarding.privacyContent.s4h")}</h2>
      <p>{t("onboarding.privacyContent.s4p")}</p>
      <h2 className="text-foreground text-base font-semibold">{t("onboarding.privacyContent.s5h")}</h2>
      <p>{t("onboarding.privacyContent.s5p")}</p>
      <h2 className="text-foreground text-base font-semibold">{t("onboarding.privacyContent.s6h")}</h2>
      <p>{t("onboarding.privacyContent.s6p")}</p>
    </div>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <div className="mb-6 flex justify-center gap-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "size-2 rounded-full transition-colors",
            i === step ? "bg-primary" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

export default function OnboardingFlow() {
  const { t } = useTranslation();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [speciality, setSpeciality] = useState("");
  const [role, setRole] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgSize, setOrgSize] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [legalPopup, setLegalPopup] = useState<"terms" | "privacy" | null>(null);

  const canNext0 = Boolean(speciality && role && agreed);
  const canNext1 = Boolean(orgName.trim() && orgSize);

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    await updateDoc(doc(db, "users", user.uid), {
      speciality,
      role,
      orgName: orgName.trim(),
      orgSize,
      onboarded: true,
      trialStartedAt: serverTimestamp(),
    });
    await refreshProfile();
    setSaving(false);
  };

  const legalPopupEl = (
    <Dialog open={Boolean(legalPopup)} onOpenChange={(open) => { if (!open) setLegalPopup(null); }}>
      <DialogContent className="flex max-h-[70vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>
            {legalPopup === "terms"
              ? t("onboarding.legalModal.terms")
              : t("onboarding.legalModal.privacy")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Legal document
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-5 py-2 pb-6">
          {legalPopup === "terms" ? <TermsContent /> : <PrivacyContent />}
        </div>
      </DialogContent>
    </Dialog>
  );

  if (step === 0) {
    return (
      <div className="flex w-full flex-col gap-5">
        {legalPopupEl}
        <StepDots step={0} />
        <AuthFormHeader
          title={t("onboarding.step0.title")}
          description={t("onboarding.step0.subtitle", {
            defaultValue: "Tell us a bit about how you practice.",
          })}
        />
        <div className="grid gap-3">
          <StyledSelect
            id="speciality"
            label={t("onboarding.step0.specialtyLabel", {
              defaultValue: "Specialty",
            })}
            value={speciality}
            onValueChange={setSpeciality}
            placeholder={t("onboarding.step0.specialtyPlaceholder")}
            options={SPECIALITIES.map((s) => ({
              value: s,
              label: t(`onboarding.specialties.${s}`, { defaultValue: s }),
            }))}
          />
          <StyledSelect
            id="role"
            label={t("onboarding.step0.roleLabel", { defaultValue: "Role" })}
            value={role}
            onValueChange={setRole}
            placeholder={t("onboarding.step0.rolePlaceholder")}
            options={ROLES.map((r) => ({
              value: r,
              label: t(`onboarding.roles.${r}`, { defaultValue: r }),
            }))}
          />
          <label className="text-muted-foreground mt-1 flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="accent-primary mt-0.5 cursor-pointer"
            />
            <span>
              {t("onboarding.step0.agreeText")}{" "}
              <button
                type="button"
                onClick={() => setLegalPopup("terms")}
                className="text-primary font-medium underline underline-offset-4"
              >
                {t("onboarding.step0.terms")}
              </button>{" "}
              {t("onboarding.step0.and")}{" "}
              <button
                type="button"
                onClick={() => setLegalPopup("privacy")}
                className="text-primary font-medium underline underline-offset-4"
              >
                {t("onboarding.step0.privacy")}
              </button>
            </span>
          </label>
          <CtaButton
            className="mt-2 w-full"
            disabled={!canNext0}
            onClick={() => setStep(1)}
            type="button"
          >
            {t("onboarding.continue")}
          </CtaButton>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="flex w-full flex-col gap-5">
        <StepDots step={1} />
        <AuthFormHeader
          title={t("onboarding.step1.title")}
          description={t("onboarding.step1.subtitle", {
            defaultValue: "Set up your clinic workspace.",
          })}
        />
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="orgName">
              {t("onboarding.step1.orgNameLabel", {
                defaultValue: "Clinic name",
              })}
            </Label>
            <Input
              className="h-11 rounded-xl px-4"
              id="orgName"
              placeholder={t("onboarding.step1.orgName")}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>
          <StyledSelect
            id="orgSize"
            label={t("onboarding.step1.dentistsLabel", {
              defaultValue: "Team size",
            })}
            value={orgSize}
            onValueChange={setOrgSize}
            placeholder={t("onboarding.step1.dentistsPlaceholder")}
            options={ORG_SIZES.map((s) => ({
              value: s,
              label: t(`onboarding.orgSizes.${s}`, { defaultValue: s }),
            }))}
          />
          <div className="mt-2 flex gap-3">
            <CtaButton
              className="flex-1"
              type="button"
              variant="light"
              onClick={() => setStep(0)}
            >
              {t("onboarding.step1.back")}
            </CtaButton>
            <CtaButton
              className="flex-[2]"
              type="button"
              disabled={!canNext1}
              onClick={() => setStep(2)}
            >
              {t("onboarding.continue")}
            </CtaButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <StepDots step={2} />
      <AuthFormHeader
        title={t("onboarding.step2.title")}
        description={t("onboarding.step2.trialText")}
      />
      <CtaButton
        className="w-full"
        type="button"
        disabled={saving}
        onClick={handleFinish}
      >
        {saving ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            {t("onboarding.step2.saving")}
          </>
        ) : (
          t("onboarding.step2.getStarted")
        )}
      </CtaButton>
    </div>
  );
}
