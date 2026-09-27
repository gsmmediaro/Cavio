import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsPane } from "@/components/settings/settings-pane";

type LanguagePaneProps = {
  lang: "en" | "ro";
  onChange: (lang: "en" | "ro") => void;
};

/** Preferences pane — language segmented control (Notra settings row style). */
export function LanguageSettingsPane({ lang, onChange }: LanguagePaneProps) {
  return (
    <SettingsPane>
      <div className="border-border/80 bg-muted/80 overflow-hidden rounded-lg border">
        <div className="px-4 py-3">
          <p className="text-sm font-medium">Language</p>
          <p className="text-muted-foreground text-xs">Interface language for Cavio.</p>
        </div>
        <div className="border-border/60 rounded-t-lg border-t bg-background px-4 py-4">
          <Tabs
            onValueChange={(next) => onChange(next === "ro" ? "ro" : "en")}
            value={lang}
          >
            <TabsList variant="default">
              <TabsTrigger value="en">English</TabsTrigger>
              <TabsTrigger value="ro">Română</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </SettingsPane>
  );
}
